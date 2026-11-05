import { describe, expect, it } from 'vitest'
import {
  accuracyBy,
  activityCalendar,
  dayKey,
  dueForecast,
  minutesByActivity,
  nextFocus,
  outputDays,
  outputStreak,
  recentMistakes,
  retention,
  startOfWeek,
  statusFunnel,
  usedInOutput,
  weeklyProgress,
} from './analytics'
import { SESSION_PLANS, planMinutes, targetsFor } from './sessionPlans'
import type { ReviewLog, StudySession } from './types'

// A Wednesday.
const NOW = new Date(2026, 10, 4, 15, 0)
const at = (daysAgo: number, hour = 12) => new Date(2026, 10, 4 - daysAgo, hour).toISOString()

const log = (over: Partial<ReviewLog> = {}): ReviewLog =>
  ({ id: 'l', entryId: 'a', mode: 'cloze', rating: 3, reviewedAt: at(0), previous: { reps: 1 }, ...over }) as ReviewLog
const session = (over: Partial<StudySession> = {}): StudySession => ({ id: 's', activity: 'warmup', startedAt: at(0), minutes: 10, ...over })

describe('dueForecast', () => {
  const due = (daysFromNow: number) => ({ srs: { due: at(-daysFromNow) } }) as never

  it('counts cards on the day they come due', () => {
    const forecast = dueForecast([due(1), due(1), due(3)], NOW, 5)
    expect(forecast.map((day) => day.count)).toEqual([0, 2, 0, 1, 0])
    expect(forecast[0]!.day).toBe('2026-11-04')
  })

  it('counts overdue cards as today', () => {
    expect(dueForecast([due(-9), due(0)], NOW, 2).map((day) => day.count)).toEqual([2, 0])
  })

  it('leaves out what is due after the period', () => {
    expect(dueForecast([due(40)], NOW, 14).every((day) => day.count === 0)).toBe(true)
  })
})

describe('retention', () => {
  it('has no value until something seen before is answered', () => {
    expect(retention([log({ previous: { reps: 0 } as never })], NOW)).toEqual({ percent: null, reviews: 0 })
  })

  it('counts Hard as remembered and Again as forgotten', () => {
    expect(retention([log({ rating: 1 }), log({ rating: 2 }), log({ rating: 3 }), log({ rating: 4 })], NOW)).toEqual({ percent: 75, reviews: 4 })
  })

  it('ignores first answers and old answers', () => {
    const logs = [log({ rating: 3 }), log({ rating: 1, previous: { reps: 0 } as never }), log({ rating: 1, reviewedAt: at(31) })]
    expect(retention(logs, NOW)).toEqual({ percent: 100, reviews: 1 })
  })
})

describe('outputDays and the streak', () => {
  it('counts tutor lines, "use it" reviews and writing tasks, but nothing passive', () => {
    const days = outputDays(
      [log({ mode: 'useIt', reviewedAt: at(1) }), log({ mode: 'cloze', reviewedAt: at(2) })],
      [{ messages: [{ role: 'user', content: 'hi', at: at(3) }, { role: 'assistant', content: 'hello', at: at(4) }] }],
      [session({ activity: 'writing', startedAt: at(5) }), session({ activity: 'warmup', startedAt: at(6) })],
    )
    expect([...days].sort()).toEqual(['2026-10-30', '2026-11-01', '2026-11-03'])
  })

  it('counts consecutive days ending today', () => {
    expect(outputStreak(new Set([dayKey(NOW), '2026-11-03', '2026-11-02', '2026-10-30']), NOW)).toBe(3)
  })

  it('does not break just because today has not happened yet', () => {
    expect(outputStreak(new Set(['2026-11-03', '2026-11-02']), NOW)).toBe(2)
  })

  it('is broken by a whole missed day', () => {
    expect(outputStreak(new Set(['2026-11-02', '2026-11-01']), NOW)).toBe(0)
  })

  it('crosses a month boundary', () => {
    expect(outputStreak(new Set(['2026-11-04', '2026-11-03', '2026-11-02', '2026-11-01', '2026-10-31']), NOW)).toBe(5)
  })
})

describe('activityCalendar', () => {
  it('starts on a Monday and stops today', () => {
    const cells = activityCalendar([], [], new Set(), NOW, 2)
    expect(cells[0]!.day).toBe('2026-10-26')
    expect(cells.at(-1)!.day).toBe('2026-11-04')
    expect(cells).toHaveLength(10)
  })

  it('shades days relative to the busiest one', () => {
    const logs = [...Array(8)].map(() => log({ reviewedAt: at(0) })).concat(log({ reviewedAt: at(1) }))
    const cells = activityCalendar(logs, [session({ startedAt: at(2), minutes: 4 })], new Set(), NOW, 1)
    expect(cells.at(-1)).toMatchObject({ reviews: 8, level: 4 })
    expect(cells.at(-2)).toMatchObject({ reviews: 1, level: 1 })
    expect(cells.at(-3)).toMatchObject({ minutes: 4, level: 2 })
  })

  it('still shows a day that only had output', () => {
    const cells = activityCalendar([], [], new Set(['2026-11-04']), NOW, 1)
    expect(cells.at(-1)).toMatchObject({ output: true, level: 1 })
  })

  it('leaves idle days blank', () => {
    expect(activityCalendar([log()], [], new Set(), NOW, 1)[0]!.level).toBe(0)
  })
})

