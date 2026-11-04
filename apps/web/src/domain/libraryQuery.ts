import { cellOf } from './rows'
import { foldText } from './text'
import type { Deck, Entry } from './types'

export interface LibraryFilters {
  search: string
  kinds: string[]
  tones: string[]
  contexts: string[]
  statuses: string[]
  importance: string[]
  priorities: number[]
  tags: string[]
  source: string
  dueToday: boolean
}

export const emptyFilters = (): LibraryFilters => ({
  search: '',
  kinds: [],
  tones: [],
  contexts: [],
  statuses: [],
  importance: [],
  priorities: [],
  tags: [],
  source: '',
  dueToday: false,
})

export function activeFilterCount(filters: LibraryFilters): number {
  return Object.values(filters).filter((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  ).length
}

/** Due by the end of today. Unconfirmed entries have nothing to review yet. */
export function isDueToday(entry: Entry, now: Date = new Date()): boolean {
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  return entry.enrichment === 'confirmed' && entry.srs.due <= endOfDay.toISOString()
}

/** Everything search looks through, examples included. Cached because entries are immutable. */
const haystacks = new WeakMap<Entry, string>()
function haystackOf(entry: Entry): string {
  let haystack = haystacks.get(entry)
  if (haystack === undefined) {
    haystack = foldText(
      [
        entry.text, entry.kind, entry.tone, entry.context, entry.status, entry.importance,
        entry.trigger, entry.notes, entry.source.title, entry.source.url,
        ...entry.meanings, ...entry.realExamples, ...entry.ownExamples,
        ...entry.variations, ...entry.collocations, ...entry.tags,
        ...Object.values(entry.custom),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    haystacks.set(entry, haystack)
  }
  return haystack
}

const allows = (selected: readonly string[], value: string | undefined) =>
  selected.length === 0 || selected.includes(value ?? '')

export function matchesFilters(entry: Entry, filters: LibraryFilters, now: Date = new Date()): boolean {
  if (!allows(filters.kinds, entry.kind)) return false
  if (!allows(filters.tones, entry.tone)) return false
  if (!allows(filters.contexts, entry.context)) return false
  if (!allows(filters.statuses, entry.status)) return false
  if (!allows(filters.importance, entry.importance)) return false
  if (filters.priorities.length && !filters.priorities.includes(entry.priority)) return false
  if (filters.tags.length && !filters.tags.some((tag) => entry.tags.includes(tag))) return false
  if (filters.dueToday && !isDueToday(entry, now)) return false

  if (filters.source.trim()) {
    const source = foldText(`${entry.source.title ?? ''} ${entry.source.url ?? ''} ${entry.trigger}`)
    if (!source.includes(foldText(filters.source.trim()))) return false
  }

  // Every word must appear somewhere, in any order.
  const terms = foldText(filters.search).split(/\s+/).filter(Boolean)
  if (terms.length) {
    const haystack = haystackOf(entry)
    if (!terms.every((term) => haystack.includes(term))) return false
  }
  return true
}

export interface SortKey {
  /** A deck field key. */
  key: string
  desc: boolean
}

export const DEFAULT_SORT: SortKey[] = [
  { key: 'priority', desc: true },
  { key: 'text', desc: false },
]

/** Plain click sorts by one column. Shift+click adds or changes a column in the sequence. */
export function toggleSort(sort: readonly SortKey[], key: string, additive: boolean): SortKey[] {
  const current = sort.find((s) => s.key === key)
  // Each click moves through ascending, descending, then off.
  const next: SortKey | null = !current ? { key, desc: false } : current.desc ? null : { key, desc: true }
  if (!additive) return next ? [next] : []
  if (!next) return sort.filter((s) => s.key !== key)
  return current ? sort.map((s) => (s.key === key ? next : s)) : [...sort, next]
}

export function sortEntries(entries: readonly Entry[], sort: readonly SortKey[], deck: Deck): Entry[] {
  const keys = sort.flatMap(({ key, desc }) => {
    const field = deck.schema.fields.find((f) => f.key === key)
    return field ? [{ field, desc }] : []
  })

  return [...entries].sort((a, b) => {
    for (const { field, desc } of keys) {
      let order: number
      if (field.target === 'priority') {
        order = a.priority - b.priority
      } else {
        const [left, right] = [cellOf(a, field), cellOf(b, field)]
        // Blank cells stay at the bottom in both directions.
        if (!left || !right) {
          if (left !== right) return left ? -1 : 1
          continue
        }
        order = left.localeCompare(right)
      }
      if (order) return desc ? -order : order
    }
    return a.text.localeCompare(b.text)
  })
}
