import { describe, expect, it } from 'vitest'
import seed from '@/data/seed/seed-data.json'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_DECK_ID, VUE_SCHEMA } from './deckPresets'
import {
  applyRowToEntry,
  cellOf,
  cellToPatch,
  editPatch,
  entryToRow,
  quickAddEntry,
  rowsToEntries,
  type RawRow,
} from './rows'
import { srsToCard } from './srs'
import { formatArrowList, formatSource, normalizeText, parseArrowList, parseSource } from './text'
import type { Deck, Entry, FieldDef } from './types'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const englishDeck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: NOW.toISOString() }
const vueDeck: Deck = { id: VUE_DECK_ID, name: 'Vue', schema: VUE_SCHEMA, createdAt: NOW.toISOString() }

const english = rowsToEntries(seed.english as RawRow[], englishDeck, NOW)
const vue = rowsToEntries(seed.vue3 as RawRow[], vueDeck, NOW)
const find = (text: string) => {
  const entry = [...english, ...vue].find((e) => e.text === text)
  if (!entry) throw new Error(`Seed entry not found: ${text}`)
  return entry
}

describe('parseArrowList', () => {
  it('splits on arrows and trims each item', () => {
    expect(parseArrowList('→ To understand. \n→ To solve something. ')).toEqual([
      'To understand.',
      'To solve something.',
    ])
  })

  it('keeps a multi-line dialogue together as one item', () => {
    expect(parseArrowList('→ A: Hi?\n    B: Yeah\n\n → A: Bye\n      B: Later')).toEqual([
      'A: Hi?\nB: Yeah',
      'A: Bye\nB: Later',
    ])
  })

  it('treats a cell with no arrow as one item', () => {
    expect(parseArrowList('Down to + verb')).toEqual(['Down to + verb'])
  })

  it('keeps an arrow in the middle of a line as text', () => {
    expect(parseArrowList('→ parent → child\n→ other')).toEqual(['parent → child', 'other'])
  })

  it('handles Windows line endings', () => {
    expect(parseArrowList('→ one\r\n→ two\r\n')).toEqual(['one', 'two'])
  })

  it('reverses formatArrowList, including multi-line items', () => {
    const items = ['A: Hi\nB: Hello', 'parent → child', 'plain']
    expect(parseArrowList(formatArrowList(items))).toEqual(items)
  })

  it.each(['', '   \n ', null, undefined])('returns nothing for %j', (cell) => {
    expect(parseArrowList(cell)).toEqual([])
  })
})

describe('parseSource', () => {
  it('stores titles and URLs in different fields', () => {
    expect(parseSource('Phrasal Verb - to figure out')).toEqual({ title: 'Phrasal Verb - to figure out' })
    expect(parseSource(' https://youtu.be/abc ')).toEqual({ url: 'https://youtu.be/abc' })
    expect(parseSource('')).toEqual({})
  })

  it('reads a title and URL from one cell and writes them back', () => {
    const source = { title: 'Pattern | @Channel', url: 'https://youtu.be/abc' }
    expect(parseSource(formatSource(source))).toEqual(source)
  })

  it('only treats http and https as URLs', () => {
    expect(parseSource('javascript:alert(1)')).toEqual({ title: 'javascript:alert(1)' })
  })
})

describe('normalizeText', () => {
  it('ignores case and extra whitespace', () => {
    expect(normalizeText('  Figure   OUT ')).toBe('figure out')
  })

  it('ignores trailing punctuation and curly apostrophes', () => {
    expect(normalizeText('By the way...')).toBe('by the way')
    expect(normalizeText('I’m down!')).toBe("i'm down")
  })

  it('keeps meaningful symbols like parentheses', () => {
    expect(normalizeText('ref()')).toBe('ref()')
  })
})

/** The parts of an entry that a spreadsheet holds. Ids and timestamps are always new. */
const sheetPart = ({ id: _i, createdAt: _c, updatedAt: _u, srs: _s, ...rest }: Entry) => rest

