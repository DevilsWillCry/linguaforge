/** Domain types. Pure TypeScript: nothing here may import Vue or Dexie. */

import type { LibraryFilters, SortKey } from './libraryQuery'

export const ENTRY_KINDS = [
  'Word', 'Expression', 'Slang', 'Idiom', 'Connector',
  'Sentence Pattern', 'Phrasal Verb', 'Modal Verb', 'N/A',
] as const
export type EntryKind = (typeof ENTRY_KINDS)[number]

export const TONES = [
  'Casual', 'Informal', 'Formal', 'Polite', 'Neutral', 'Emotional', 'Excited',
  'Sarcastic', 'Confident', 'Awkward', 'Romantic', 'Aggressive', 'Rude', 'Funny',
  'Motivational', 'Frustrated', 'Chill', 'Internet Slang', 'Professional', 'Dramatic',
] as const

export const CONTEXTS = [
  'Daily Conversation', 'Workplace', 'Friendly', 'Gaming', 'Arguments',
  'School / College', 'Small Talk', 'Business', 'Coding / Tech',
] as const

export const LEARNING_STATUSES = ['New', 'Learning', 'Familiar', 'Natural', 'N/A'] as const

/** How much an item matters. Separate from status, which tracks how well it's learned. */
export const IMPORTANCE_LEVELS = ['Important', 'Advanced', 'Critical'] as const

export type Enrichment = 'empty' | 'pending' | 'draft' | 'confirmed'

export const REVIEW_MODES = [
  'cloze', 'production', 'collocation', 'toneContext',
  'listening', 'speaking', 'useIt', 'reverse',
] as const
export type ReviewMode = (typeof REVIEW_MODES)[number]

/** Dates are ISO 8601 strings: they sort correctly when indexed and survive JSON backups. */
export type IsoDate = string

/**
 * FSRS card state, in camelCase. Mirrors the whole ts-fsrs `Card`, including
 * `scheduledDays` and `learningSteps`, which FSRS needs to resume a card correctly.
 */
export interface SrsState {
  due: IsoDate
  stability: number
  difficulty: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview?: IsoDate
}

export interface EntrySource {
  title?: string
  url?: string
  videoId?: string
  startSec?: number
  endSec?: number
}

export interface EntryStats {
  correctByMode: Partial<Record<ReviewMode, number>>
  /** The mode of the latest review, so the next one can test the item differently. */
  lastMode?: ReviewMode
  lastUsedInOutputAt?: IsoDate
}

/** A note written by AI. It stays apart from the entry's fields until the user confirms it. */
export interface EnrichmentDraft {
  kind: string
  meanings: string[]
  tone: string
  context: string
  realExamples: string[]
  variations: string[]
  collocations: string[]
  ipa: string
  notes: string
  priority: number
}

/** AI feedback on a sentence the user wrote. */
export interface SentenceFeedback {
  verdict: 'natural' | 'understandable' | 'incorrect'
  usesTarget: boolean
  grammar: string
  naturalness: string
  toneFit: string
  betterVersion: string
}

export interface Entry {
  id: string
  deckId: string
  priority: number
  /** Value of the deck's `kind` field. Empty for decks that don't have one. */
  kind: string
  text: string
  /** Lowercased, trimmed form of `text`. Indexed for dedupe in Phase 1. */
  normalizedText: string
  meanings: string[]
  tone: string
  context: string
  realExamples: string[]
  /** Written by the user. Never fill this with AI output. */
  ownExamples: string[]
  variations: string[]
  collocations: string[]
  /** Learning stage, from LEARNING_STATUSES. Reviews move it forward automatically. */
  status: string
  /** The user chose the status by hand, so reviews leave it alone. */
  statusManual?: boolean
  /** Set by decks that have an importance field. Reviews never change it. */
  importance?: string
  trigger: string
  source: EntrySource
  tags: string[]
  notes?: string
  ipa?: string
  audioUrl?: string
  /** Deck-specific fields with no core column, such as "Equivalent in React". */
  custom: Record<string, string>
  createdAt: IsoDate
  updatedAt: IsoDate
  enrichment: Enrichment
  /** Present while `enrichment` is 'draft'. */
  aiDraft?: EnrichmentDraft
  /** Why AI couldn't complete this entry. The queue skips it until the user retries. */
  aiError?: string
  /** The latest feedback, kept so asking about the same sentence again costs nothing. */
  aiFeedback?: { sentence: string; feedback: SentenceFeedback }
  srs: SrsState
  stats: EntryStats
}

