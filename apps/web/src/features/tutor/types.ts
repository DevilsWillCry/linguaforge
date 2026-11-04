import type { TutorCorrection } from '@/domain/types'
import type { AiUsage } from '@/features/enrichment/enrichmentApi'

export const SCENARIO_IDS = [
  'standup', 'codeReview', 'pairProgramming', 'jobInterview',
  'customerCall', 'disagreement', 'smallTalk', 'gaming',
] as const
export type ScenarioId = (typeof SCENARIO_IDS)[number]

export interface TutorTurnResult {
  turn: {
    reply: string
    correction: TutorCorrection | null
    usedTargets: string[]
    newExpression: { text: string; meaning: string } | null
  }
  usage: AiUsage
}

export interface OutputReview {
  feedback: string
  corrected: string
  items: { text: string; used: boolean; correct: boolean; note: string }[]
}

export interface OutputReviewResult {
  review: OutputReview
  usage: AiUsage
}
