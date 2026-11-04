import { nanoid } from 'nanoid'
import { newSrsState } from './srs'
import {
  formatArrowList,
  formatSource,
  isUrl,
  normalizeText,
  parseArrowList,
  parseSource,
} from './text'
import type { CoreField, Deck, Entry, EntrySource, FieldDef } from './types'

/** One spreadsheet row, keyed by the deck's exact column headers. */
export type RawRow = Record<string, string | number | null | undefined>

/** The only spelling corrections applied on import. All other user text is kept as written. */
const TEXT_CORRECTIONS: Record<string, string> = { disbilief: 'Disbelief' }
const STATUS_CORRECTIONS: Record<string, string> = { imporant: 'Important' }

/** Columns that describe or locate an entry. Filling only these leaves it awaiting enrichment. */
const NON_CONTENT: readonly CoreField[] = [
  'priority', 'kind', 'text', 'status', 'importance', 'trigger', 'source',
]

const LIST_TARGETS = ['meanings', 'realExamples', 'ownExamples', 'variations', 'collocations'] as const
type ListTarget = (typeof LIST_TARGETS)[number]
const isListTarget = (target: CoreField): target is ListTarget =>
  (LIST_TARGETS as readonly string[]).includes(target)

const rawCell = (row: RawRow, field: FieldDef | undefined): string =>
  field ? String(row[field.column] ?? '') : ''

export function fieldOf(deck: Deck, target: CoreField): FieldDef | undefined {
  return deck.schema.fields.find((f) => f.target === target)
}

export function parsePriority(value: unknown): number {
  const number = Math.round(Number(value))
  return Number.isFinite(number) ? Math.min(5, Math.max(0, number)) : 0
}

/**
 * Separates a "Review Status" cell into a learning stage and an importance label.
 * An importance label says nothing about progress, so its card starts as New.
 * Decks with no importance options keep the value as a status.
 */
export function splitStatus(
  raw: string,
  importanceOptions: readonly string[] = [],
): { status: string; importance?: string } {
  const value = raw.trim()
  const corrected = STATUS_CORRECTIONS[value.toLowerCase()] ?? value
  const importance = importanceOptions.find((o) => o.toLowerCase() === corrected.toLowerCase())
  return importance ? { status: 'New', importance } : { status: corrected || 'New' }
}

/** A new entry holding only its text, ready for the Enrichment Queue. */
export function createEntry(
  deck: Deck,
  text: string,
  now: Date = new Date(),
  overrides: Partial<Entry> = {},
): Entry {
  const iso = now.toISOString()
  return {
    id: nanoid(),
    deckId: deck.id,
    priority: 0,
    kind: fieldOf(deck, 'kind') ? 'N/A' : '',
    text,
    normalizedText: normalizeText(text),
    meanings: [],
    tone: '',
    context: '',
    realExamples: [],
    ownExamples: [],
    variations: [],
    collocations: [],
    status: 'New',
    trigger: '',
    source: {},
    tags: [],
    custom: {},
    createdAt: iso,
    updatedAt: iso,
    enrichment: 'empty',
    srs: newSrsState(now),
    stats: { correctByMode: {} },
    ...overrides,
  }
}

/** Builds an entry from the single Quick Add field: a word, phrase, sentence or URL. */
export function quickAddEntry(
  input: string,
  deck: Deck,
  now: Date = new Date(),
  capture: { source?: EntrySource; trigger?: string } = {},
): Entry {
  const text = input.trim()
  const source: EntrySource = { ...capture.source, ...(isUrl(text) ? { url: text } : {}) }
  const hasKind = Boolean(fieldOf(deck, 'kind'))
  const isSingleWord = !isUrl(text) && !/\s/.test(text)
  return createEntry(deck, text, now, {
    source,
    trigger: capture.trigger ?? '',
    kind: hasKind ? (isSingleWord ? 'Word' : 'N/A') : '',
  })
}

/** Reads a field as the text of its spreadsheet cell. Inputs edit this same text. */
export function cellOf(entry: Entry, field: FieldDef): string {
  const { target } = field
  if (!target) return entry.custom[field.key] ?? ''
  if (isListTarget(target)) return formatArrowList(entry[target])
  if (target === 'priority') return String(entry.priority)
  if (target === 'source') return formatSource(entry.source)
  return entry[target] ?? ''
}

