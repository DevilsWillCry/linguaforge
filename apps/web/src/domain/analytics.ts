import type { Entry, Mistake, ReviewLog, StudySession, TutorConversation } from './types'

const DAY_MS = 86_400_000

/** A calendar day where the learner is, which is what "today" means to them. */
export function dayKey(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function addDays(date: Date, days: number): Date {
  // Through the calendar rather than milliseconds, since some days aren't 24 hours long.
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

/** Monday, the start of the week for the weekly targets. */
export function startOfWeek(now: Date): Date {
  return addDays(startOfDay(now), -((now.getDay() + 6) % 7))
}

export interface ForecastDay {
  day: string
  count: number
}

/** Cards coming due per day. Anything overdue counts today, because it's what's waiting now. */
export function dueForecast(entries: Pick<Entry, 'srs'>[], now: Date, days = 14): ForecastDay[] {
  const forecast = Array.from({ length: days }, (_, i) => ({ day: dayKey(addDays(now, i)), count: 0 }))
  const today = forecast[0]!.day
  const byDay = new Map(forecast.map((item) => [item.day, item]))
  for (const { srs } of entries) {
    const key = dayKey(srs.due)
    const target = key < today ? forecast[0] : byDay.get(key)
    if (target) target.count++
  }
  return forecast
}

/** "Again" is the only failed answer, as in FSRS, where "Hard" still counts as remembered. */
const isCorrect = (log: Pick<ReviewLog, 'rating'>) => log.rating > 1

/**
 * How often items seen before are remembered. First-time answers are left out, because
 * they measure what's new rather than what was retained.
 */
export function retention(logs: ReviewLog[], now: Date, windowDays = 30): { percent: number | null; reviews: number } {
  const since = now.getTime() - windowDays * DAY_MS
  const counted = logs.filter((log) => log.previous.reps > 0 && new Date(log.reviewedAt).getTime() >= since)
  if (!counted.length) return { percent: null, reviews: 0 }
  return { percent: Math.round((counted.filter(isCorrect).length / counted.length) * 100), reviews: counted.length }
}

/** What counts as a study session writing task, with no minutes of its own. */
export const WRITING_ACTIVITY = 'writing'

/** Days with real production: speaking to the tutor, a "use it" sentence or the writing task. */
export function outputDays(
  logs: Pick<ReviewLog, 'mode' | 'reviewedAt'>[],
  conversations: Pick<TutorConversation, 'messages'>[],
  sessions: Pick<StudySession, 'activity' | 'startedAt'>[],
): Set<string> {
  const days = new Set<string>()
  for (const log of logs) if (log.mode === 'useIt') days.add(dayKey(log.reviewedAt))
  for (const { messages } of conversations) {
    for (const message of messages) if (message.role === 'user') days.add(dayKey(message.at))
  }
  for (const session of sessions) if (session.activity === WRITING_ACTIVITY) days.add(dayKey(session.startedAt))
  return days
}

/** Consecutive days with output. Today can still be done, so missing it doesn't end the streak. */
export function outputStreak(days: Set<string>, now: Date): number {
  let cursor = days.has(dayKey(now)) ? now : addDays(now, -1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export interface ActivityCell {
  day: string
  reviews: number
  minutes: number
  output: boolean
  /** 0 is no activity. 1 to 4 are shades relative to the busiest day shown. */
  level: 0 | 1 | 2 | 3 | 4
}

/** Whole weeks, Monday first, ending with the current one. Days still to come are left out. */
export function activityCalendar(
  logs: Pick<ReviewLog, 'reviewedAt'>[],
  sessions: Pick<StudySession, 'startedAt' | 'minutes'>[],
  output: Set<string>,
  now: Date,
  weeks = 18,
): ActivityCell[] {
  const reviews = new Map<string, number>()
  for (const log of logs) reviews.set(dayKey(log.reviewedAt), (reviews.get(dayKey(log.reviewedAt)) ?? 0) + 1)
  const minutes = new Map<string, number>()
  for (const session of sessions) minutes.set(dayKey(session.startedAt), (minutes.get(dayKey(session.startedAt)) ?? 0) + session.minutes)

  const today = dayKey(now)
  const cells: Omit<ActivityCell, 'level'>[] = []
  for (let cursor = addDays(startOfWeek(now), -(weeks - 1) * 7); dayKey(cursor) <= today; cursor = addDays(cursor, 1)) {
    const day = dayKey(cursor)
    cells.push({ day, reviews: reviews.get(day) ?? 0, minutes: minutes.get(day) ?? 0, output: output.has(day) })
  }
  const score = (cell: Omit<ActivityCell, 'level'>) => cell.reviews + cell.minutes
  const busiest = Math.max(1, ...cells.map(score))
  return cells.map((cell) => {
    const share = score(cell) / busiest
    const level = share === 0 && !cell.output ? 0 : share <= 0.25 ? 1 : share <= 0.5 ? 2 : share <= 0.75 ? 3 : 4
    return { ...cell, level }
  })
}

export const FUNNEL_STATUSES = ['New', 'Learning', 'Familiar', 'Natural'] as const

/** How many items sit at each stage. Items marked N/A aren't being learned, so they're left out. */
export function statusFunnel(entries: Pick<Entry, 'status'>[]): { status: (typeof FUNNEL_STATUSES)[number]; count: number }[] {
  return FUNNEL_STATUSES.map((status) => ({ status, count: entries.filter((entry) => entry.status === status).length }))
}

/** Minutes per activity in the last week, most first. Writing tasks carry no minutes. */
export function minutesByActivity(sessions: StudySession[], now: Date, days = 7): { activity: string; minutes: number }[] {
  const since = addDays(startOfDay(now), -(days - 1)).getTime()
  const totals = new Map<string, number>()
  for (const session of sessions) {
    if (new Date(session.startedAt).getTime() < since || session.minutes <= 0) continue
    totals.set(session.activity, (totals.get(session.activity) ?? 0) + session.minutes)
  }
  return [...totals].map(([activity, minutes]) => ({ activity, minutes })).sort((a, b) => b.minutes - a.minutes)
}

/** This week so far, against the weekly targets. */
export function weeklyProgress(
  sessions: Pick<StudySession, 'startedAt' | 'minutes'>[],
  entries: Pick<Entry, 'createdAt'>[],
  now: Date,
): { minutes: number; items: number } {
  const since = startOfWeek(now).getTime()
  const inWeek = (date: string) => new Date(date).getTime() >= since
  return {
    minutes: sessions.filter((session) => inWeek(session.startedAt)).reduce((sum, session) => sum + session.minutes, 0),
    items: entries.filter((entry) => inWeek(entry.createdAt)).length,
  }
}

export type WeaknessDimension = 'kind' | 'tone' | 'context' | 'mode'

export interface AccuracyRow {
  label: string
  correct: number
  total: number
  percent: number
}

/** Fewer answers than this say more about luck than about a weakness. */
export const MIN_ANSWERS = 5

type LogFacts = Pick<ReviewLog, 'entryId' | 'mode' | 'rating'>
type EntryFacts = Pick<Entry, 'id' | 'kind' | 'tone' | 'context'>

function tally(pairs: { label: string; correct: boolean }[]): AccuracyRow[] {
  const rows = new Map<string, { correct: number; total: number }>()
  for (const { label, correct } of pairs) {
    const row = rows.get(label) ?? { correct: 0, total: 0 }
    row.total++
    if (correct) row.correct++
    rows.set(label, row)
  }
  return [...rows]
    .filter(([, row]) => row.total >= MIN_ANSWERS)
    .map(([label, row]) => ({ label, ...row, percent: Math.round((row.correct / row.total) * 100) }))
    .sort((a, b) => a.percent - b.percent || b.total - a.total || a.label.localeCompare(b.label))
}

/** Accuracy for each value of a dimension, weakest first. */
export function accuracyBy(dimension: WeaknessDimension, logs: LogFacts[], entries: EntryFacts[]): AccuracyRow[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  return tally(
    logs.flatMap((log) => {
      const label = dimension === 'mode' ? log.mode : byId.get(log.entryId)?.[dimension]
      return label ? [{ label, correct: isCorrect(log) }] : []
    }),
  )
}

export interface FocusSuggestion {
  context: string
  kind: string
  percent: number
}

/** The weakest kind of item in the weakest situation, such as "Workplace phrasal verbs". */
export function nextFocus(logs: LogFacts[], entries: EntryFacts[]): FocusSuggestion | null {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const SEPARATOR = '\u0000'
  const [weakest] = tally(
    logs.flatMap((log) => {
      const entry = byId.get(log.entryId)
      return entry?.kind && entry.context ? [{ label: `${entry.context}${SEPARATOR}${entry.kind}`, correct: isCorrect(log) }] : []
    }),
  )
  // Nothing is weak if even the lowest score is good.
  if (!weakest || weakest.percent >= 85) return null
  const [context, kind] = weakest.label.split(SEPARATOR) as [string, string]
  return { context, kind, percent: weakest.percent }
}

/** Items used well in the learner's own output, most recent first. */
export function usedInOutput<T extends Pick<Entry, 'stats'>>(entries: T[]): T[] {
  return entries
    .filter((entry) => entry.stats.lastUsedInOutputAt)
    .sort((a, b) => b.stats.lastUsedInOutputAt!.localeCompare(a.stats.lastUsedInOutputAt!))
}

export function recentMistakes(mistakes: Mistake[], limit = 5): Mistake[] {
  return [...mistakes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}