describe('statusFunnel', () => {
  it('counts each stage in learning order, leaving out N/A', () => {
    const entries = ['New', 'New', 'Learning', 'Natural', 'N/A'].map((status) => ({ status }))
    expect(statusFunnel(entries)).toEqual([
      { status: 'New', count: 2 },
      { status: 'Learning', count: 1 },
      { status: 'Familiar', count: 0 },
      { status: 'Natural', count: 1 },
    ])
  })
})

describe('minutes', () => {
  it('adds up the last week per activity, most first', () => {
    const sessions = [
      session({ activity: 'input', minutes: 5 }),
      session({ activity: 'warmup', minutes: 10 }),
      session({ activity: 'warmup', minutes: 10, startedAt: at(6) }),
      session({ activity: 'warmup', minutes: 99, startedAt: at(7) }),
      session({ activity: 'writing', minutes: 0 }),
    ]
    expect(minutesByActivity(sessions, NOW)).toEqual([
      { activity: 'warmup', minutes: 20 },
      { activity: 'input', minutes: 5 },
    ])
  })

  it('starts the week on Monday, also when today is a Sunday', () => {
    expect(dayKey(startOfWeek(NOW))).toBe('2026-11-02')
    expect(dayKey(startOfWeek(new Date(2026, 10, 8, 23)))).toBe('2026-11-02')
  })

  it('counts this week against the targets', () => {
    const progress = weeklyProgress(
      [session({ minutes: 20 }), session({ minutes: 50, startedAt: at(3) })],
      [{ createdAt: at(1) }, { createdAt: at(3) }],
      NOW,
    )
    expect(progress).toEqual({ minutes: 20, items: 1 })
  })
})

describe('weaknesses', () => {
  const entries = [
    { id: 'a', kind: 'Phrasal Verb', tone: 'Casual', context: 'Workplace' },
    { id: 'b', kind: 'Idiom', tone: 'Formal', context: 'Gaming' },
  ]
  const answers = (entryId: string, right: number, wrong: number) => [
    ...Array.from({ length: right }, () => log({ entryId, rating: 3 })),
    ...Array.from({ length: wrong }, () => log({ entryId, rating: 1 })),
  ]

  it('ranks by accuracy, weakest first', () => {
    const rows = accuracyBy('context', [...answers('a', 2, 8), ...answers('b', 9, 1)], entries)
    expect(rows).toEqual([
      { label: 'Workplace', correct: 2, total: 10, percent: 20 },
      { label: 'Gaming', correct: 9, total: 10, percent: 90 },
    ])
  })

  it('leaves out anything with too few answers to mean much', () => {
    expect(accuracyBy('kind', answers('a', 1, 3), entries)).toEqual([])
  })

  it('reports modes from the answers themselves', () => {
    const logs = [...Array(5)].map(() => log({ mode: 'listening', rating: 1 }))
    expect(accuracyBy('mode', logs, entries)[0]).toMatchObject({ label: 'listening', percent: 0 })
  })

  it('ignores answers for deleted entries', () => {
    expect(accuracyBy('tone', answers('gone', 5, 5), entries)).toEqual([])
  })

  it('suggests the weakest kind within a context', () => {
    expect(nextFocus([...answers('a', 2, 8), ...answers('b', 9, 1)], entries)).toEqual({ context: 'Workplace', kind: 'Phrasal Verb', percent: 20 })
  })

  it('suggests nothing without enough answers, or when all is going well', () => {
    expect(nextFocus(answers('a', 1, 1), entries)).toBeNull()
    expect(nextFocus(answers('a', 9, 1), entries)).toBeNull()
  })
})

describe('lists', () => {
  it('shows items used in output, most recent first', () => {
    const items = [
      { id: 'old', stats: { correctByMode: {}, lastUsedInOutputAt: at(5) } },
      { id: 'never', stats: { correctByMode: {} } },
      { id: 'new', stats: { correctByMode: {}, lastUsedInOutputAt: at(1) } },
    ]
    expect(usedInOutput(items).map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('shows the latest mistakes first, up to the limit', () => {
    const mistakes = [1, 2, 3].map((n) => ({ id: String(n), error: '', correction: '', createdAt: at(n) }))
    expect(recentMistakes(mistakes, 2).map((item) => item.id)).toEqual(['1', '2'])
  })
})

describe('session plans', () => {
  it('match the lengths promised for each intensity', () => {
    expect(planMinutes('light')).toBe(20)
    expect(planMinutes('standard')).toBe(45)
    expect(planMinutes('intensive')).toBe(90)
    expect(planMinutes('immersion')).toBeGreaterThanOrEqual(120)
    expect(planMinutes('rescue')).toBe(5)
  })

  it('always include output, which is what the streak counts', () => {
    for (const plan of Object.values(SESSION_PLANS)) expect(plan.some((step) => step.id === 'output')).toBe(true)
  })

  it('split Immersion into blocks with a real break', () => {
    expect(SESSION_PLANS.immersion.some((step) => step.id === 'break')).toBe(true)
  })

  it('scale the weekly targets with the intensity', () => {
    expect(targetsFor('light').minutes).toBeLessThan(targetsFor('intensive').minutes)
    expect(targetsFor('standard')).toEqual({ minutes: 225, items: 30 })
  })
})