describe.each([
  ['English', () => english, englishDeck],
  ['Vue', () => vue, vueDeck],
] as const)('%s deck round trip', (_name, entries, deck) => {
  it('loses nothing going from entries to rows and back', () => {
    const rows = entries().map((entry) => entryToRow(entry, deck))
    expect(rowsToEntries(rows, deck, NOW).map(sheetPart)).toEqual(entries().map(sheetPart))
  })

  it('writes every schema column in order', () => {
    const row = entryToRow(entries()[0]!, deck)
    expect(Object.keys(row)).toEqual(deck.schema.fields.map((f) => f.column))
  })
})

describe('word-only entries', () => {
  it('stay in the Enrichment Queue after a round trip, even with status filled in', () => {
    const row = entryToRow(find('Borrow'), englishDeck)
    expect(row['Review Status']).toBe('New')
    expect(rowsToEntries([row], englishDeck, NOW)[0]?.enrichment).toBe('empty')
  })

  it('stay in the queue when they only have a source and trigger', () => {
    const [entry] = rowsToEntries(
      [{ 'Setence/Word': 'x', Trigger: 'Video', 'Source URL': 'https://youtu.be/a' }],
      englishDeck,
      NOW,
    )
    expect(entry?.enrichment).toBe('empty')
  })
})

describe('cellToPatch', () => {
  const field = (deck: Deck, key: string) => deck.schema.fields.find((f) => f.key === key) as FieldDef

  it('updates the duplicate key along with the text', () => {
    expect(cellToPatch(find('May'), field(englishDeck, 'text'), ' Might ')).toEqual({
      text: 'Might',
      normalizedText: 'might',
    })
  })

  it('edits list cells as arrow text', () => {
    const entry = find('Figure out')
    const meanings = field(englishDeck, 'meanings')
    expect(cellOf(entry, meanings)).toBe('→ To understand.\n→ To solve something.\n→ To discover an answer')
    expect(cellToPatch(entry, meanings, '→ one\n→ two')).toEqual({ meanings: ['one', 'two'] })
  })

  it('clears a custom field when its cell is emptied', () => {
    const entry = find('ref()')
    const patch = cellToPatch(entry, field(vueDeck, 'useCase'), '  ')
    expect(patch.custom).not.toHaveProperty('useCase')
    expect(patch.custom).toHaveProperty('category', 'Reactivity')
  })

  it('keeps video details when the source cell is edited', () => {
    const entry = { ...find('May'), source: { title: 'Old', videoId: 'abc', startSec: 12 } }
    expect(cellToPatch(entry, field(englishDeck, 'source'), 'New title').source).toEqual({
      title: 'New title',
      videoId: 'abc',
      startSec: 12,
    })
  })

  it('limits priority to 0-5', () => {
    const priority = field(englishDeck, 'priority')
    expect(cellToPatch(find('May'), priority, '9').priority).toBe(5)
    expect(cellToPatch(find('May'), priority, '-1').priority).toBe(0)
    expect(cellToPatch(find('May'), priority, 'abc').priority).toBe(0)
  })
})

describe('editPatch', () => {
  const field = (key: string) => englishDeck.schema.fields.find((f) => f.key === key) as FieldDef

  it('completes an empty entry when real content is typed', () => {
    expect(editPatch(find('May'), field('meanings'), '→ possibility').enrichment).toBe('confirmed')
  })

  it('leaves an empty entry in the queue for tracking fields', () => {
    expect(editPatch(find('May'), field('priority'), '3').enrichment).toBeUndefined()
    expect(editPatch(find('May'), field('trigger'), 'Video').enrichment).toBeUndefined()
  })

  it('leaves an empty entry in the queue when the cell stays blank', () => {
    expect(editPatch(find('May'), field('meanings'), '  ').enrichment).toBeUndefined()
  })
})

