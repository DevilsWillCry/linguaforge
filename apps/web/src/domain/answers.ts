import { normalizeText } from './text'

export type AnswerResult = 'correct' | 'close' | 'wrong'

const WORD = /[\p{L}\p{N}'’]+/gu

const wordsOf = (text: string) => (text.toLowerCase().replace(/’/g, "'").match(WORD) ?? []) as string[]

/** Reduces a word to a rough stem, so "figured" and "figures" both match "figure". */
function stem(word: string): string {
  const base = word.replace(/(ing|ied|ies|ed|es|s|d)$/, '')
  return base.length >= 3 ? base.replace(/(.)\1$/, '$1').replace(/e$/, '') : word
}

const sameWord = (a: string, b: string) => a === b || stem(a) === stem(b)

/** Edits needed to turn one text into the other, to tell a typo from a wrong answer. */
function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i]
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(next[j - 1]! + 1, row[j]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    row = next
  }
  return row[b.length]!
}

/** Compares a typed answer with the expected one, ignoring case and final punctuation. */
export function checkAnswer(expected: string, typed: string): AnswerResult {
  const [want, got] = [normalizeText(expected), normalizeText(typed)]
  if (!got) return 'wrong'
  if (want === got || wordsOf(want).join(' ') === wordsOf(got).join(' ')) return 'correct'

  const [wantWords, gotWords] = [wordsOf(want), wordsOf(got)]
  if (wantWords.length === gotWords.length && wantWords.every((word, i) => sameWord(word, gotWords[i]!))) return 'close'
  return editDistance(want, got) <= Math.floor(want.length * 0.15) ? 'close' : 'wrong'
}

/** The grade to suggest. The user can still choose another. */
export const suggestedRating = (result: AnswerResult) => ({ correct: 3, close: 2, wrong: 1 })[result] as 1 | 2 | 3

export interface ClozePart {
  text: string
  hidden: boolean
}

/**
 * Splits a sentence around every use of the target, allowing for inflection. Returns null if
 * the target isn't there as consecutive words, as in "figure this bug out".
 */
export function makeCloze(sentence: string, target: string): { parts: ClozePart[]; answer: string } | null {
  const targetWords = wordsOf(target)
  if (!targetWords.length) return null
  const tokens = [...sentence.matchAll(WORD)]
  const parts: ClozePart[] = []
  let answer = ''
  let cursor = 0

  for (let i = 0; i + targetWords.length <= tokens.length; i += 1) {
    const window = tokens.slice(i, i + targetWords.length)
    if (!window.every((token, j) => sameWord(token[0].toLowerCase().replace(/’/g, "'"), targetWords[j]!))) continue
    const start = window[0]!.index
    const last = window.at(-1)!
    const end = last.index + last[0].length
    if (start > cursor) parts.push({ text: sentence.slice(cursor, start), hidden: false })
    const surface = sentence.slice(start, end)
    parts.push({ text: surface, hidden: true })
    answer ||= surface
    cursor = end
    i += targetWords.length - 1
  }
  if (!answer) return null
  if (cursor < sentence.length) parts.push({ text: sentence.slice(cursor), hidden: false })
  return { parts, answer }
}

/** Hides the target in a text shown as a prompt, so the question doesn't give away the answer. */
export function redactTarget(text: string, target: string): string {
  const cloze = makeCloze(text, target)
  return cloze ? cloze.parts.map((part) => (part.hidden ? '_____' : part.text)).join('') : text
}
