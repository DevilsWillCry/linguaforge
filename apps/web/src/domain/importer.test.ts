import { describe, expect, it } from 'vitest'
import seed from '@/data/seed/seed-data.json'
import { toAnkiText } from './anki'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_DECK_ID, VUE_SCHEMA } from './deckPresets'
import { autoMapHeaders, canImport, guessDeck, planImport, remapRows, unmappedHeaders } from './importer'
import { createEntry, rowsToEntries, type RawRow } from './rows'
import type { Deck } from './types'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: '' }
const vueDeck: Deck = { id: VUE_DECK_ID, name: 'Vue', schema: VUE_SCHEMA, createdAt: '' }

describe('autoMapHeaders', () => {
  it('maps every column of the seed layout', () => {
    const mapping = autoMapHeaders(Object.keys(seed.english[0]!), deck.schema)
    expect(Object.values(mapping).every(Boolean)).toBe(true)
  })

  it('recognizes "Columna 1" from the original sheet as priority', () => {
    expect(autoMapHeaders(['Columna 1', 'Setence/Word'], deck.schema).priority).toBe('Columna 1')
  })

  it('ignores case and spacing', () => {
    expect(autoMapHeaders(['  emotional   TONE '], deck.schema).tone).toBe('  emotional   TONE ')
  })

  it('leaves unmatched fields blank and reports unused headers', () => {
    const headers = ['Setence/Word', 'Mystery']
    const mapping = autoMapHeaders(headers, deck.schema)
    expect(mapping.tone).toBe('')
    expect(unmappedHeaders(headers, mapping)).toEqual(['Mystery'])
  })
})

describe('guessDeck', () => {
  it('picks the deck whose columns match', () => {
    const decks = [deck, vueDeck]
    expect(guessDeck(Object.keys(seed.english[0]!), decks)?.id).toBe(ENGLISH_DECK_ID)
    expect(guessDeck(Object.keys(seed.vue3[0]!), decks)?.id).toBe(VUE_DECK_ID)
    expect(guessDeck(['Nothing', 'Useful'], decks)).toBeNull()
  })
})

describe('canImport', () => {
  it('requires the text column', () => {
    expect(canImport(autoMapHeaders(['Setence/Word'], deck.schema), deck)).toBe(true)
    expect(canImport(autoMapHeaders(['Context'], deck.schema), deck)).toBe(false)
  })
})

describe('remapRows', () => {
  it('rewrites rows to use the deck columns', () => {
    const rows = remapRows(
      [{ Palabra: 'hello', Nivel: 3, Extra: 'x' }],
      { text: 'Palabra', priority: 'Nivel' },
      deck.schema,
    )
    expect(rows).toEqual([{ 'Setence/Word': 'hello', Priority: 3 }])
  })
})

describe('planImport', () => {
  it('imports the whole seed into an empty deck and skips blank rows', () => {
    const plan = planImport(seed.english as RawRow[], deck, [], NOW)
    expect(plan.toCreate).toHaveLength(12)
    expect(plan.blankRows).toBe(2)
    expect(plan.duplicates).toEqual([])
  })

  it('reports everything as duplicate when the data is already there', () => {
    const existing = rowsToEntries(seed.english as RawRow[], deck, NOW)
    const plan = planImport(seed.english as RawRow[], deck, existing, NOW)
    expect(plan.toCreate).toEqual([])
    expect(plan.duplicates).toHaveLength(12)
  })

  it('detects duplicates despite case and trailing punctuation', () => {
    const existing = [createEntry(deck, 'By the way...', NOW)]
    const plan = planImport([{ 'Setence/Word': 'BY THE WAY' }], deck, existing, NOW)
    expect(plan.duplicates[0]?.existing.id).toBe(existing[0]?.id)
  })

  it('keeps only the first of a row repeated within the file', () => {
    const plan = planImport(
      [{ 'Setence/Word': 'hello' }, { 'Setence/Word': 'Hello!' }],
      deck,
      [],
      NOW,
    )
    expect(plan.toCreate.map((e) => e.text)).toEqual(['hello'])
    expect(plan.repeatedInFile).toBe(1)
  })

  it('matches the corrected spelling of Disbilief', () => {
    const existing = [createEntry(deck, 'Disbelief', NOW)]
    const plan = planImport([{ 'Setence/Word': 'Disbilief' }], deck, existing, NOW)
    expect(plan.duplicates).toHaveLength(1)
  })
})

describe('toAnkiText', () => {
  const entries = rowsToEntries(seed.english as RawRow[], deck, NOW)
  const text = toAnkiText(entries, deck)
  const lines = text.split('\n')
  const cards = lines.filter((line) => !line.startsWith('#'))

  it('starts with the headers Anki reads', () => {
    expect(lines.slice(0, 4)).toEqual([
      '#separator:tab',
      '#html:true',
      '#deck:LinguaForge::English',
      '#tags column:3',
    ])
  })

  it('skips entries with no content yet', () => {
    expect(cards).toHaveLength(4)
    expect(text).not.toContain('Borrow')
  })

  it('makes every card one line with exactly three columns', () => {
    for (const card of cards) expect(card.split('\t')).toHaveLength(3)
  })

  it('escapes HTML so code shows as text', () => {
    const vue = rowsToEntries(seed.vue3 as RawRow[], vueDeck, NOW)
    const anki = toAnkiText(vue, vueDeck)
    expect(anki).toContain('&lt;template&gt;<br>&lt;script setup&gt;<br>&lt;style&gt;')
    expect(anki).not.toContain('<template>')
  })

  it('shows the meaning on the back and leaves out tracking columns', () => {
    const card = cards.find((c) => c.startsWith('Figure out'))!
    expect(card).toContain('To solve something.')
    expect(card).not.toContain('Review Status')
    expect(card).not.toContain('Priority')
  })

  it('writes tags without spaces', () => {
    const tagged = createEntry(deck, 'x', NOW, { enrichment: 'confirmed', meanings: ['y'], tags: ['small talk', 'work'] })
    expect(toAnkiText([tagged], deck).endsWith('\tsmall_talk work')).toBe(true)
  })
})
