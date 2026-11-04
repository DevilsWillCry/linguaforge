import { useLocalStorage } from '@vueuse/core'
import { liveQuery, type Subscription } from 'dexie'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { i18n } from '@/app/i18n'
import { deckRepository, entryRepository } from '@/data/repositories'
import { findSentence, readingParagraphs, readingStats, textSample } from '@/domain/readingText'
import type { Deck, Entry, EntrySource } from '@/domain/types'
import { saveCapture as saveToLibrary, type Capture } from '@/features/capture/saveCapture'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import { notify } from '@/shared/ui/useToasts'
import { ReadingError, requestArticle, requestLevel, type Article, type LevelEstimate } from './readingApi'

const { t } = i18n.global

const MAX_RECENT = 8
/** Matches the server's limit on how much text is sent to AI. */
const LEVEL_SAMPLE_CHARS = 3000

export const useReadingStore = defineStore('reading', () => {
  const article = shallowRef<Article | null>(null)
  const loading = ref(false)
  const errorCode = ref<string | null>(null)
  const failedUrl = ref<string | null>(null)
  const capture = shallowRef<Capture | null>(null)
  const estimate = shallowRef<LevelEstimate | null>(null)
  const estimating = ref(false)
  const library = shallowRef<Entry[]>([])
  const decks = shallowRef<Deck[]>([])
  // Only titles and links. The text of a page is never stored, so reopening fetches it again.
  const recent = useLocalStorage<{ url: string; title: string }[]>('lf-reading-recent', [])

  const paragraphs = computed(() => readingParagraphs(article.value?.paragraphs ?? [], library.value))
  const stats = computed(() => readingStats(paragraphs.value))

  let subscription: Subscription | null = null
  function watchLibrary() {
    subscription ??= liveQuery(async () => {
      const language = (await deckRepository.list()).filter((deck) => deck.schema.languageFeatures)
      const entries = await Promise.all(language.map((deck) => entryRepository.listByDeck(deck.id)))
      return { decks: language, entries: entries.flat() }
    }).subscribe({
      next: (value) => {
        decks.value = value.decks
        library.value = value.entries
      },
      error: (error) => console.error(error),
    })
  }

  function reset() {
    article.value = null
    capture.value = null
    estimate.value = null
    errorCode.value = null
    failedUrl.value = null
  }

  /** Each new request cancels the meaning of older ones, so a slow page can't replace a newer one. */
  let requestId = 0

  async function openUrl(url: string) {
    watchLibrary()
    reset()
    loading.value = true
    const id = ++requestId
    try {
      const loaded = await requestArticle(url)
      if (id !== requestId) return
      article.value = loaded
      recent.value = [{ url: loaded.url, title: loaded.title }, ...recent.value.filter((item) => item.url !== loaded.url)].slice(0, MAX_RECENT)
    } catch (error) {
      if (id !== requestId) return
      errorCode.value = error instanceof ReadingError ? error.code : 'fetch_failed'
      failedUrl.value = url
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function openText(text: string, title: string, sourceUrl?: string) {
    watchLibrary()
    requestId += 1
    reset()
    loading.value = false
    const parts = text.split(/\n\s*\n|\r\n\s*\r\n/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean)
    if (parts.length) article.value = { title, paragraphs: parts, ...(sourceUrl ? { url: sourceUrl } : {}) }
  }

  function close() {
    requestId += 1
    loading.value = false
    reset()
  }

  const startCapture = (text: string, sentence: string, entry?: Entry) => {
    capture.value = { text, sentence, ...(entry ? { entry } : {}) }
  }

  const captureTyped = (text: string) => startCapture(text.trim(), findSentence(paragraphs.value, text))

  function captureSource(): EntrySource {
    const current = article.value
    return { ...(current?.title ? { title: current.title } : {}), ...(current?.url ? { url: current.url } : {}) }
  }

  async function saveCapture(text: string) {
    const current = capture.value
    const deck = decks.value[0]
    if (!current || !deck || !text.trim()) return
    try {
      const saved = await saveToLibrary(current, text, deck, captureSource(), 'Reading')
      notify(saved.created ? t('video.capture.added', { name: saved.name }) : t('video.capture.updated', { name: saved.name }))
      capture.value = null
    } catch (error) {
      console.error(error)
      notify(t('errors.save'), { tone: 'error' })
    }
  }

  async function estimateLevel() {
    const enrichment = useEnrichmentStore()
    const current = article.value
    if (!current || estimating.value) return
    if (!enrichment.budgetLeft()) {
      notify(t('enrich.errors.budget'), { tone: 'error' })
      return
    }
    estimating.value = true
    try {
      const result = await requestLevel(textSample(current.paragraphs, LEVEL_SAMPLE_CHARS))
      enrichment.spend(result.usage)
      if (article.value === current) estimate.value = result.estimate
    } catch (error) {
      const code = error instanceof ReadingError ? error.code : 'failed'
      notify(t(`enrich.errors.${code}`), { tone: 'error' })
    } finally {
      estimating.value = false
    }
  }

  return {
    article,
    loading,
    errorCode,
    failedUrl,
    capture,
    estimate,
    estimating,
    recent,
    paragraphs,
    stats,
    openUrl,
    openText,
    close,
    startCapture,
    captureTyped,
    saveCapture,
    estimateLevel,
  }
})
