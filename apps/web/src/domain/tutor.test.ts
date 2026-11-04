import { describe, expect, it } from 'vitest'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA } from './deckPresets'
import { createEntry } from './rows'
import { historyPayload, pickTargets, targetPayload, usedTargetsOf, wordCount } from './tutor'
import type { Deck, Entry, TutorConversation } from './types'

const NOW = new Date('2026-11-04T12:00:00Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: NOW.toISOString() }
const card = (text: string, overrides: Partial<Entry> = {}) =>
  createEntry(deck, text, NOW, { id: text, enrichment: 'confirmed', meanings: ['m'], ...overrides })
const later = (stability: number) => ({ ...card('x').srs, due: '2026-12-01T00:00:00.000Z', stability })

describe('pickTargets', () => {
  it('takes due items first, by priority, then the least settled', () => {
    const picked = pickTargets([
      card('settled', { srs: later(50) }),
      card('shaky', { srs: later(2) }),
      card('low', { priority: 1 }),
      card('high', { priority: 5 }),
    ], NOW)
    expect(picked.map((e) => e.id)).toEqual(['high', 'low', 'shaky', 'settled'])
  })

  it('leaves out unconfirmed items and those with no meaning', () => {
    expect(pickTargets([card('draft', { enrichment: 'draft' }), card('blank', { meanings: [] })], NOW)).toEqual([])
  })

  it('stops at five', () => {
    expect(pickTargets(['a', 'b', 'c', 'd', 'e', 'f'].map((t) => card(t)), NOW)).toHaveLength(5)
  })
})

describe('payloads', () => {
  it('sends only the text and first meaning of a target', () => {
    const entry = card('Borrow', { meanings: ['First', 'Second'], notes: 'private', ownExamples: ['private'] })
    expect(targetPayload([entry])).toEqual([{ text: 'Borrow', meaning: 'First' }])
  })

  it('keeps the latest lines within the server limit, and only their words', () => {
    const conversation: TutorConversation = {
      id: 'c', scenario: 'standup', updatedAt: '',
      messages: Array.from({ length: 45 }, (_, i) => ({ role: 'user' as const, content: `line ${i}`, at: '', usedTargets: ['x'] })),
    }
    const payload = historyPayload(conversation)
    expect(payload).toHaveLength(40)
    expect(payload[0]).toEqual({ role: 'user', content: 'line 5' })
  })
})

describe('usedTargetsOf', () => {
  it('gathers targets from the whole conversation', () => {
    const conversation = {
      id: 'c', scenario: 's', updatedAt: '',
      messages: [
        { role: 'user' as const, content: 'a', at: '', usedTargets: ['One'] },
        { role: 'assistant' as const, content: 'b', at: '' },
        { role: 'user' as const, content: 'c', at: '', usedTargets: ['One', 'Two'] },
      ],
    }
    expect([...usedTargetsOf(conversation)]).toEqual(['One', 'One', 'Two'].filter((v, i, a) => a.indexOf(v) === i))
    expect(usedTargetsOf(null).size).toBe(0)
  })
})

describe('wordCount', () => {
  it('counts words', () => {
    expect([wordCount(''), wordCount('  one  two\nthree ')]).toEqual([0, 3])
  })
})
