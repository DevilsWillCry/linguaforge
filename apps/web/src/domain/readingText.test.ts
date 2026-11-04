import { describe, expect, it } from 'vitest'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA } from './deckPresets'
import { findSentence, readingParagraphs, readingStats, splitSentences, textSample } from './readingText'
import { createEntry } from './rows'
import type { Deck } from './types'

const NOW = new Date('2026-11-04T12:00:00Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: NOW.toISOString() }

describe('splitSentences', () => {
  it('splits a paragraph, and keeps decimals together', () => {
    expect(splitSentences('It costs 3.5 dollars. Is that all? Yes!')).toEqual(['It costs 3.5 dollars.', 'Is that all?', 'Yes!'])
  })
})

describe('reading a text', () => {
  const library = [createEntry(deck, 'Figure out', NOW), createEntry(deck, 'Borrow', NOW)]
  const paragraphs = readingParagraphs(['We figured out the bug. Then we left.', 'Can I borrow it?'], library)

  it('keeps paragraphs and sentences, and marks Library items', () => {
    expect(paragraphs.map((p) => p.length)).toEqual([2, 1])
    expect(paragraphs[0]![0]!.segments.find((s) => s.entry)?.text).toBe('figured out')
  })

  it('counts the words and items it recognizes', () => {
    expect(readingStats(paragraphs)).toEqual({ words: 12, libraryWords: 3, items: 2 })
  })

  it('counts each item once, however often it appears', () => {
    expect(readingStats(readingParagraphs(['Borrow it. Borrow it again.'], library)).items).toBe(1)
  })

  it('finds the sentence for a typed capture', () => {
    expect(findSentence(paragraphs, 'THE BUG')).toBe('We figured out the bug.')
    expect(findSentence(paragraphs, 'absent')).toBe('')
    expect(findSentence(paragraphs, '  ')).toBe('')
  })
})

describe('textSample', () => {
  it('stops on a whole sentence within the limit', () => {
    expect(textSample(['One two. Three four. Five six.'], 20)).toBe('One two. Three four.')
  })
  it('cuts a single very long sentence rather than sending nothing', () => {
    expect(textSample(['x'.repeat(50)], 10)).toHaveLength(10)
  })
})