/** Core `Entry` fields that a spreadsheet column can map to. */
export type CoreField =
  | 'priority' | 'kind' | 'text' | 'meanings' | 'tone' | 'context' | 'realExamples'
  | 'ownExamples' | 'variations' | 'collocations' | 'status' | 'importance' | 'trigger' | 'source'

export type FieldType = 'text' | 'multiline' | 'list' | 'select' | 'number' | 'url'

export interface FieldDef {
  /** Exact spreadsheet header, typos included. Export needs it to round-trip. */
  column: string
  /** Stable key for labels and for `Entry.custom`. */
  key: string
  type: FieldType
  /** Where the value is stored. Left out, it goes to `Entry.custom[key]`. */
  target?: CoreField
  /** Choices for `select` fields. Editable in Settings from Phase 1. */
  options?: string[]
}

export interface DeckSchema {
  fields: FieldDef[]
  /** IPA, tone and pronunciation features apply only to language decks. */
  languageFeatures: boolean
}

export interface Deck {
  id: string
  name: string
  schema: DeckSchema
  createdAt: IsoDate
}

/** A named set of Library filters and sort order. */
export interface SavedView {
  id: string
  deckId: string
  name: string
  filters: LibraryFilters
  sort: SortKey[]
}

export interface ReviewLog {
  id: string
  entryId: string
  mode: ReviewMode
  /** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy */
  rating: 1 | 2 | 3 | 4
  reviewedAt: IsoDate
  /** Card state before the answer, which is what makes undo possible. */
  previous: SrsState
  previousStatus?: string
  previousStats?: EntryStats
}

export interface StudySession {
  id: string
  activity: string
  startedAt: IsoDate
  minutes: number
}

/** One line of a transcript, with its times in seconds. */
export interface Cue {
  startSec: number
  endSec: number
  text: string
}

/** Identifies what's being watched: `yt:<id>`, or `file:<name>:<size>` for a local file. */
export type MediaKey = string

/** A transcript the user supplied, kept so it never has to be loaded twice. */
export interface Transcript {
  id: MediaKey
  name: string
  cues: Cue[]
  updatedAt: IsoDate
}

export interface VideoSession {
  id: MediaKey
  /** The YouTube id. Local files have none and must be chosen again to replay. */
  videoId?: string
  title?: string
  positionSec: number
  minutesWatched: number
  wordsCaptured: number
  updatedAt: IsoDate
}

export interface TutorCorrection {
  isNatural: boolean
  natural: string
  reason: string
  toneNote: string
  keyPhrase: string
}

export interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
  at: IsoDate
  /** On the learner's lines: how a native speaker would say it. */
  correction?: TutorCorrection
  /** On the learner's lines: targets used correctly. */
  usedTargets?: string[]
  /** On the tutor's lines: something worth learning from them. */
  newExpression?: { text: string; meaning: string }
  /** Already saved to the Library, so it can't be saved twice. */
  saved?: boolean
}

export interface TutorConversation {
  id: string
  scenario: string
  /** Texts of the Library items this conversation practices. */
  targets?: string[]
  messages: TutorMessage[]
  updatedAt: IsoDate
}

export interface Mistake {
  id: string
  error: string
  correction: string
  explanation?: string
  entryId?: string
  createdAt: IsoDate
}
