import { Rating, fsrs, type Grade } from 'ts-fsrs'
import { cardToSrs, srsToCard } from './srs'
import type { Entry, EntryStats, ReviewLog, ReviewMode } from './types'

export type ReviewRating = 1 | 2 | 3 | 4

const scheduler = fsrs()

/** Lapses after which a card counts as a leech: it keeps failing, so reviewing alone won't fix it. */
export const LEECH_LAPSES = 5

/** Rated Hard or better. FSRS also treats Hard as a successful recall. */
export const isCorrect = (rating: ReviewRating) => rating >= Rating.Hard

export const isLeech = (entry: Pick<Entry, 'srs'>) => entry.srs.lapses >= LEECH_LAPSES

const MODES_FOR_FAMILIAR = 2

/**
 * The status after a review. It only ever moves forward, and a status the user chose by hand
 * stays as it is. Decks without language features have one mode and no output practice, so
 * they need only the stability to reach Familiar, and Natural stays a manual choice.
 */
export function nextStatus(entry: Entry, languageDeck: boolean): string {
  if (entry.statusManual || !['New', 'Learning', 'Familiar'].includes(entry.status)) return entry.status
  const { stability } = entry.srs
  const modes = Object.values(entry.stats.correctByMode).filter((count) => count > 0).length
  const familiar = stability >= 7 && (!languageDeck || modes >= MODES_FOR_FAMILIAR)
  const natural = languageDeck && stability >= 30 && modes > 0 && Boolean(entry.stats.lastUsedInOutputAt)

  if (natural) return 'Natural'
  if (familiar) return 'Familiar'
  return modes > 0 && entry.status === 'New' ? 'Learning' : entry.status
}

export interface ReviewAnswer {
  mode: ReviewMode
  rating: ReviewRating
  /** The user wrote their own sentence and it used the item correctly. */
  usedInOutput?: boolean
  id: string
  languageDeck: boolean
}

/** Schedules one answer. Returns the changes to save and the log entry that can undo them. */
export function applyReview(entry: Entry, answer: ReviewAnswer, now: Date = new Date()) {
  const { mode, rating } = answer
  const { card } = scheduler.next(srsToCard(entry.srs), now, rating as Grade)
  const stats: EntryStats = {
    ...entry.stats,
    lastMode: mode,
    correctByMode: {
      ...entry.stats.correctByMode,
      ...(isCorrect(rating) ? { [mode]: (entry.stats.correctByMode[mode] ?? 0) + 1 } : {}),
    },
    ...(answer.usedInOutput ? { lastUsedInOutputAt: now.toISOString() } : {}),
  }
  const srs = cardToSrs(card)
  const status = nextStatus({ ...entry, srs, stats }, answer.languageDeck)
  const log: ReviewLog = {
    id: answer.id,
    entryId: entry.id,
    mode,
    rating,
    reviewedAt: now.toISOString(),
    previous: entry.srs,
    previousStatus: entry.status,
    previousStats: entry.stats,
  }
  return { patch: { srs, stats, status } satisfies Partial<Entry>, log }
}

/** The changes that put an entry back as it was before a review. */
export function undoPatch(log: ReviewLog): Partial<Entry> {
  return {
    srs: log.previous,
    ...(log.previousStats ? { stats: log.previousStats } : {}),
    ...(log.previousStatus ? { status: log.previousStatus } : {}),
  }
}

const DAY_MS = 86_400_000

function urgency(entry: Entry, now: Date): number {
  const overdueDays = Math.max(0, (now.getTime() - new Date(entry.srs.due).getTime()) / DAY_MS)
  // Priority leads, and being long overdue can outweigh it.
  return entry.priority * 2 + Math.min(overdueDays, 10)
}

/**
 * Today's cards: due ones, most urgent first, up to `limit`, then ordered so that similar
 * items don't sit together, because mixing kinds and contexts makes recall work harder.
 */
export function buildQueue(entries: readonly Entry[], limit: number, now: Date = new Date()): Entry[] {
  const nowIso = now.toISOString()
  const pool = entries
    .filter((entry) => entry.enrichment === 'confirmed' && entry.srs.due <= nowIso)
    .sort((a, b) => urgency(b, now) - urgency(a, now) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))

  const ordered: Entry[] = []
  while (pool.length) {
    const previous = ordered.at(-1)
    const index = previous
      ? pool.findIndex((entry) => entry.kind !== previous.kind && entry.context !== previous.context)
      : 0
    ordered.push(...pool.splice(Math.max(index, 0), 1))
  }
  return ordered
}
