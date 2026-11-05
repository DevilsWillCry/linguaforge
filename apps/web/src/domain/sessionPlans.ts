export type StepId = 'warmup' | 'new' | 'input' | 'output' | 'break' | 'wrapup'

export interface SessionStep {
  id: StepId
  minutes: number
  /** Where the step happens. The wrap-up and breaks happen on the Today page itself. */
  path?: string
}

const PATHS: Partial<Record<StepId, string>> = { warmup: '/review', new: '/enrich', input: '/video', output: '/tutor' }

const steps = (...plan: [StepId, number][]): SessionStep[] =>
  plan.map(([id, minutes]) => ({ id, minutes, ...(PATHS[id] ? { path: PATHS[id] } : {}) }))

export const INTENSITIES = ['light', 'standard', 'intensive', 'immersion'] as const
export type Intensity = (typeof INTENSITIES)[number]
export type SessionPlanId = Intensity | 'rescue'

/** Every plan ends in output, because that's the part that builds fluency and keeps the streak. */
export const SESSION_PLANS: Record<SessionPlanId, SessionStep[]> = {
  light: steps(['warmup', 7], ['new', 3], ['input', 4], ['output', 5], ['wrapup', 1]),
  standard: steps(['warmup', 10], ['new', 10], ['input', 10], ['output', 10], ['wrapup', 5]),
  intensive: steps(['warmup', 15], ['new', 15], ['input', 25], ['output', 25], ['wrapup', 10]),
  // More than two hours only works in blocks, with real rest between them.
  immersion: steps(['warmup', 15], ['new', 15], ['input', 30], ['output', 20], ['break', 10], ['input', 30], ['output', 20], ['wrapup', 5]),
  rescue: steps(['warmup', 3], ['output', 2]),
}

export const planMinutes = (plan: SessionPlanId) => SESSION_PLANS[plan].reduce((sum, step) => sum + step.minutes, 0)

export interface WeeklyTargets {
  minutes: number
  items: number
}

export const DEFAULT_WEEKLY_TARGETS: WeeklyTargets = { minutes: 225, items: 30 }

/** Five sessions a week at this intensity, and about as many new items as it has time for. */
export function targetsFor(intensity: Intensity): WeeklyTargets {
  const newMinutes = SESSION_PLANS[intensity].filter((step) => step.id === 'new').reduce((sum, step) => sum + step.minutes, 0)
  return { minutes: planMinutes(intensity) * 5, items: newMinutes * 3 }
}
