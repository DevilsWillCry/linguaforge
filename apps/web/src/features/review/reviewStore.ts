import { useLocalStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { i18n } from '@/app/i18n'
import { deckRepository, entryRepository } from '@/data/repositories'
import { checkAnswer, suggestedRating, type AnswerResult } from '@/domain/answers'
import { appendOwnExample, feedbackTarget } from '@/domain/enrichment'
import { isLeech, buildQueue, type ReviewRating } from '@/domain/review'
import { buildCard, chooseMode, isReviewable, modesFor, type ReviewCard } from '@/domain/reviewCards'
import { formatArrowList, parseArrowList } from '@/domain/text'
import type { Deck, Entry, ReviewLog, SentenceFeedback } from '@/domain/types'
import { AiRequestError, requestFeedback } from '@/features/enrichment/enrichmentApi'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import { useLibraryStore } from '@/features/library/libraryStore'
import { canSpeakEnglish, speak, stopSpeaking } from '@/features/voice/speech'
import { notify } from '@/shared/ui/useToasts'

export const DEFAULT_DAILY_REVIEWS = 40
/** A rough average, only for the estimate shown to the user. */
const SECONDS_PER_CARD = 25
/** A card due again this soon comes back in the same session. */
const REQUEUE_WITHIN_MS = 20 * 60_000
/** Cards in between, so the answer isn't still in short-term memory. */
const REQUEUE_GAP = 3

const { t } = i18n.global

function startOfToday(now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return start
}

export type ReviewPhase = 'idle' | 'loading' | 'answering' | 'checking' | 'revealed' | 'finished'

export const useReviewStore = defineStore('review', () => {
  const dailyLimit = useLocalStorage('lf-review-limit', DEFAULT_DAILY_REVIEWS)

  const phase = ref<ReviewPhase>('idle')
  const deck = shallowRef<Deck | null>(null)
  const queue = shallowRef<Entry[]>([])
  const card = shallowRef<ReviewCard | null>(null)
  const typed = ref('')
  const result = ref<AnswerResult | null>(null)
  const feedback = shallowRef<SentenceFeedback | null>(null)
  const suggestion = ref<ReviewRating | null>(null)
  const hintShown = ref(false)
  const canSpeak = ref(false)
  const undoStack = shallowRef<{ log: ReviewLog; queue: Entry[] }[]>([])
  const answered = ref(0)
  const sentenceSaved = ref(false)

  const current = computed(() => queue.value[0] ?? null)
  const remaining = computed(() => queue.value.length)
  const minutesLeft = computed(() => Math.max(1, Math.ceil((remaining.value * SECONDS_PER_CARD) / 60)))
  const currentIsLeech = computed(() => Boolean(current.value && isLeech(current.value)))

  function showCurrent() {
    const entry = current.value
    typed.value = ''
    result.value = null
    feedback.value = null
    suggestion.value = null
    hintShown.value = false
    sentenceSaved.value = false
    stopSpeaking()
    if (!entry || !deck.value) {
      card.value = null
      phase.value = 'finished'
      return
    }
    const available = modesFor(entry, deck.value, { canSpeak: canSpeak.value })
    const mode = chooseMode(available, entry.stats.lastMode)
    if (!mode) {
      // Its material was edited away during the session.
      queue.value = queue.value.slice(1)
      showCurrent()
      return
    }
    card.value = buildCard(entry, mode)
    phase.value = 'answering'
    playSpeech()
  }

  function playSpeech(rate = 1) {
    if (card.value?.mode === 'listening') speak(card.value.speech, rate)
  }

  /** Builds today's queue for the deck open in the Library. */
  async function start() {
    const library = useLibraryStore()
    phase.value = 'loading'
    undoStack.value = []
    answered.value = 0
    try {
      const decks = await deckRepository.list()
      const active = decks.find((candidate) => candidate.id === library.activeDeckId) ?? decks[0] ?? null
      deck.value = active
      canSpeak.value = await canSpeakEnglish()
      if (!active) {
        phase.value = 'finished'
        return
      }
      const [entries, reviewed] = await Promise.all([
        entryRepository.listByDeck(active.id),
        entryRepository.reviewedSince(startOfToday()),
      ])
      const reviewable = entries.filter((entry) => isReviewable(entry, active, canSpeak.value))
      queue.value = buildQueue(reviewable, dailyLimit.value - reviewed.length)
      showCurrent()
    } catch (error) {
      console.error(error)
      notify(t('errors.load'), { tone: 'error' })
      phase.value = 'idle'
    }
  }

  /** Shows the answer. For a typed answer it also checks it and suggests a grade. */
  async function reveal() {
    const shown = card.value
    if (phase.value !== 'answering' || !shown) return
    if (shown.mode === 'useIt') {
      await checkSentence(shown)
      return
    }
    result.value = checkAnswer(shown.answer, typed.value)
    suggestion.value = suggestedRating(result.value)
    // Needing the hint means the recall wasn't free, so Good would overstate it.
    if (hintShown.value && suggestion.value === 3) suggestion.value = 2
    phase.value = 'revealed'
  }

  async function checkSentence(shown: Extract<ReviewCard, { mode: 'useIt' }>) {
    const enrichment = useEnrichmentStore()
    const entry = current.value
    const sentence = typed.value.trim()
    if (!entry || !shown) return
    // Without AI, or with an empty answer, the user grades themselves after seeing the examples.
    if (!sentence || !enrichment.aiConfigured || !enrichment.budgetLeft()) {
      phase.value = 'revealed'
      if (!sentence) suggestion.value = 1
      return
    }
    phase.value = 'checking'
    try {
      const { feedback: answer, usage } = await requestFeedback({ target: feedbackTarget(entry), sentence })
      enrichment.spend(usage)
      if (current.value?.id !== entry.id) return
      feedback.value = answer
      suggestion.value = !answer.usesTarget || answer.verdict === 'incorrect' ? 1 : answer.verdict === 'natural' ? 3 : 2
    } catch (error) {
      // AI is a help here, not a requirement, so the review carries on with self-grading.
      const code = error instanceof AiRequestError ? error.code : 'failed'
      notify(t(`enrich.errors.${code}`), { tone: 'error' })
    }
    phase.value = 'revealed'
  }

  async function grade(rating: ReviewRating) {
    const entry = current.value
    const shown = card.value
    if (phase.value !== 'revealed' || !entry || !shown || !deck.value) return
    const wroteSentence = shown.mode === 'useIt' && Boolean(typed.value.trim())
    // AI's judgment counts when there is one. Otherwise the user's own grade does.
    const usedInOutput =
      wroteSentence &&
      (feedback.value ? feedback.value.usesTarget && feedback.value.verdict !== 'incorrect' : rating >= 3)

    const before = queue.value
    try {
      const saved = await entryRepository.recordReview(entry.id, {
        id: nanoid(),
        mode: shown.mode,
        rating,
        usedInOutput,
        languageDeck: deck.value.schema.languageFeatures,
      })
      const rest = before.slice(1)
      if (saved) {
        undoStack.value = [...undoStack.value, { log: saved.log, queue: before }]
        const dueSoon = new Date(saved.entry.srs.due).getTime() - Date.now() <= REQUEUE_WITHIN_MS
        if (dueSoon) rest.splice(Math.min(REQUEUE_GAP, rest.length), 0, saved.entry)
      }
      queue.value = rest
      answered.value += 1
      showCurrent()
    } catch (error) {
      console.error(error)
      notify(t('errors.save'), { tone: 'error' })
    }
  }

  /** Puts the last answer back, and returns to that card. */
  async function undo() {
    const last = undoStack.value.at(-1)
    if (!last || phase.value === 'checking') return
    try {
      const restored = await entryRepository.undoReview(last.log)
      undoStack.value = undoStack.value.slice(0, -1)
      answered.value = Math.max(0, answered.value - 1)
      queue.value = restored
        ? [restored, ...last.queue.filter((entry) => entry.id !== restored.id)]
        : last.queue.filter((entry) => entry.id !== last.log.entryId)
      showCurrent()
    } catch (error) {
      console.error(error)
      notify(t('errors.save'), { tone: 'error' })
    }
  }

  /** Saves the sentence written in "use it" as one of the user's own examples. */
  async function saveSentence() {
    const entry = current.value
    const sentence = typed.value.trim()
    if (!entry || !sentence || sentenceSaved.value) return
    const cell = appendOwnExample(formatArrowList(entry.ownExamples), sentence)
    const ownExamples = parseArrowList(cell)
    await entryRepository.patch(entry.id, { ownExamples })
    queue.value = [{ ...entry, ownExamples }, ...queue.value.slice(1)]
    sentenceSaved.value = true
    notify(t('enrich.coach.added'))
  }

  function setDailyLimit(value: number) {
    dailyLimit.value = Math.max(1, Math.round(value) || DEFAULT_DAILY_REVIEWS)
  }

  return {
    dailyLimit,
    phase,
    deck,
    card,
    current,
    typed,
    result,
    feedback,
    suggestion,
    hintShown,
    canSpeak,
    answered,
    remaining,
    minutesLeft,
    currentIsLeech,
    sentenceSaved,
    canUndo: computed(() => undoStack.value.length > 0),
    start,
    reveal,
    grade,
    undo,
    playSpeech,
    saveSentence,
    setDailyLimit,
  }
})
