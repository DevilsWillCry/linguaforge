import { createEmptyCard, type Card } from 'ts-fsrs'
import type { SrsState } from './types'

/** Converts a ts-fsrs card to the form we store. */
export function cardToSrs(card: Card): SrsState {
  return {
    due: new Date(card.due).toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    ...(card.last_review ? { lastReview: new Date(card.last_review).toISOString() } : {}),
  }
}

/** Converts stored state back to a card that ts-fsrs can schedule. */
export function srsToCard(srs: SrsState): Card {
  return {
    due: new Date(srs.due),
    stability: srs.stability,
    difficulty: srs.difficulty,
    scheduled_days: srs.scheduledDays,
    learning_steps: srs.learningSteps,
    reps: srs.reps,
    lapses: srs.lapses,
    state: srs.state,
    last_review: srs.lastReview ? new Date(srs.lastReview) : undefined,
  } as Card
}

export function newSrsState(now: Date = new Date()): SrsState {
  return cardToSrs(createEmptyCard(now))
}
