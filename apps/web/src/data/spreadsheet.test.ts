import { describe, expect, it } from 'vitest'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_DECK_ID, VUE_SCHEMA } from '@/domain/deckPresets'
import { autoMapHeaders, remapRows } from '@/domain/importer'
import { entryToRow, rowsToEntries, type RawRow } from '@/domain/rows'
import type { Deck, Entry } from '@/domain/types'
import seed from './seed/seed-data.json'
import { parseCsv, parseXlsx, writeCsv, writeXlsx, type SheetData } from './spreadsheet'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const english: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: '' }
const vue: Deck = { id: VUE_DECK_ID, name: 'Vue 3 / Tech', schema: VUE_SCHEMA, createdAt: '' }

const sheetPart = ({ id: _i, createdAt: _c, updatedAt: _u, srs: _s, ...rest }: Entry) => rest

function toSheet(entries: Entry[], deck: Deck): SheetData {
  return {
    name: deck.name,
    columns: deck.schema.fields.map((f) => f.column),
    rows: entries.map((entry) => entryToRow(entry, deck)),
  }
}

const cases = [
  ['English', english, seed.english],
  ['Vue', vue, seed.vue3],
] as const

describe.each(cases)('%s deck through real files', (_name, deck, seedRows) => {
  const entries = rowsToEntries(seedRows as RawRow[], deck, NOW)

  it('round-trips through XLSX without losing anything', () => {
    const [sheet] = parseXlsx(writeXlsx([toSheet(entries, deck)]))
    expect(rowsToEntries(sheet!.rows, deck, NOW).map(sheetPart)).toEqual(entries.map(sheetPart))
  })

  it('round-trips through CSV without losing anything', () => {
    const [sheet] = parseCsv(writeCsv(toSheet(entries, deck)).replace(/^﻿/, ''))
    expect(rowsToEntries(sheet!.rows, deck, NOW).map(sheetPart)).toEqual(entries.map(sheetPart))
  })

  it('keeps the exact column layout', () => {
    const [sheet] = parseXlsx(writeXlsx([toSheet(entries, deck)]))
    expect(sheet!.headers).toEqual(deck.schema.fields.map((f) => f.column))
  })
})

describe('the original Vue sheet layout', () => {
  it('still imports, with importance read from Review Status', () => {
    const columns = Object.keys(seed.vue3[0]!)
    const csv = writeCsv({ name: 'VUE3', columns, rows: seed.vue3 as RawRow[] })
    const [sheet] = parseCsv(csv.replace(/^﻿/, ''))
    const mapping = autoMapHeaders(sheet!.headers, vue.schema)
    const entries = rowsToEntries(remapRows(sheet!.rows, mapping, vue.schema), vue, NOW)
    expect(entries).toHaveLength(27)
    expect(entries.find((e) => e.text === 'Emits')).toMatchObject({ status: 'New', importance: 'Important' })
  })
})

describe('parseCsv', () => {
  it('keeps values that look like dates or numbers as typed', () => {
    const [sheet] = parseCsv('Setence/Word,Context\n1/2,007\n')
    expect(sheet!.rows[0]).toEqual({ 'Setence/Word': '1/2', Context: '007' })
  })

  it('reads semicolon-separated files, which Excel writes in Spanish locales', () => {
    const [sheet] = parseCsv('Setence/Word;Context\nhello;Gaming\n')
    expect(sheet!.rows[0]).toEqual({ 'Setence/Word': 'hello', Context: 'Gaming' })
  })

  it('keeps line breaks and quotes inside cells', () => {
    const [sheet] = parseCsv('Setence/Word,Meaning/Idea\nhello,"→ say ""hi""\n→ greet"\n')
    expect(sheet!.rows[0]?.['Meaning/Idea']).toBe('→ say "hi"\n→ greet')
  })

  it('skips fully blank rows', () => {
    const [sheet] = parseCsv('Setence/Word,Context\na,b\n,\nc,d\n')
    expect(sheet!.rows.map((row) => row['Setence/Word'])).toEqual(['a', 'c'])
  })
})

describe('writeCsv', () => {
  it('starts with the byte order mark Excel needs for UTF-8', () => {
    expect(writeCsv({ name: 'x', columns: ['A'], rows: [{ A: '→' }] }).startsWith('﻿')).toBe(true)
  })
})

describe('writeXlsx', () => {
  it('makes deck names safe for Excel and keeps both sheets', () => {
    const sheets = parseXlsx(writeXlsx([toSheet([], english), toSheet([], vue)]))
    expect(sheets.map((s) => s.name)).toEqual(['English', 'Vue 3 Tech'])
  })

  it('stores a value like @click as text, not a formula', () => {
    const data = writeXlsx([{ name: 'x', columns: ['A', 'B'], rows: [{ A: '@click="save"', B: '=1+1' }] }])
    expect(parseXlsx(data)[0]!.rows[0]).toEqual({ A: '@click="save"', B: '=1+1' })
  })
})