describe('applyRowToEntry', () => {
  const reviewed = (): Entry => ({
    ...find('Figure out'),
    srs: { ...find('Figure out').srs, reps: 7, stability: 40 },
    tags: ['mine'],
  })

  it('overwrites filled cells and keeps review history and tags', () => {
    const updated = applyRowToEntry(reviewed(), { 'Emotional Tone': 'Formal' }, englishDeck, NOW)
    expect(updated.tone).toBe('Formal')
    expect(updated.srs.reps).toBe(7)
    expect(updated.tags).toEqual(['mine'])
  })

  it('never erases with a blank cell', () => {
    const updated = applyRowToEntry(reviewed(), { 'Meaning/Idea': '', Context: '  ' }, englishDeck, NOW)
    expect(updated.meanings).toHaveLength(3)
    expect(updated.context).toBe('Daily Conversation')
  })

  it('completes an empty entry once the row adds content', () => {
    const updated = applyRowToEntry(find('May'), { 'Meaning/Idea': '→ possibility' }, englishDeck, NOW)
    expect(updated.enrichment).toBe('confirmed')
  })

  it('does not let a legacy status label reset progress', () => {
    const entry = { ...find('reactive()'), status: 'Familiar' }
    const updated = applyRowToEntry(entry, { 'Review Status': 'Critical' }, vueDeck, NOW)
    expect(updated).toMatchObject({ status: 'Familiar', importance: 'Critical' })
  })
})

describe('quickAddEntry', () => {
  it('saves a word as an empty Word entry', () => {
    expect(quickAddEntry('  Beyond ', englishDeck, NOW)).toMatchObject({
      text: 'Beyond',
      kind: 'Word',
      enrichment: 'empty',
      status: 'New',
    })
  })

  it('does not guess the kind of a phrase', () => {
    expect(quickAddEntry('figure it out', englishDeck, NOW).kind).toBe('N/A')
  })

  it('stores a pasted URL as the source', () => {
    const entry = quickAddEntry('https://youtu.be/abc', englishDeck, NOW)
    expect(entry.source.url).toBe('https://youtu.be/abc')
    expect(entry.kind).toBe('N/A')
  })

  it('keeps capture details', () => {
    const entry = quickAddEntry('a phrase', englishDeck, NOW, {
      source: { title: 'Blog', url: 'https://a.dev' },
      trigger: 'Reading',
    })
    expect(entry).toMatchObject({ trigger: 'Reading', source: { title: 'Blog', url: 'https://a.dev' } })
  })

  it('uses no kind on decks without that field', () => {
    expect(quickAddEntry('watchEffect', vueDeck, NOW).kind).toBe('')
  })
})

describe('English seed', () => {
  it('imports every row with text and skips the 2 blank rows', () => {
    expect(seed.english).toHaveLength(14)
    expect(english).toHaveLength(12)
  })

  it('queues the 8 word-only rows as empty', () => {
    const empty = english.filter((e) => e.enrichment === 'empty').map((e) => e.text)
    expect(empty).toEqual([
      'Incidentally', 'Disbelief', 'Willing', 'May', 'Borrow', 'Shall', 'Such', 'Beyond',
    ])
  })

  it('marks the 4 complete rows as confirmed', () => {
    const confirmed = english.filter((e) => e.enrichment === 'confirmed').map((e) => e.text)
    expect(confirmed).toEqual(['Figure out', "I'm down", "There's no way...", 'By the way...'])
  })

  it('corrects Disbilief and leaves other user typos alone', () => {
    expect(english.some((e) => e.text === 'Disbilief')).toBe(false)
    expect(find('By the way...').realExamples[1]).toBe('By the wat, when are you goint to America?')
  })

  it('maps every column of a complete row', () => {
    const entry = find('Figure out')
    expect(entry).toMatchObject({
      priority: 4,
      kind: 'Phrasal Verb',
      tone: 'Casual',
      context: 'Daily Conversation',
      status: 'New',
      trigger: 'IA Tool',
      source: { title: 'Phrasal Verb - to figure out' },
      meanings: ['To understand.', 'To solve something.', 'To discover an answer'],
      ownExamples: ['I need to figure out how this api works'],
      variations: ['find out', 'work out'],
      collocations: ['figure out a problem / figure out a solution'],
    })
    expect(entry.realExamples).toHaveLength(4)
    expect(entry.source.url).toBeUndefined()
  })

  it('keeps dialogues in Own Example as whole items', () => {
    const { ownExamples } = find("I'm down")
    expect(ownExamples).toHaveLength(3)
    expect(ownExamples[1]).toBe('A: How are you feeling today?\nB: Honestly....I\'m down')
  })

  it('uses Modal Verb when given and N/A when Use is blank', () => {
    expect(find('Shall').kind).toBe('Modal Verb')
    expect(find('Beyond').kind).toBe('N/A')
  })

  it('defaults a blank status to New', () => {
    expect(find('Borrow').status).toBe('New')
  })

  it('has no importance field, so a label stays in status', () => {
    const [entry] = rowsToEntries(
      [{ 'Setence/Word': 'x', 'Review Status': 'Important' }],
      englishDeck,
      NOW,
    )
    expect(entry?.status).toBe('Important')
    expect(entry?.importance).toBeUndefined()
  })
})

