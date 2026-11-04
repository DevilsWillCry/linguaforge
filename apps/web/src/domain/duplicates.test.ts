import { describe, expect, it } from 'vitest'
import seed from '@/data/seed/seed-data.json'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_DECK_ID, VUE_SCHEMA } from './deckPresets'
import { areNearDuplicates, findDuplicatePairs, mergeEntries, pairKey } from './duplicates'
import { createEntry, rowsToEntries, type RawRow } from './rows'
import { normalizeText } from './text'
import type { Deck, Entry } from './types'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: '' }
const vueDeck: Deck = { id: VUE_DECK_ID, name: 'Vue', schema: VUE_SCHEMA, createdAt: '' }
const near = (a: string, b: string) => areNearDuplicates(normalizeText(a), normalizeText(b))
const entry = (text: string, overrides: Partial<Entry> = {}) => createEntry(deck, text, NOW, overrides)

describe('areNearDuplicates', () => {
  it.each([
    ['figure out', 'figured out'],
    ['figure out', 'figuring out'],
    ['figure out', 'figures out'],
    ['run into', 'running into'],
    ['By the way...', 'by the way'],
    ['Disbilief', 'Disbelief'],
  ])('matches %s and %s', (a, b) => {
    expect(near(a, b)).toBe(true)
  })

  it.each([
    ['may', 'way'],
    ['figure out', 'find out'],
    ['by the way', 'no way'],
    ['v-if', 'v-on'],
    ['Props', 'Slots'],
  ])('does not match %s and %s', (a, b) => {
    expect(near(a, b)).toBe(false)
  })
})

describe('findDuplicatePairs', () => {
  it('finds no false positives in the seed data', () => {
    expect(findDuplicatePairs(rowsToEntries(seed.english as RawRow[], deck, NOW))).toEqual([])
    expect(findDuplicatePairs(rowsToEntries(seed.vue3 as RawRow[], vueDeck, NOW))).toEqual([])
  })

  it('finds a pair and skips it once dismissed', () => {
    const a = entry('figure out')
    const b = entry('figured out')
    const [pair] = findDuplicatePairs([a, b, entry('borrow')])
    expect(pair?.key).toBe(pairKey(a.id, b.id))
    expect(findDuplicatePairs([a, b], new Set([pairKey(b.id, a.id)]))).toEqual([])
  })
})

describe('mergeEntries', () => {
  const keep = entry('figure out', {
    priority: 2,
    meanings: ['to understand'],
    variations: ['work out'],
    tags: ['work'],
    enrichment: 'empty',
    custom: { a: 'keep' },
    createdAt: '2026-02-01T00:00:00.000Z',
  })
  const other = entry('figured out', {
    priority: 5,
    tone: 'Casual',
    meanings: ['To Understand', 'to solve'],
    ownExamples: ['I figured it out'],
    tags: ['tech'],
    enrichment: 'confirmed',
    notes: 'from video',
    importance: 'Critical',
    source: { title: 'Clip', videoId: 'abc' },
    custom: { a: 'other', b: 'other' },
    createdAt: '2026-01-15T00:00:00.000Z',
  })

  it('joins lists without repeating items, ignoring case', () => {
    const merged = mergeEntries(keep, other, NOW)
    expect(merged.meanings).toEqual(['to understand', 'to solve'])
    expect(merged.tags).toEqual(['work', 'tech'])
    expect(merged.ownExamples).toEqual(['I figured it out'])
  })

  it('keeps the other text as a variation', () => {
    expect(mergeEntries(keep, other, NOW).variations).toEqual(['work out', 'figured out'])
  })

  it('does not add a variation that only differs in punctuation', () => {
    const merged = mergeEntries(entry('by the way'), entry('By the way...'), NOW)
    expect(merged.variations).toEqual([])
  })

  it('fills blanks from the other entry and keeps the identity of the first', () => {
    const merged = mergeEntries(keep, other, NOW)
    expect(merged).toMatchObject({
      id: keep.id,
      text: 'figure out',
      tone: 'Casual',
      notes: 'from video',
      importance: 'Critical',
      source: { title: 'Clip', videoId: 'abc' },
      custom: { a: 'keep', b: 'other' },
    })
  })

  it('takes the highest priority, oldest date and furthest enrichment', () => {
    const merged = mergeEntries(keep, other, NOW)
    expect(merged.priority).toBe(5)
    expect(merged.createdAt).toBe('2026-01-15T00:00:00.000Z')
    expect(merged.enrichment).toBe('confirmed')
  })

  it('keeps the review history that went further, so progress is never reset', () => {
    const advanced = entry('figured out', {
      status: 'Familiar',
      srs: { ...keep.srs, reps: 9, stability: 30 },
    })
    const merged = mergeEntries(keep, advanced, NOW)
    expect(merged.srs.reps).toBe(9)
    expect(merged.status).toBe('Familiar')
  })

  it('adds up correct answers per mode', () => {
    const a = entry('a', { stats: { correctByMode: { cloze: 2, useIt: 1 } } })
    const b = entry('b', { stats: { correctByMode: { cloze: 3, reverse: 1 } } })
    expect(mergeEntries(a, b, NOW).stats.correctByMode).toEqual({ cloze: 5, useIt: 1, reverse: 1 })
  })
})
