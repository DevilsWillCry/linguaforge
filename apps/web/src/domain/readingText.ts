import { wordsOf } from './answers'
import { buildPhraseIndex, segmentLine, type LineSegment } from './transcriptWords'
import type { Entry } from './types'

const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' })

/** Uses the browser's own rules, which already know about "Dr." and "3.5". */
export function splitSentences(paragraph: string): string[] {
  return [...sentenceSegmenter.segment(paragraph)].map(({ segment }) => segment.trim()).filter(Boolean)
}

export interface ReadingSentence {
  text: string
  segments: LineSegment[]
}

export function readingParagraphs(paragraphs: readonly string[], library: readonly Entry[]): ReadingSentence[][] {
  const index = buildPhraseIndex(library)
  return paragraphs.map((paragraph) =>
    splitSentences(paragraph).map((text) => ({ text, segments: segmentLine(text, index) })),
  )
}

/** How much of the text the reader can already recognize from their Library. */
export function readingStats(paragraphs: readonly ReadingSentence[][]) {
  const items = new Set<string>()
  let words = 0
  let libraryWords = 0
  for (const sentence of paragraphs.flat()) {
    for (const segment of sentence.segments) {
      if (!segment.isWord) continue
      const count = wordsOf(segment.text).length
      words += count
      if (segment.entry) {
        libraryWords += count
        items.add(segment.entry.id)
      }
    }
  }
  return { words, libraryWords, items: items.size }
}

/** The first sentence using this text, so a typed capture still gets its real example. */
export function findSentence(paragraphs: readonly ReadingSentence[][], text: string): string {
  const needle = text.trim().toLowerCase()
  if (!needle) return ''
  return paragraphs.flat().find((sentence) => sentence.text.toLowerCase().includes(needle))?.text ?? ''
}

/** The start of the text, up to `limit` characters, ending on a whole sentence. */
export function textSample(paragraphs: readonly string[], limit: number): string {
  let sample = ''
  for (const sentence of paragraphs.flatMap(splitSentences)) {
    if (sample.length + sentence.length > limit) break
    sample += `${sentence} `
  }
  return (sample || paragraphs.join(' ').slice(0, limit)).trim()
}
