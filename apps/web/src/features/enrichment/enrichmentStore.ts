import { useLocalStorage } from '@vueuse/core'
import { liveQuery } from 'dexie'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { i18n } from '@/app/i18n'
import { router } from '@/app/router'
import { deckRepository, entryRepository } from '@/data/repositories'
import { canAutoEnrich, needsManualText } from '@/domain/enrichment'
import type { Deck, Entry } from '@/domain/types'
import { notify } from '@/shared/ui/useToasts'
import { fetchAiConfigured, requestEnrichment, type AiUsage } from './enrichmentApi'
import { runEnrichmentQueue } from './enrichmentQueue'

export const DEFAULT_DAILY_TOKENS = 50_000

const { t } = i18n.global

/** Today in the user's time zone, so the budget resets at their midnight. */
function localDay(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Lets one tab at a time work on the queue, so two tabs can't pay for the same entry twice.
 * Others wait their turn rather than give up, so they take over if the first tab closes.
 */
async function withQueueLock(work: () => Promise<void>): Promise<void> {
  if (!navigator.locks) return work()
  await navigator.locks.request('lf-enrichment-queue', work)
}

export const useEnrichmentStore = defineStore('enrichment', () => {
  const decks = shallowRef<Deck[]>([])
  const entries = shallowRef<Entry[]>([])
  const aiConfigured = ref<boolean | null>(null)
  const running = ref(false)
  const stop = ref<{ kind: 'budget' } | { kind: 'paused'; code: string } | null>(null)

  const dailyBudget = useLocalStorage('lf-ai-budget', DEFAULT_DAILY_TOKENS)
  const usage = useLocalStorage('lf-ai-usage', { day: localDay(), tokens: 0 })
  const usedToday = computed(() => (usage.value.day === localDay() ? usage.value.tokens : 0))
  const budgetLeft = () => usedToday.value < dailyBudget.value

  function spend({ inputTokens, outputTokens }: AiUsage) {
    usage.value = { day: localDay(), tokens: usedToday.value + inputTokens + outputTokens }
  }

  const deckOf = (entry: Entry) => decks.value.find((deck) => deck.id === entry.deckId)
  const inLanguageDeck = computed(() => entries.value.filter((entry) => deckOf(entry)?.schema.languageFeatures))
  const byNewest = (list: Entry[]) => [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.text.localeCompare(b.text))

  const drafts = computed(() => byNewest(inLanguageDeck.value.filter((entry) => entry.enrichment === 'draft')))
  const pending = computed(() => byNewest(inLanguageDeck.value.filter((entry) => entry.enrichment === 'pending')))
  const waiting = computed(() => byNewest(inLanguageDeck.value.filter((entry) => canAutoEnrich(entry, deckOf(entry)))))
  const failed = computed(() => byNewest(inLanguageDeck.value.filter((entry) => entry.enrichment === 'empty' && entry.aiError)))
  const manual = computed(() => byNewest(inLanguageDeck.value.filter((entry) => !entry.aiError && needsManualText(entry))))

  /**
   * Whoever holds the lock is the only one working, so anything still "pending" was left
   * behind by a page closed mid-request. Only call this while holding the lock.
   */
  const releaseAbandoned = () => entryRepository.moveEnrichment('all', 'pending', { enrichment: 'empty' })

  /** Set when entries arrive during a run, in case that run has already looked for its last batch. */
  let runAgain = false

  async function run() {
    if (running.value) {
      runAgain = true
      return
    }
    if (!aiConfigured.value || stop.value) return
    running.value = true
    try {
      await withQueueLock(async () => {
        await releaseAbandoned()
        const result = await runEnrichmentQueue({
          listDecks: () => deckRepository.list(),
          listUnconfirmed: () => entryRepository.listUnconfirmed(),
          moveEnrichment: (ids, from, change) => entryRepository.moveEnrichment(ids, from, change),
          enrich: requestEnrichment,
          budgetLeft,
          spend,
        })
        if (result.stopped === 'budget') {
          // The limit may have been raised while this run was deciding to stop.
          if (budgetLeft()) runAgain = true
          else stop.value = { kind: 'budget' }
        } else if (result.stopped === 'paused') {
          stop.value = { kind: 'paused', code: result.code }
          notify(t('enrich.status.paused', { reason: t(`enrich.errors.${result.code}`) }), { tone: 'error' })
        }
        if (result.drafted && router.currentRoute.value.name !== 'enrich') {
          notify(t('enrich.ready', { n: result.drafted }), {
            actionLabel: t('enrich.open'),
            action: () => void router.push('/enrich'),
          })
        }
      })
    } catch (error) {
      console.error(error)
      notify(t('enrich.errors.failed'), { tone: 'error' })
    } finally {
      running.value = false
      if (runAgain) {
        runAgain = false
        void run()
      }
    }
  }

  let started = false
  /** Starts the queue once, and keeps it running as new entries arrive. */
  async function start() {
    if (started) return
    started = true
    aiConfigured.value = await fetchAiConfigured()
    // Done whether or not AI is on, or these entries would say "Completing…" forever.
    // Not awaited, because another tab may hold the lock for a while. Requests run in order.
    withQueueLock(releaseAbandoned).catch((error) => console.error(error))
    liveQuery(async () => ({
      decks: await deckRepository.list(),
      entries: await entryRepository.listUnconfirmed(),
    })).subscribe({
      next: (value) => {
        decks.value = value.decks
        entries.value = value.entries
        if (waiting.value.length) void run()
      },
      error: (error) => console.error(error),
    })
  }

  /** Clears the failures and any pause, then tries again. */
  async function retry() {
    stop.value = null
    aiConfigured.value = await fetchAiConfigured()
    const ids = failed.value.map((entry) => entry.id)
    if (ids.length) await entryRepository.moveEnrichment(ids, 'empty', { aiError: undefined })
    void run()
  }

  /** Discards a draft and asks for a new one. */
  async function regenerate(entry: Entry) {
    stop.value = null
    await entryRepository.moveEnrichment([entry.id], 'draft', { enrichment: 'empty', aiDraft: undefined, aiError: undefined })
  }

  /** Raising the limit in Settings resumes a queue stopped by it. */
  function setBudget(tokens: number) {
    dailyBudget.value = Math.max(0, Math.round(tokens) || 0)
    if (stop.value?.kind === 'budget' && budgetLeft()) {
      stop.value = null
      void run()
    }
  }

  return {
    aiConfigured,
    running,
    stop,
    dailyBudget,
    usedToday,
    budgetLeft,
    spend,
    deckOf,
    drafts,
    pending,
    waiting,
    failed,
    manual,
    start,
    retry,
    regenerate,
    setBudget,
  }
})
