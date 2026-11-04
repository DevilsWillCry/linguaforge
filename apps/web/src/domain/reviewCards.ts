import { makeCloze, redactTarget, type ClozePart } from './answers'
import type { Deck, Entry, ReviewMode } from './types'

export type ReviewCard =
  | { mode: 'cloze'; parts: ClozePart[]; answer: string; hint: string[] }
  | { mode: 'production'; clues: string[]; answer: string }
  | { mode: 'listening'; speech: string; answer: string }
  | { mode: 'useIt'; target: string; meanings: string[] }

/** Long enough to hold in memory after hearing it once or twice. */
const MAX_LISTENING_WORDS = 20

/** The order modes rotate in, from recognizing the item to producing it. */
const MODE_ORDER: ReviewMode[] = ['cloze', 'production', 'listening', 'useIt']

const examplesOf = (entry: Entry) => [...entry.realExamples, ...entry.ownExamples]

/** Varies with the review count, so a card doesn't always show the same sentence. */
const pick = <T>(items: readonly T[], entry: Entry): T | undefined =>
  items.length ? items[entry.srs.reps % items.length] : undefined

function clozeOptions(entry: Entry) {
  return examplesOf(entry).flatMap((sentence) => makeCloze(sentence, entry.text) ?? [])
}

function listeningOptions(entry: Entry): string[] {
  const sentences = examplesOf(entry).filter(
    (sentence) =>
      !sentence.includes('\n') &&
      sentence.trim().split(/\s+/).length <= MAX_LISTENING_WORDS &&
      makeCloze(sentence, entry.text),
  )
  return sentences.length ? sentences : [entry.text]
}

const productionClues = (entry: Entry) =>
  (entry.meanings.length ? entry.meanings : [entry.custom.whatItDoes ?? '']).filter(Boolean)

/** The modes this entry has the material for. Other decks only have production. */
export function modesFor(entry: Entry, deck: Deck, { canSpeak }: { canSpeak: boolean }): ReviewMode[] {
  const hasClues = productionClues(entry).length > 0
  if (!deck.schema.languageFeatures) return hasClues ? ['production'] : []
  return MODE_ORDER.filter((mode) => {
    if (mode === 'cloze') return clozeOptions(entry).length > 0
    if (mode === 'production') return hasClues
    if (mode === 'listening') return canSpeak
    return hasClues
  })
}

/** The next mode after the last one used, so the same item is tested in different ways. */
export function chooseMode(available: readonly ReviewMode[], lastMode: ReviewMode | undefined): ReviewMode | undefined {
  if (!lastMode) return available[0]
  const position = MODE_ORDER.indexOf(lastMode)
  const after = MODE_ORDER.slice(position + 1).concat(MODE_ORDER.slice(0, position + 1))
  return after.find((mode) => available.includes(mode))
}

/** Builds the question. Nothing in it may reveal the answer before the user tries. */
export function buildCard(entry: Entry, mode: ReviewMode): ReviewCard {
  const clues = productionClues(entry)
  if (mode === 'cloze') {
    const cloze = pick(clozeOptions(entry), entry)!
    return { mode, parts: cloze.parts, answer: cloze.answer, hint: clues.map((clue) => redactTarget(clue, entry.text)) }
  }
  if (mode === 'listening') {
    const speech = pick(listeningOptions(entry), entry)!
    return { mode, speech, answer: speech }
  }
  if (mode === 'useIt') return { mode, target: entry.text, meanings: clues }
  return { mode: 'production', clues: clues.map((clue) => redactTarget(clue, entry.text)), answer: entry.text }
}

/** Whether a card can be reviewed at all in this deck. */
export const isReviewable = (entry: Entry, deck: Deck, canSpeak: boolean) =>
  modesFor(entry, deck, { canSpeak }).length > 0
