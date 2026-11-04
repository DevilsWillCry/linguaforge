import { sameWord, wordsOf } from './answers'
import type { Entry } from './types'

const WORD = /[\p{L}\p{N}'’]+/gu

export interface LineSegment {
  text: string
  /** A word the user can capture. Spaces and punctuation are false. */
  isWord: boolean
  /** The Library entry this word or phrase belongs to. */
  entry?: Entry
}

export interface PhraseIndex {
  /** Candidate entries by the first letters of their first word, for speed on long transcripts. */
  byPrefix: Map<string, { words: string[]; entry: Entry }[]>
}

const prefixOf = (word: string) => word.slice(0, 2)

export function buildPhraseIndex(entries: readonly Entry[]): PhraseIndex {
  const byPrefix: PhraseIndex['byPrefix'] = new Map()
  for (const entry of entries) {
    const words = wordsOf(entry.text)
    if (!words.length) continue
    const key = prefixOf(words[0]!)
    const list = byPrefix.get(key) ?? []
    list.push({ words, entry })
    byPrefix.set(key, list)
  }
  // The longest phrase wins, so "figure out" is found before a separate "figure".
  for (const list of byPrefix.values()) list.sort((a, b) => b.words.length - a.words.length)
  return { byPrefix }
}

/** Splits a line into words and the rest, marking every word or phrase that is in the Library. */
export function segmentLine(text: string, index: PhraseIndex): LineSegment[] {
  const tokens = [...text.matchAll(WORD)]
  const segments: LineSegment[] = []
  let cursor = 0

  const pushGap = (end: number) => {
    if (end > cursor) segments.push({ text: text.slice(cursor, end), isWord: false })
  }

  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i]!
    const word = token[0].toLowerCase().replace(/’/g, "'")
    const match = index.byPrefix.get(prefixOf(word))?.find(({ words }) =>
      words.every((expected, j) => {
        const candidate = tokens[i + j]?.[0].toLowerCase().replace(/’/g, "'")
        return candidate !== undefined && sameWord(candidate, expected)
      }),
    )
    const length = match?.words.length ?? 1
    const last = tokens[i + length - 1]!
    const end = last.index + last[0].length
    pushGap(token.index)
    segments.push({ text: text.slice(token.index, end), isWord: true, ...(match ? { entry: match.entry } : {}) })
    cursor = end
    i += length
  }
  pushGap(text.length)
  return segments
}

/** Words to hide in cloze practice: Library items first, or else the longest word in the line. */
export function clozeTargets(segments: readonly LineSegment[]): Set<number> {
  const library = segments.flatMap((segment, i) => (segment.entry ? [i] : []))
  if (library.length) return new Set(library)
  let best = -1
  segments.forEach((segment, i) => {
    if (segment.isWord && segment.text.length >= 4 && (best < 0 || segment.text.length > segments[best]!.text.length)) best = i
  })
  return new Set(best >= 0 ? [best] : [])
}

export type DiffKind = 'same' | 'missing' | 'extra'

export interface DiffWord {
  word: string
  kind: DiffKind
}

/** A word-by-word comparison for dictation, using the longest common subsequence. */
export function diffWords(expected: string, typed: string): { words: DiffWord[]; score: number } {
  const [a, b] = [wordsOf(expected), wordsOf(typed)]
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }
  const words: DiffWord[] = []
  let [i, j] = [0, 0]
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      words.push({ word: a[i]!, kind: 'same' })
      i += 1
      j += 1
    } else if (j >= b.length || (i < a.length && table[i + 1]![j]! >= table[i]![j + 1]!)) {
      words.push({ word: a[i]!, kind: 'missing' })
      i += 1
    } else {
      words.push({ word: b[j]!, kind: 'extra' })
      j += 1
    }
  }
  const matched = words.filter((word) => word.kind === 'same').length
  const total = Math.max(a.length, b.length)
  return { words, score: total ? Math.round((matched / total) * 100) : 0 }
}
