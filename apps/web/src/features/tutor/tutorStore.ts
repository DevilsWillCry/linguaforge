import { useLocalStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { i18n } from '@/app/i18n'
import { deckRepository, entryRepository, tutorRepository } from '@/data/repositories'
import { normalizeText } from '@/domain/text'
import { historyPayload, pickTargets, targetPayload, usedTargetsOf } from '@/domain/tutor'
import type { Deck, Entry, TutorConversation, TutorMessage } from '@/domain/types'
import { saveCapture } from '@/features/capture/saveCapture'
import { AiRequestError, type AiUsage } from '@/features/enrichment/enrichmentApi'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import { canSpeakEnglish, speak, stopSpeaking } from '@/features/voice/speech'
import { notify } from '@/shared/ui/useToasts'
import { requestOutputReview, requestTutorTurn } from './tutorApi'
import type { OutputReview, ScenarioId } from './types'

const { t } = i18n.global
const RECENT_LIMIT = 5

export const useTutorStore = defineStore('tutor', () => {
  const deck = shallowRef<Deck | null>(null)
  const entries = shallowRef<Entry[]>([])
  const conversation = shallowRef<TutorConversation | null>(null)
  const recent = shallowRef<TutorConversation[]>([])
  const sending = ref(false)
  const canSpeak = ref(false)
  const voiceReplies = useLocalStorage('lf-tutor-voice', false)
  const review = shallowRef<OutputReview | null>(null)
  const reviewedText = ref('')
  const reviewing = ref(false)

  const targets = computed(() => {
    const names = conversation.value?.targets
    if (names) return names.flatMap((name) => entries.value.find((entry) => entry.text === name) ?? [])
    return pickTargets(entries.value)
  })
  const usedTargets = computed(() => usedTargetsOf(conversation.value))

  const showError = (error: unknown) => {
    const code = error instanceof AiRequestError ? error.code : 'failed'
    notify(t(`enrich.errors.${code}`), { tone: 'error' })
  }

  function canSpend(): boolean {
    const enrichment = useEnrichmentStore()
    if (enrichment.budgetLeft()) return true
    notify(t('enrich.errors.budget'), { tone: 'error' })
    return false
  }
  const spend = (usage: AiUsage) => useEnrichmentStore().spend(usage)

  async function load() {
    const decks = await deckRepository.list()
    deck.value = decks.find((candidate) => candidate.schema.languageFeatures) ?? null
    entries.value = deck.value ? await entryRepository.listByDeck(deck.value.id) : []
    recent.value = await tutorRepository.recentConversations(RECENT_LIMIT)
    canSpeak.value = await canSpeakEnglish()
  }

  async function persist(next: TutorConversation) {
    const updated = { ...next, updatedAt: new Date().toISOString() }
    conversation.value = updated
    await tutorRepository.saveConversation(updated).catch((error) => console.error(error))
  }

  /** Marks progress for the targets used, and refreshes them so the page shows the new status. */
  async function creditTargets(names: string[]) {
    const ids = names.flatMap((name) => entries.value.find((entry) => entry.text === name)?.id ?? [])
    if (!ids.length || !deck.value) return
    await entryRepository.markUsedInOutput(ids).catch((error) => console.error(error))
    entries.value = await entryRepository.listByDeck(deck.value.id)
  }

  /** Gets the tutor's next line. Returns false if it failed, leaving the conversation as it was. */
  async function takeTurn(current: TutorConversation): Promise<boolean> {
    const asked = targets.value
    const { turn, usage } = await requestTutorTurn({
      scenario: current.scenario,
      targets: targetPayload(asked),
      history: historyPayload(current),
    })
    spend(usage)
    const messages = [...current.messages]
    const last = messages.at(-1)
    if (last?.role === 'user') {
      messages[messages.length - 1] = {
        ...last,
        ...(turn.correction ? { correction: turn.correction } : {}),
        ...(turn.usedTargets.length ? { usedTargets: turn.usedTargets } : {}),
      }
    }
    messages.push({
      role: 'assistant',
      content: turn.reply,
      at: new Date().toISOString(),
      ...(turn.newExpression?.text ? { newExpression: turn.newExpression } : {}),
    })
    await persist({ ...current, messages })
    await creditTargets(turn.usedTargets)
    if (voiceReplies.value && canSpeak.value) speak(turn.reply)
    return true
  }

  async function start(scenario: ScenarioId) {
    if (sending.value || !canSpend()) return
    const fresh: TutorConversation = {
      id: nanoid(),
      scenario,
      targets: pickTargets(entries.value).map((entry) => entry.text),
      messages: [],
      updatedAt: new Date().toISOString(),
    }
    conversation.value = fresh
    sending.value = true
    try {
      await takeTurn(fresh)
    } catch (error) {
      showError(error)
      conversation.value = null
    } finally {
      sending.value = false
    }
  }

  /** Sends a line. Returns false if it failed, so the page keeps what was typed. */
  async function send(text: string): Promise<boolean> {
    const current = conversation.value
    const content = text.trim()
    if (!current || !content || sending.value || !canSpend()) return false
    const withLine: TutorConversation = {
      ...current,
      messages: [...current.messages, { role: 'user', content, at: new Date().toISOString() }],
    }
    conversation.value = withLine
    sending.value = true
    try {
      return await takeTurn(withLine)
    } catch (error) {
      showError(error)
      conversation.value = current
      return false
    } finally {
      sending.value = false
    }
  }

  async function finish() {
    stopSpeaking()
    conversation.value = null
    await load()
  }

  function resume(item: TutorConversation) {
    conversation.value = item
  }

  async function removeConversation(id: string) {
    await tutorRepository.removeConversation(id).catch((error) => console.error(error))
    recent.value = recent.value.filter((item) => item.id !== id)
  }

  async function markSaved(index: number) {
    const current = conversation.value
    if (!current) return
    const messages = current.messages.map((message, i) => (i === index ? { ...message, saved: true } : message))
    await persist({ ...current, messages })
  }

  /** Saves a corrected mistake: to review as an expression, and to the list of mistakes. */
  async function saveMistake(index: number) {
    const message: TutorMessage | undefined = conversation.value?.messages[index]
    const correction = message?.correction
    if (!message || !correction || !deck.value || message.saved) return
    const phrase = correction.keyPhrase.trim() || correction.natural.trim()
    try {
      const saved = await saveCapture({ text: phrase, sentence: correction.natural }, phrase, deck.value, {}, 'Own mistake')
      const entry = await entryRepository.findByText(deck.value.id, normalizeText(phrase))
      await tutorRepository.addMistake({
        id: nanoid(),
        error: message.content,
        correction: correction.natural,
        ...(correction.reason ? { explanation: correction.reason } : {}),
        ...(entry ? { entryId: entry.id } : {}),
        createdAt: new Date().toISOString(),
      })
      await markSaved(index)
      notify(t('tutor.savedToast', { name: saved.name }))
    } catch (error) {
      console.error(error)
      notify(t('errors.save'), { tone: 'error' })
    }
  }

  async function saveExpression(index: number) {
    const message = conversation.value?.messages[index]
    const expression = message?.newExpression
    if (!message || !expression || !deck.value || message.saved) return
    try {
      const saved = await saveCapture({ text: expression.text, sentence: message.content }, expression.text, deck.value, {}, 'Conversation')
      await markSaved(index)
      notify(t('tutor.savedToast', { name: saved.name }))
    } catch (error) {
      console.error(error)
      notify(t('errors.save'), { tone: 'error' })
    }
  }

  /** Reviews the daily task. The targets used well count as real output. */
  async function submitOutput(text: string) {
    if (reviewing.value || !canSpend()) return
    reviewing.value = true
    try {
      const { review: result, usage } = await requestOutputReview({ targets: targetPayload(pickTargets(entries.value)), text })
      spend(usage)
      review.value = result
      reviewedText.value = text
      await creditTargets(result.items.filter((item) => item.correct).map((item) => item.text))
    } catch (error) {
      showError(error)
    } finally {
      reviewing.value = false
    }
  }

  function clearReview() {
    review.value = null
    reviewedText.value = ''
  }

  return {
    conversation,
    recent,
    targets,
    usedTargets,
    sending,
    canSpeak,
    voiceReplies,
    review,
    reviewedText,
    reviewing,
    load,
    start,
    send,
    finish,
    resume,
    removeConversation,
    saveMistake,
    saveExpression,
    submitOutput,
    clearReview,
  }
})
