import Dexie, { type EntityTable } from 'dexie'
import { DECK_PRESETS, VUE_DECK_ID, VUE_SCHEMA } from '@/domain/deckPresets'
import { rowsToEntries, splitStatus, type RawRow } from '@/domain/rows'
import { normalizeText } from '@/domain/text'
import {
  IMPORTANCE_LEVELS,
  type Deck,
  type Entry,
  type Mistake,
  type ReviewLog,
  type SavedView,
  type StudySession,
  type Transcript,
  type TutorConversation,
  type VideoSession,
} from '@/domain/types'
import seedData from './seed/seed-data.json'

export class LinguaForgeDb extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  entries!: EntityTable<Entry, 'id'>
  reviewLogs!: EntityTable<ReviewLog, 'id'>
  studySessions!: EntityTable<StudySession, 'id'>
  videoSessions!: EntityTable<VideoSession, 'id'>
  tutorConversations!: EntityTable<TutorConversation, 'id'>
  mistakes!: EntityTable<Mistake, 'id'>
  savedViews!: EntityTable<SavedView, 'id'>
  dismissedDuplicates!: EntityTable<{ key: string }, 'key'>
  transcripts!: EntityTable<Transcript, 'id'>

  constructor(name = 'linguaforge') {
    super(name)

    // Schema strings list indexed fields only; "*tags" indexes each array item.
    // To change the schema, add a new version() rather than editing this one.
    this.version(1).stores({
      decks: 'id, name',
      entries:
        'id, deckId, status, kind, priority, enrichment, srs.due, updatedAt, *tags, [deckId+normalizedText]',
      reviewLogs: 'id, entryId, reviewedAt',
      studySessions: 'id, startedAt, activity',
      videoSessions: 'id, videoId, updatedAt',
      tutorConversations: 'id, updatedAt',
      mistakes: 'id, entryId, createdAt',
    })

    // v2: importance labels move out of the Vue deck's status into their own field.
    this.version(2)
      .stores({
        entries:
          'id, deckId, status, importance, kind, priority, enrichment, srs.due, updatedAt, *tags, [deckId+normalizedText]',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Entry, string>('entries')
          .where('deckId')
          .equals(VUE_DECK_ID)
          .modify((entry) => {
            const { status, importance } = splitStatus(entry.status, IMPORTANCE_LEVELS)
            entry.status = status
            if (importance) entry.importance = importance
          })
        await tx.table<Deck, string>('decks').update(VUE_DECK_ID, { schema: VUE_SCHEMA })
      })

    // v3: saved filters and dismissed duplicate suggestions. normalizeText() now also
    // ignores trailing punctuation, so stored keys are recalculated.
    this.version(3)
      .stores({
        savedViews: 'id, deckId',
        dismissedDuplicates: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Entry, string>('entries')
          .toCollection()
          .modify((entry) => {
            entry.normalizedText = normalizeText(entry.text)
          })
      })

    // v4: transcripts the user loaded in the Video Lab. Sessions become keyed by media,
    // and nothing could be saved in that table before this version.
    this.version(4).stores({ transcripts: 'id, updatedAt' })

    // "populate" fires once, when the database is first created, inside an atomic
    // transaction. Entries the user later deletes therefore never come back.
    this.on('populate', (tx) => {
      const now = new Date()
      for (const preset of DECK_PRESETS) {
        const deck: Deck = {
          id: preset.id,
          name: preset.name,
          schema: preset.schema,
          createdAt: now.toISOString(),
        }
        const rows = seedData[preset.seedKey] as RawRow[]
        void tx.table('decks').add(deck)
        void tx.table('entries').bulkAdd(rowsToEntries(rows, deck, now))
      }
    })
  }
}

export const db = new LinguaForgeDb()
