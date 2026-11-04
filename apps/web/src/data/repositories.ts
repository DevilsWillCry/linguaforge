import { mergeEntries, pairKey } from '@/domain/duplicates'
import { applyReview, undoPatch, type ReviewAnswer } from '@/domain/review'
import type { CoreField, Deck, Enrichment, Entry, MediaKey, ReviewLog, SavedView, StudySession, Transcript, VideoSession } from '@/domain/types'
import { db, type LinguaForgeDb } from './db'

/**
 * Features depend on these interfaces rather than on Dexie, so a Supabase-backed
 * version can be added in Phase 6 without changing them.
 */
export interface DeckRepository {
  list(): Promise<Deck[]>
  setFieldOptions(deckId: string, fieldKey: string, options: string[]): Promise<void>
  /** Renames a dropdown option on the deck and on every entry using it. */
  renameOption(deckId: string, fieldKey: string, from: string, to: string): Promise<void>
}

export interface EntryCounts {
  total: number
  /** Entries not confirmed yet, whether AI has drafted them or not. */
  empty: number
  due: number
}

export interface EntryRepository {
  listByDeck(deckId: string): Promise<Entry[]>
  counts(deckId: string, now?: Date): Promise<EntryCounts>
  findByText(deckId: string, normalizedText: string): Promise<Entry | undefined>
  add(entry: Entry): Promise<void>
  patch(id: string, patch: Partial<Entry>, now?: Date): Promise<void>
  remove(id: string): Promise<void>
  /** Saves new and updated entries from one import, all or nothing. */
  saveImport(toCreate: Entry[], toUpdate: Entry[]): Promise<void>
  /** Merges `otherId` into `keepId` and moves its review history and mistakes across. */
  merge(keepId: string, otherId: string, now?: Date): Promise<void>
  /** Saves one answer and its log together. Returns the updated entry, or null if it was deleted. */
  recordReview(entryId: string, answer: ReviewAnswer, now?: Date): Promise<{ entry: Entry; log: ReviewLog } | null>
  undoReview(log: ReviewLog): Promise<Entry | null>
  /** Ids of the entries reviewed since the given moment, each once. */
  reviewedSince(since: Date): Promise<string[]>
  /** Every entry the enrichment queue has to show or process, in all decks. */
  listUnconfirmed(): Promise<Entry[]>
  /**
   * Changes entries only if they are still in the `from` state. This is what stops a late
   * AI answer from overwriting an entry the user edited while waiting for it.
   */
  moveEnrichment(ids: string[] | 'all', from: Enrichment, change: Partial<Entry>, now?: Date): Promise<void>
  dismissDuplicate(a: string, b: string): Promise<void>
  listDismissedDuplicates(): Promise<string[]>
}

export interface SavedViewRepository {
  listByDeck(deckId: string): Promise<SavedView[]>
  add(view: SavedView): Promise<void>
  remove(id: string): Promise<void>
}

export function createDeckRepository(database: LinguaForgeDb = db): DeckRepository {
  async function updateField(
    deckId: string,
    fieldKey: string,
    change: (options: string[]) => string[],
  ) {
    await database.decks
      .where('id')
      .equals(deckId)
      .modify((deck) => {
        const field = deck.schema.fields.find((f) => f.key === fieldKey)
        if (field) field.options = change(field.options ?? [])
      })
  }

  return {
    list: () => database.decks.orderBy('name').toArray(),

    setFieldOptions: (deckId, fieldKey, options) => updateField(deckId, fieldKey, () => options),

    async renameOption(deckId, fieldKey, from, to) {
      await database.transaction('rw', database.decks, database.entries, async () => {
        const deck = await database.decks.get(deckId)
        const target = deck?.schema.fields.find((f) => f.key === fieldKey)?.target
        await updateField(deckId, fieldKey, (options) => options.map((o) => (o === from ? to : o)))
        if (!target) return
        await database.entries
          .where('deckId')
          .equals(deckId)
          .filter((entry) => entry[target as CoreField & keyof Entry] === from)
          .modify((entry) => {
            Object.assign(entry, { [target]: to, updatedAt: new Date().toISOString() })
          })
      })
    },
  }
}