describe('Vue seed', () => {
  it('imports all 27 rows as confirmed', () => {
    expect(vue).toHaveLength(27)
    expect(vue.every((e) => e.enrichment === 'confirmed')).toBe(true)
  })

  it('stores deck-specific columns in custom and trims stray spaces', () => {
    expect(find('v-for').custom).toMatchObject({
      category: 'Directives',
      reactEquivalent: '.map()',
      miniExample: ':key="id"',
    })
    expect(find('v-show').custom.category).toBe('Directives')
  })

  it('keeps line breaks inside multi-line code cells', () => {
    expect(find('Single File Component (SFC)').custom.syntax).toBe('<template>\n<script setup>\n<style>')
  })

  it('moves importance labels out of status and fixes their spelling', () => {
    expect(find('Emits')).toMatchObject({ status: 'New', importance: 'Important' })
    expect(find('Composables')).toMatchObject({ status: 'New', importance: 'Important' })
    expect(find('Custom v-model')).toMatchObject({ status: 'New', importance: 'Advanced' })
    expect(find('Composition vs Options API')).toMatchObject({ status: 'New', importance: 'Critical' })
  })

  it('keeps learning stages as they were, with no importance', () => {
    expect(find('reactive()').status).toBe('Learning')
    expect(find('reactive()').importance).toBeUndefined()
    expect(find('ref()').status).toBe('New')
    expect(find('ref()').importance).toBeUndefined()
  })

  it('accounts for every row in the expected totals', () => {
    const count = (key: 'status' | 'importance', value: string) =>
      vue.filter((e) => e[key] === value).length
    expect(count('status', 'New')).toBe(18)
    expect(count('status', 'Learning')).toBe(9)
    expect(count('importance', 'Important')).toBe(13)
    expect(count('importance', 'Advanced')).toBe(1)
    expect(count('importance', 'Critical')).toBe(1)
  })

  it('only stores values offered by the deck schema', () => {
    const optionsFor = (target: string) => VUE_SCHEMA.fields.find((f) => f.target === target)?.options
    for (const entry of vue) {
      expect(optionsFor('status')).toContain(entry.status)
      if (entry.importance) expect(optionsFor('importance')).toContain(entry.importance)
    }
  })

  it('prefers an explicit Importance column over a label in Review Status', () => {
    const [entry] = rowsToEntries(
      [{ 'Concept / Feature': 'x', 'What It Does': 'y', 'Review Status': 'Important', Importance: 'Critical' }],
      vueDeck,
      NOW,
    )
    expect(entry).toMatchObject({ status: 'New', importance: 'Critical' })
  })

  it('reads a learning stage and importance from their own columns', () => {
    const [entry] = rowsToEntries(
      [{ 'Concept / Feature': 'x', 'What It Does': 'y', 'Review Status': 'Familiar', Importance: 'Critical' }],
      vueDeck,
      NOW,
    )
    expect(entry).toMatchObject({ status: 'Familiar', importance: 'Critical' })
  })

  it('does not lose priority 0 or use the English-only kind field', () => {
    expect(find('reactive()').priority).toBe(0)
    expect(find('ref()').priority).toBe(5)
    expect(find('ref()').kind).toBe('')
  })
})

describe('every seeded entry', () => {
  it('starts as a new FSRS card due now', () => {
    for (const entry of [...english, ...vue]) {
      expect(entry.srs.due).toBe(NOW.toISOString())
      expect(entry.srs.reps).toBe(0)
    }
  })

  it('has a card that converts back for ts-fsrs', () => {
    const card = srsToCard(find('Figure out').srs)
    expect(card.due).toEqual(NOW)
    expect(card.last_review).toBeUndefined()
  })
})