/** Converts edited cell text into the changes to save on the entry. */
export function cellToPatch(entry: Entry, field: FieldDef, cell: string): Partial<Entry> {
  const { target } = field
  const value = cell.trim()
  if (!target) {
    const custom = { ...entry.custom }
    if (value) custom[field.key] = value
    else delete custom[field.key]
    return { custom }
  }
  if (isListTarget(target)) return { [target]: parseArrowList(cell) }
  if (target === 'priority') return { priority: parsePriority(value) }
  // Keeps video details, which the sheet column has no place for.
  if (target === 'source') {
    const { title: _title, url: _url, ...rest } = entry.source
    return { source: { ...rest, ...parseSource(cell) } }
  }
  if (target === 'text') return { text: value, normalizedText: normalizeText(value) }
  if (target === 'importance') return { importance: value || undefined }
  return { [target]: value }
}

/** No content yet, even if an AI answer is on its way. That answer is ignored once this changes. */
const isUnfilled = (entry: Entry) => entry.enrichment === 'empty' || entry.enrichment === 'pending'

/**
 * The changes for a manual edit. Typing real content into an entry awaiting
 * enrichment completes it, so AI won't later fill it in over the user's work.
 */
export function editPatch(entry: Entry, field: FieldDef, cell: string): Partial<Entry> {
  const patch: Partial<Entry> = {
    ...cellToPatch(entry, field, cell),
    ...(field.target === 'status' ? { statusManual: true } : {}),
  }
  const isContent = !field.target || !NON_CONTENT.includes(field.target)
  return isContent && cell.trim() && isUnfilled(entry)
    ? { ...patch, enrichment: 'confirmed' }
    : patch
}

/** Writes an entry back to a row, using the deck's exact column layout. */
export function entryToRow(entry: Entry, deck: Deck): RawRow {
  const row: RawRow = {}
  for (const field of deck.schema.fields) {
    row[field.column] = field.target === 'priority' ? entry.priority : cellOf(entry, field)
  }
  return row
}

/**
 * Converts one spreadsheet row into an Entry for the given deck.
 * Returns null for rows with no text, because the sheet has blank padding rows.
 */
export function rowToEntry(row: RawRow, deck: Deck, now: Date = new Date()): Entry | null {
  const rawText = rawCell(row, fieldOf(deck, 'text')).trim()
  if (!rawText) return null

  const text = TEXT_CORRECTIONS[normalizeText(rawText)] ?? rawText
  let entry = createEntry(deck, text, now)
  let hasContent = false

  for (const field of deck.schema.fields) {
    const cell = rawCell(row, field)
    if (!cell.trim()) continue
    if (field.target === 'text' || field.target === 'status' || field.target === 'importance') continue
    if (!field.target || !NON_CONTENT.includes(field.target)) hasContent = true
    entry = { ...entry, ...cellToPatch(entry, field, cell) }
  }

  const { status, importance: fromStatus } = splitStatus(
    rawCell(row, fieldOf(deck, 'status')),
    fieldOf(deck, 'importance')?.options,
  )
  // An explicit Importance column wins over a label found in "Review Status".
  const importance = rawCell(row, fieldOf(deck, 'importance')).trim() || fromStatus

  return {
    ...entry,
    status,
    ...(importance ? { importance } : {}),
    enrichment: hasContent ? 'confirmed' : 'empty',
  }
}

export function rowsToEntries(rows: RawRow[], deck: Deck, now: Date = new Date()): Entry[] {
  return rows.flatMap((row) => rowToEntry(row, deck, now) ?? [])
}

/**
 * Applies an imported row to an existing entry. Filled cells overwrite, and blank
 * cells never erase. Review history and anything else outside the sheet stay as they are.
 */
export function applyRowToEntry(existing: Entry, row: RawRow, deck: Deck, now: Date = new Date()): Entry {
  let result: Entry = { ...existing }
  let hasContent = false

  for (const field of deck.schema.fields) {
    const cell = rawCell(row, field)
    if (!cell.trim() || field.target === 'text') continue
    if (!field.target || !NON_CONTENT.includes(field.target)) hasContent = true

    if (field.target === 'status') {
      const { status, importance } = splitStatus(cell, fieldOf(deck, 'importance')?.options)
      // A label in the old status column must not reset the card's real progress.
      result = importance ? { ...result, importance } : { ...result, status }
    } else {
      result = { ...result, ...cellToPatch(result, field, cell) }
    }
  }

  return {
    ...result,
    enrichment: hasContent && isUnfilled(existing) ? 'confirmed' : existing.enrichment,
    updatedAt: now.toISOString(),
  }
}
