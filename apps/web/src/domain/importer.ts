import { fieldOf, rowToEntry, type RawRow } from './rows'
import { normalizeText } from './text'
import type { Deck, DeckSchema, Entry } from './types'

/** Other names a column may have. "Columna 1" is the priority column in the original sheet. */
const HEADER_ALIASES: Record<string, string[]> = {
  priority: ['columna 1', 'prioridad', 'priority'],
  text: ['sentence/word', 'sentence', 'word', 'text'],
  source: ['source', 'url'],
}

const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/\s+/g, ' ')

/** Field key to file header. A field with no match maps to an empty string. */
export type HeaderMapping = Record<string, string>

export function autoMapHeaders(headers: readonly string[], schema: DeckSchema): HeaderMapping {
  const mapping: HeaderMapping = {}
  for (const field of schema.fields) {
    const names = [field.column, ...(HEADER_ALIASES[field.key] ?? [])].map(normalizeHeader)
    mapping[field.key] = headers.find((h) => names.includes(normalizeHeader(h))) ?? ''
  }
  return mapping
}

/** Picks the deck whose columns best match the file, or null if none match at all. */
export function guessDeck(headers: readonly string[], decks: readonly Deck[]): Deck | null {
  let best: Deck | null = null
  let bestScore = 0
  for (const deck of decks) {
    const mapping = autoMapHeaders(headers, deck.schema)
    const score = Object.values(mapping).filter(Boolean).length
    if (score > bestScore) {
      best = deck
      bestScore = score
    }
  }
  return best
}

export function unmappedHeaders(headers: readonly string[], mapping: HeaderMapping): string[] {
  const used = new Set(Object.values(mapping))
  return headers.filter((h) => !used.has(h))
}

/** Rewrites file rows so that they use the deck's own column headers. */
export function remapRows(rows: readonly RawRow[], mapping: HeaderMapping, schema: DeckSchema): RawRow[] {
  return rows.map((row) => {
    const mapped: RawRow = {}
    for (const field of schema.fields) {
      const header = mapping[field.key]
      if (header) mapped[field.column] = row[header]
    }
    return mapped
  })
}

export interface ImportDuplicate {
  row: RawRow
  incoming: Entry
  existing: Entry
}

export interface ImportPlan {
  toCreate: Entry[]
  duplicates: ImportDuplicate[]
  /** Rows with no text, such as padding at the end of a sheet. */
  blankRows: number
  /** Rows repeating an earlier row in the same file. The first occurrence wins. */
  repeatedInFile: number
}

export function planImport(
  rows: readonly RawRow[],
  deck: Deck,
  existing: readonly Entry[],
  now: Date = new Date(),
): ImportPlan {
  const byText = new Map(existing.map((entry) => [entry.normalizedText, entry]))
  const seenInFile = new Set<string>()
  const plan: ImportPlan = { toCreate: [], duplicates: [], blankRows: 0, repeatedInFile: 0 }

  for (const row of rows) {
    const incoming = rowToEntry(row, deck, now)
    if (!incoming) {
      plan.blankRows++
      continue
    }
    const key = normalizeText(incoming.text)
    if (seenInFile.has(key)) {
      plan.repeatedInFile++
      continue
    }
    seenInFile.add(key)

    const match = byText.get(key)
    if (match) plan.duplicates.push({ row, incoming, existing: match })
    else plan.toCreate.push(incoming)
  }
  return plan
}

export const canImport = (mapping: HeaderMapping, deck: Deck) =>
  Boolean(mapping[fieldOf(deck, 'text')?.key ?? ''])
