import { describe, expect, it } from 'vitest'
import seed from '@/data/seed/seed-data.json'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_DECK_ID, VUE_SCHEMA } from './deckPresets'
import {
  DEFAULT_SORT,
  activeFilterCount,
  emptyFilters,
  isDueToday,
  matchesFilters,
  sortEntries,
  toggleSort,
  type LibraryFilters,
} from './libraryQuery'
import { rowsToEntries, type RawRow } from './rows'
import type { Deck } from './types'

const NOW = new Date('2026-01-01T12:00:00.000Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: '' }
const vueDeck: Deck = { id: VUE_DECK_ID, name: 'Vue', schema: VUE_SCHEMA, createdAt: '' }
const english = rowsToEntries(seed.english as RawRow[], deck, NOW)
const vue = rowsToEntries(seed.vue3 as RawRow[], vueDeck, NOW)

const texts = (filters: Partial<LibraryFilters>, entries = english) =>
  entries
    .filter((entry) => matchesFilters(entry, { ...emptyFilters(), ...filters }, NOW))
    .map((entry) => entry.text)

describe('search', () => {
  it('finds text inside examples, not just the headword', () => {
    expect(texts({ search: 'firewall' })).toEqual(['By the way...'])
  })

  it('requires every word, in any order', () => {
    expect(texts({ search: 'math figure' })).toEqual(['Figure out'])
    expect(texts({ search: 'math elections' })).toEqual([])
  })

  it('ignores case and accents', () => {
    expect(texts({ search: 'LOGICA' }, vue)).toEqual(['Single File Component (SFC)', 'Composables'])
  })

  it('searches custom deck fields', () => {
    expect(texts({ search: 'useMemo' }, vue)).toEqual(['computed()'])
  })

  it('returns everything for a blank search', () => {
    expect(texts({ search: '   ' })).toHaveLength(12)
  })
})

describe('filters', () => {
  it('allows any selected value within a filter', () => {
    expect(texts({ kinds: ['Connector', 'Phrasal Verb'] })).toEqual(['Figure out', 'By the way...'])
  })

  it('requires a match across different filters', () => {
    expect(texts({ statuses: ['Learning'], tones: ['Informal'] })).toEqual(["I'm down"])
  })

  it('filters by priority without treating 0 as unset', () => {
    expect(texts({ priorities: [0] })).toHaveLength(8)
    expect(texts({ priorities: [5] })).toEqual(["There's no way..."])
  })

  it('filters by importance', () => {
    expect(texts({ importance: ['Critical'] }, vue)).toEqual(['Composition vs Options API'])
  })

  it('filters by source title or trigger', () => {
    expect(texts({ source: 'common english idioms' })).toEqual(['By the way...'])
    expect(texts({ source: 'ia tool' })).toHaveLength(4)
  })

  it('filters by tag', () => {
    const tagged = [{ ...english[0]!, tags: ['work'] }, english[1]!]
    expect(texts({ tags: ['work'] }, tagged)).toEqual(['Figure out'])
  })

  it('leaves entries awaiting enrichment out of due today', () => {
    expect(texts({ dueToday: true })).toHaveLength(4)
  })

  it('counts cards due later today as due, and tomorrow as not', () => {
    const entry = english[0]!
    const dueAt = (iso: string) => ({ ...entry, srs: { ...entry.srs, due: iso } })
    const today = new Date(2026, 0, 1, 12)
    expect(isDueToday(dueAt(new Date(2026, 0, 1, 22).toISOString()), today)).toBe(true)
    expect(isDueToday(dueAt(new Date(2026, 0, 2, 1).toISOString()), today)).toBe(false)
  })

  it('counts how many filters are active', () => {
    expect(activeFilterCount(emptyFilters())).toBe(0)
    expect(activeFilterCount({ ...emptyFilters(), search: 'a', kinds: ['Word'], dueToday: true })).toBe(3)
  })
})

describe('toggleSort', () => {
  it('moves through ascending, descending, then off', () => {
    const asc = toggleSort([], 'tone', false)
    expect(asc).toEqual([{ key: 'tone', desc: false }])
    const desc = toggleSort(asc, 'tone', false)
    expect(desc).toEqual([{ key: 'tone', desc: true }])
    expect(toggleSort(desc, 'tone', false)).toEqual([])
  })

  it('replaces other columns on a plain click', () => {
    expect(toggleSort(DEFAULT_SORT, 'tone', false)).toEqual([{ key: 'tone', desc: false }])
  })

  it('adds a column on shift+click', () => {
    const sort = toggleSort([{ key: 'kind', desc: false }], 'tone', true)
    expect(sort.map((s) => s.key)).toEqual(['kind', 'tone'])
  })

  it('removes only that column when shift+click turns it off', () => {
    const sort = [{ key: 'kind', desc: false }, { key: 'tone', desc: true }]
    expect(toggleSort(sort, 'tone', true)).toEqual([{ key: 'kind', desc: false }])
  })
})

describe('sortEntries', () => {
  it('sorts by priority and then alphabetically by default', () => {
    expect(sortEntries(english, DEFAULT_SORT, deck).slice(0, 3).map((e) => e.text)).toEqual([
      "There's no way...",
      'By the way...',
      'Figure out',
    ])
  })

  it('keeps blank cells last in both directions', () => {
    for (const desc of [false, true]) {
      const sorted = sortEntries(english, [{ key: 'tone', desc }], deck)
      expect(sorted.at(-1)?.tone).toBe('')
      expect(sorted[0]?.tone).not.toBe('')
    }
  })

  it('sorts by a custom field', () => {
    const sorted = sortEntries(vue, [{ key: 'category', desc: false }], vueDeck)
    expect(sorted[0]?.custom.category).toBe('API Calls')
  })

  it('does not change the original array', () => {
    const before = english.map((e) => e.id)
    sortEntries(english, [{ key: 'text', desc: true }], deck)
    expect(english.map((e) => e.id)).toEqual(before)
  })
})