export function createEntryRepository(database: LinguaForgeDb = db): EntryRepository {
  const inDeck = (deckId: string) => database.entries.where('deckId').equals(deckId)

  return {
    listByDeck: (deckId) => inDeck(deckId).toArray(),

    async counts(deckId, now = new Date()) {
      const iso = now.toISOString()
      const [total, empty, due] = await Promise.all([
        inDeck(deckId).count(),
        inDeck(deckId).filter((e) => e.enrichment !== 'confirmed').count(),
        // Unconfirmed entries have nothing to review yet, so they aren't due.
        inDeck(deckId).filter((e) => e.enrichment === 'confirmed' && e.srs.due <= iso).count(),
      ])
      return { total, empty, due }
    },

    findByText: (deckId, normalizedText) =>
      database.entries.where('[deckId+normalizedText]').equals([deckId, normalizedText]).first(),

    async add(entry) {
      await database.entries.add(entry)
    },

    async patch(id, patch, now = new Date()) {
      await database.entries
        .where('id')
        .equals(id)
        .modify((entry) => {
          Object.assign(entry, patch, { updatedAt: now.toISOString() })
        })
    },

    async remove(id) {
      await database.entries.delete(id)
    },

    async saveImport(toCreate, toUpdate) {
      await database.transaction('rw', database.entries, async () => {
        await database.entries.bulkAdd(toCreate)
        await database.entries.bulkPut(toUpdate)
      })
    },

    async merge(keepId, otherId, now = new Date()) {
      const tables = [database.entries, database.reviewLogs, database.mistakes]
      await database.transaction('rw', tables, async () => {
        const [keep, other] = await Promise.all([
          database.entries.get(keepId),
          database.entries.get(otherId),
        ])
        if (!keep || !other) throw new Error('Cannot merge an entry that no longer exists')
        await database.entries.put(mergeEntries(keep, other, now))
        await database.entries.delete(otherId)
        await database.reviewLogs.where('entryId').equals(otherId).modify({ entryId: keepId })
        await database.mistakes.where('entryId').equals(otherId).modify({ entryId: keepId })
      })
    },

    async recordReview(entryId, answer, now = new Date()) {
      return database.transaction('rw', database.entries, database.reviewLogs, async () => {
        const current = await database.entries.get(entryId)
        if (!current) return null
        const { patch, log } = applyReview(current, answer, now)
        const entry = { ...current, ...patch, updatedAt: now.toISOString() }
        await database.entries.put(entry)
        await database.reviewLogs.add(log)
        return { entry, log }
      })
    },

    async undoReview(log) {
      return database.transaction('rw', database.entries, database.reviewLogs, async () => {
        await database.reviewLogs.delete(log.id)
        const current = await database.entries.get(log.entryId)
        if (!current) return null
        const entry = { ...current, ...undoPatch(log) }
        await database.entries.put(entry)
        return entry
      })
    },

    async reviewedSince(since) {
      const logs = await database.reviewLogs.where('reviewedAt').aboveOrEqual(since.toISOString()).toArray()
      return [...new Set(logs.map((log) => log.entryId))]
    },

    listUnconfirmed: () => database.entries.where('enrichment').anyOf('empty', 'pending', 'draft').toArray(),

    async moveEnrichment(ids, from, change, now = new Date()) {
      const matching = database.entries.where('enrichment').equals(from)
      await (ids === 'all' ? matching : matching.filter((entry) => ids.includes(entry.id))).modify((entry) => {
        Object.assign(entry, change, { updatedAt: now.toISOString() })
      })
    },

    async dismissDuplicate(a, b) {
      await database.dismissedDuplicates.put({ key: pairKey(a, b) })
    },

    listDismissedDuplicates: () => database.dismissedDuplicates.toCollection().primaryKeys(),
  }
}

export function createSavedViewRepository(database: LinguaForgeDb = db): SavedViewRepository {
  return {
    listByDeck: (deckId) => database.savedViews.where('deckId').equals(deckId).sortBy('name'),
    async add(view) {
      await database.savedViews.add(view)
    },
    async remove(id) {
      await database.savedViews.delete(id)
    },
  }
}

export interface StudySessionRepository {
  add(session: StudySession): Promise<void>
}

export function createStudySessionRepository(database: LinguaForgeDb = db): StudySessionRepository {
  return {
    async add(session) {
      await database.studySessions.add(session)
    },
  }
}

export interface VideoRepository {
  getTranscript(id: MediaKey): Promise<Transcript | undefined>
  saveTranscript(transcript: Transcript): Promise<void>
  removeTranscript(id: MediaKey): Promise<void>
  transcriptIds(): Promise<MediaKey[]>
  getSession(id: MediaKey): Promise<VideoSession | undefined>
  saveSession(session: VideoSession): Promise<void>
  recentSessions(limit: number): Promise<VideoSession[]>
}

export function createVideoRepository(database: LinguaForgeDb = db): VideoRepository {
  return {
    getTranscript: (id) => database.transcripts.get(id),
    async saveTranscript(transcript) {
      await database.transcripts.put(transcript)
    },
    async removeTranscript(id) {
      await database.transcripts.delete(id)
    },
    transcriptIds: () => database.transcripts.toCollection().primaryKeys(),
    getSession: (id) => database.videoSessions.get(id),
    async saveSession(session) {
      await database.videoSessions.put(session)
    },
    recentSessions: (limit) => database.videoSessions.orderBy('updatedAt').reverse().limit(limit).toArray(),
  }
}

export const videoRepository = createVideoRepository()
export const studySessionRepository = createStudySessionRepository()
export const deckRepository = createDeckRepository()
export const entryRepository = createEntryRepository()
export const savedViewRepository = createSavedViewRepository()
