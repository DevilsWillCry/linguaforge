import type { Entry, Enrichment } from './types'

/** A light stemmer, enough to match "figure", "figured" and "figuring". */
function stemToken(token: string): string {
  let stem = token
  if (stem.length > 4) stem = stem.replace(/(ing|ed|es|s)$/, '')
  if (stem.length > 3) stem = stem.replace(/e$/, '')
  // "running" loses "ing" and leaves "runn", which should match "run".
  return stem.replace(/([bdfglmnprt])\1$/, '$1')
}

export function stemKey(normalizedText: string): string {
  return normalizedText.split(' ').map(stemToken).join(' ')
}

/** Levenshtein distance, giving up once it exceeds `limit`. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost)
      current.push(value)
      best = Math.min(best, value)
    }
    if (best > limit) return limit + 1
    previous = current
  }
  return previous[b.length]!
}

/** Short words get no typo tolerance, because "may" and "way" are different words. */
function typoLimit(length: number): number {
  if (length >= 9) return 2
  return length >= 5 ? 1 : 0
}

export function areNearDuplicates(a: string, b: string): boolean {
  if (a === b || stemKey(a) === stemKey(b)) return true
  const limit = typoLimit(Math.min(a.length, b.length))
  return limit > 0 && a[0] === b[0] && editDistance(a, b, limit) <= limit
}

export const pairKey = (a: string, b: string) => [a, b].sort().join('|')

export interface DuplicatePair {
  key: string
  a: Entry
  b: Entry
}

export function findDuplicatePairs(
  entries: readonly Entry[],
  dismissed: ReadonlySet<string> = new Set(),
): DuplicatePair[] {
  const pairs: DuplicatePair[] = []
  entries.forEach((a, i) => {
    for (const b of entries.slice(i + 1)) {
      if (!areNearDuplicates(a.normalizedText, b.normalizedText)) continue
      const key = pairKey(a.id, b.id)
      if (!dismissed.has(key)) pairs.push({ key, a, b })
    }
  })
  return pairs
}

const union = (...lists: (readonly string[])[]): string[] => {
  const seen = new Map<string, string>()
  for (const item of lists.flat()) {
    const key = item.trim().toLowerCase()
    if (!seen.has(key)) seen.set(key, item)
  }
  return [...seen.values()]
}

const ENRICHMENT_RANK: Record<Enrichment, number> = { empty: 0, pending: 1, draft: 2, confirmed: 3 }

/**
 * Combines two entries into `keep`. Nothing is lost: lists are joined, blanks are
 * filled from `other`, and the other entry's text becomes a variation.
 * The review history that goes further wins, so merging can't reset progress.
 */
export function mergeEntries(keep: Entry, other: Entry, now: Date = new Date()): Entry {
  const progress = other.srs.reps > keep.srs.reps ? other : keep

  const correctByMode = { ...other.stats.correctByMode }
  for (const [mode, count] of Object.entries(keep.stats.correctByMode)) {
    const key = mode as keyof typeof correctByMode
    correctByMode[key] = (correctByMode[key] ?? 0) + count
  }

  const usedAt = [keep.stats.lastUsedInOutputAt, other.stats.lastUsedInOutputAt].filter(Boolean).sort().at(-1)
  const notes = [keep.notes, other.notes].filter(Boolean).join('\n')
  const importance = keep.importance || other.importance
  const ipa = keep.ipa || other.ipa
  const audioUrl = keep.audioUrl || other.audioUrl
  const aiDraft = keep.aiDraft ?? other.aiDraft
  const furthest =
    ENRICHMENT_RANK[other.enrichment] > ENRICHMENT_RANK[keep.enrichment] ? other.enrichment : keep.enrichment
  // A request still running for the other entry will find it gone, so the queue must ask again.
  const mergedEnrichment = furthest === 'pending' ? 'empty' : furthest

  return {
    ...keep,
    priority: Math.max(keep.priority, other.priority),
    kind: keep.kind && keep.kind !== 'N/A' ? keep.kind : other.kind || keep.kind,
    meanings: union(keep.meanings, other.meanings),
    tone: keep.tone || other.tone,
    context: keep.context || other.context,
    realExamples: union(keep.realExamples, other.realExamples),
    ownExamples: union(keep.ownExamples, other.ownExamples),
    variations: union(
      keep.variations,
      other.variations,
      other.normalizedText === keep.normalizedText ? [] : [other.text],
    ),
    collocations: union(keep.collocations, other.collocations),
    status: progress.status,
    trigger: keep.trigger || other.trigger,
    source: { ...other.source, ...keep.source },
    tags: union(keep.tags, other.tags),
    custom: { ...other.custom, ...keep.custom },
    createdAt: keep.createdAt < other.createdAt ? keep.createdAt : other.createdAt,
    updatedAt: now.toISOString(),
    enrichment: mergedEnrichment,
    srs: progress.srs,
    stats: { correctByMode, ...(usedAt ? { lastUsedInOutputAt: usedAt } : {}) },
    ...(notes ? { notes } : {}),
    ...(importance ? { importance } : {}),
    ...(ipa ? { ipa } : {}),
    ...(audioUrl ? { audioUrl } : {}),
    ...(aiDraft ? { aiDraft } : {}),
  }
}
