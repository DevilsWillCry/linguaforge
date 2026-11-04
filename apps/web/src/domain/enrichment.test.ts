import { describe, expect, it } from 'vitest'
import { DECK_PRESETS, ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_SCHEMA } from './deckPresets'
import { mergeEntries } from './duplicates'
import { toAnkiText } from './anki'
import {
  appendOwnExample,
  canAutoEnrich,
  confirmPatch,
  draftCell,
  enrichmentRequest,
  feedbackTarget,
  initialCells,
  reviewFields,
} from './enrichment'
import { isDueToday } from './libraryQuery'
import { applyRowToEntry, createEntry, editPatch, entryToRow, fieldOf, quickAddEntry } from './rows'
import type { Deck, EnrichmentDraft, Entry } from './types'

const NOW = new Date('2026-11-04T12:00:00Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: NOW.toISOString() }
const vueDeck: Deck = { id: DECK_PRESETS[1].id, name: 'Vue', schema: VUE_SCHEMA, createdAt: NOW.toISOString() }

const DRAFT: EnrichmentDraft = {
  kind: 'Phrasal Verb',
  meanings: ['To understand — entender', 'To solve — resolver'],
  tone: 'Casual',
  context: 'Workplace',
  realExamples: ['I figured it out.'],
  variations: ['work out'],
  collocations: ['figure out a problem'],
  ipa: '/ˈfɪɡjər aʊt/',
  notes: 'Nota',
  priority: 5,
}

const draftEntry = (overrides: Partial<Entry> = {}) =>
  createEntry(deck, 'Figure out', NOW, { enrichment: 'draft', aiDraft: DRAFT, ...overrides })

const reviewedValues = (entry: Entry, own = '') => ({
  cells: initialCells(entry, deck, DRAFT),
  ownExamples: own,
  ipa: DRAFT.ipa,
  notes: DRAFT.notes,
})

describe('canAutoEnrich', () => {
  it('accepts a new entry in a language deck', () => {
    expect(canAutoEnrich(createEntry(deck, 'Borrow', NOW), deck)).toBe(true)
  })

  it('leaves non-language decks to the user', () => {
    expect(canAutoEnrich(createEntry(vueDeck, 'ref()', NOW), vueDeck)).toBe(false)
  })

  it.each(['pending', 'draft', 'confirmed'] as const)('skips an entry already %s', (enrichment) => {
    expect(canAutoEnrich(createEntry(deck, 'Borrow', NOW, { enrichment }), deck)).toBe(false)
  })

  it('skips a failed entry until the user retries, so it cannot keep spending credit', () => {
    expect(canAutoEnrich(createEntry(deck, 'Borrow', NOW, { aiError: 'refused' }), deck)).toBe(false)
  })

  it('skips a URL, which names no vocabulary', () => {
    expect(canAutoEnrich(quickAddEntry('https://example.com/post', deck, NOW), deck)).toBe(false)
  })
})

describe('enrichmentRequest', () => {
  it('sends only the text, a kind hint and the option lists', () => {
    const entry = createEntry(deck, 'Shall', NOW, {
      kind: 'Modal Verb',
      trigger: 'private trigger',
      source: { title: 'private title', url: 'https://private.example' },
      notes: 'private note',
    })
    const request = enrichmentRequest([entry], deck)
    expect(request.items).toEqual([{ id: entry.id, text: 'Shall', kindHint: 'Modal Verb' }])
    expect(JSON.stringify(request)).not.toContain('private')
    expect(request.options.tones).toContain('Casual')
  })

  it('leaves out a kind that says nothing', () => {
    const entry = createEntry(deck, 'By the way', NOW, { kind: 'N/A' })
    expect(enrichmentRequest([entry], deck).items[0]).not.toHaveProperty('kindHint')
  })
})

describe('reviewing a draft', () => {
  it('never offers AI text for the own examples field', () => {
    const own = fieldOf(deck, 'ownExamples')!
    expect(reviewFields(deck).map((f) => f.target)).not.toContain('ownExamples')
    expect(draftCell(DRAFT, own)).toBe('')
    // Even a draft carrying that field, as a misbehaving response might, is ignored.
    const hostile = { ...DRAFT, ownExamples: ['written by AI'] } as EnrichmentDraft
    expect(draftCell(hostile, own)).toBe('')
    const entry = draftEntry({ aiDraft: hostile })
    const patch = confirmPatch(entry, deck, reviewedValues(entry))
    expect(patch.ownExamples).toEqual([])
  })

  it('keeps what the user already typed over the draft', () => {
    const cells = initialCells(draftEntry({ meanings: ['Mine'], priority: 2, tone: 'Rude' }), deck, DRAFT)
    expect(cells.meanings).toBe('→ Mine')
    expect(cells.priority).toBe('2')
    expect(cells.tone).toBe('Rude')
    expect(cells.context).toBe('Workplace')
  })

  it('fills blanks and replaces the guessed kind from the draft', () => {
    const cells = initialCells(draftEntry({ kind: 'Word' }), deck, DRAFT)
    expect(cells.kind).toBe('Phrasal Verb')
    expect(cells.priority).toBe('5')
    expect(cells.meanings).toBe('→ To understand — entender\n→ To solve — resolver')
  })

  it('saves the reviewed values and discards the draft', () => {
    const entry = draftEntry()
    const values = reviewedValues(entry, '→ I figured out the bug')
    values.cells.tone = 'Formal'
    const merged = { ...entry, ...confirmPatch(entry, deck, values) }
    expect(merged.enrichment).toBe('confirmed')
    expect(merged.aiDraft).toBeUndefined()
    expect(merged.tone).toBe('Formal')
    expect(merged.meanings).toEqual(DRAFT.meanings)
    expect(merged.ownExamples).toEqual(['I figured out the bug'])
    expect(merged.ipa).toBe(DRAFT.ipa)
  })

  it('leaves the fields it does not review alone', () => {
    const entry = draftEntry({ status: 'Learning', trigger: 'Video', source: { title: 'A talk' } })
    const merged = { ...entry, ...confirmPatch(entry, deck, reviewedValues(entry)) }
    expect(merged.status).toBe('Learning')
    expect(merged.trigger).toBe('Video')
    expect(merged.source).toEqual({ title: 'A talk' })
    expect(merged.text).toBe('Figure out')
  })

  it('exports a confirmed entry in the normal columns', () => {
    const entry = draftEntry()
    const merged = { ...entry, ...confirmPatch(entry, deck, reviewedValues(entry)) }
    const row = entryToRow(merged, deck)
    expect(row['Meaning/Idea']).toBe('→ To understand — entender\n→ To solve — resolver')
    expect(row['Own Example']).toBe('')
    expect(row['Priority']).toBe(5)
  })
})

describe('appendOwnExample', () => {
  it('starts the list', () => {
    expect(appendOwnExample('', ' My sentence ')).toBe('→ My sentence')
  })

  it('adds to the list', () => {
    expect(appendOwnExample('→ First\n', 'Second')).toBe('→ First\n→ Second')
  })
})

describe('feedbackTarget', () => {
  it('uses the draft while the entry has no meanings of its own', () => {
    expect(feedbackTarget(draftEntry()).meanings).toEqual(DRAFT.meanings)
    expect(feedbackTarget(draftEntry({ meanings: ['Mine'] })).meanings).toEqual(['Mine'])
  })
})

describe('unconfirmed drafts stay out of studying', () => {
  it('is not due for review', () => {
    const entry = draftEntry({ srs: { ...createEntry(deck, 'x', NOW).srs, due: '2020-01-01T00:00:00.000Z' } })
    expect(isDueToday(entry, NOW)).toBe(false)
    expect(isDueToday({ ...entry, enrichment: 'confirmed' }, NOW)).toBe(true)
  })

  it('is left out of Anki exports', () => {
    const confirmed = createEntry(deck, 'Kept', NOW, { enrichment: 'confirmed', meanings: ['x'] })
    const text = toAnkiText([draftEntry(), confirmed], deck)
    expect(text).toContain('Kept')
    expect(text).not.toContain('Figure out')
  })

  it('does not put unreviewed AI text in spreadsheet exports', () => {
    expect(entryToRow(draftEntry(), deck)['Meaning/Idea']).toBe('')
  })
})

describe('the user acting while AI is working', () => {
  const pending = () => createEntry(deck, 'Such', NOW, { enrichment: 'pending' })

  it('typing content confirms the entry, so the late answer is ignored', () => {
    expect(editPatch(pending(), fieldOf(deck, 'meanings')!, '→ Mine').enrichment).toBe('confirmed')
  })

  it('importing content does the same', () => {
    const updated = applyRowToEntry(pending(), { 'Meaning/Idea': '→ Imported' }, deck, NOW)
    expect(updated.enrichment).toBe('confirmed')
  })

  it('editing a draft keeps it to review', () => {
    expect(editPatch(draftEntry(), fieldOf(deck, 'meanings')!, '→ Mine').enrichment).toBeUndefined()
  })
})

describe('merging entries that are mid-enrichment', () => {
  it('keeps the draft that goes with a draft state', () => {
    const merged = mergeEntries(createEntry(deck, 'figure', NOW), draftEntry(), NOW)
    expect(merged.enrichment).toBe('draft')
    expect(merged.aiDraft).toEqual(DRAFT)
  })

  it('sends a merged pending entry back to the queue', () => {
    const merged = mergeEntries(createEntry(deck, 'a', NOW), createEntry(deck, 'b', NOW, { enrichment: 'pending' }), NOW)
    expect(merged.enrichment).toBe('empty')
  })
})
