import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import { afterEach, describe, expect, it } from 'vitest'
import { ENGLISH_DECK_ID, VUE_DECK_ID, VUE_SCHEMA } from '@/domain/deckPresets'
import { LinguaForgeDb } from './db'
import { createDeckRepository, createEntryRepository } from './repositories'

const open: LinguaForgeDb[] = []
function freshDb(name = `test-${nanoid()}`) {
  const database = new LinguaForgeDb(name)
  open.push(database)
  return database
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((database) => database.delete()))
})

describe('seeding', () => {
  it('creates both decks and all their entries', async () => {
    const database = freshDb()
    expect((await createDeckRepository(database).list()).map((d) => d.name)).toEqual([
      'English',
      'Vue 3 / Tech',
    ])
    expect(await database.entries.where('deckId').equals(ENGLISH_DECK_ID).count()).toBe(12)
    expect(await database.entries.where('deckId').equals(VUE_DECK_ID).count()).toBe(27)
  })

  it('does not bring deleted entries back when the database reopens', async () => {
    const name = `test-${nanoid()}`
    const first = freshDb(name)
    await first.entries.where('deckId').equals(ENGLISH_DECK_ID).delete()
    first.close()

    const second = freshDb(name)
    expect(await second.entries.where('deckId').equals(ENGLISH_DECK_ID).count()).toBe(0)
    expect(await second.entries.where('deckId').equals(VUE_DECK_ID).count()).toBe(27)
  })
})

describe('upgrading a v1 database', () => {
  /** Creates a database as Phase 0 left it. A frozen copy, so it must not follow db.ts. */
  async function createV1Db(name: string) {
    const v1 = new Dexie(name)
    v1.version(1).stores({
      decks: 'id, name',
      entries:
        'id, deckId, status, kind, priority, enrichment, srs.due, updatedAt, *tags, [deckId+normalizedText]',
      reviewLogs: 'id, entryId, reviewedAt',
      studySessions: 'id, startedAt, activity',
      videoSessions: 'id, videoId, updatedAt',
      tutorConversations: 'id, updatedAt',
      mistakes: 'id, entryId, createdAt',
    })
    await v1.table('decks').bulkAdd([
      { id: VUE_DECK_ID, name: 'Vue 3 / Tech', schema: { fields: [], languageFeatures: false } },
      { id: ENGLISH_DECK_ID, name: 'English', schema: { fields: [], languageFeatures: true } },
    ])
    await v1.table('entries').bulkAdd([
      { id: 'props', deckId: VUE_DECK_ID, text: 'Props', status: 'Important' },
      { id: 'vite', deckId: VUE_DECK_ID, text: 'Vite', status: 'Learning' },
      { id: 'forms', deckId: VUE_DECK_ID, text: 'Custom v-model', status: 'Advanced' },
      { id: 'mine', deckId: VUE_DECK_ID, text: 'Added by me', status: 'Critical', notes: 'keep me' },
      { id: 'word', deckId: ENGLISH_DECK_ID, text: 'Figure out', status: 'Familiar' },
    ])
    v1.close()
  }

  async function upgraded() {
    const name = `test-${nanoid()}`
    await createV1Db(name)
    return freshDb(name)
  }

  it('moves importance labels out of status', async () => {
    const database = await upgraded()
    expect(await database.entries.get('props')).toMatchObject({ status: 'New', importance: 'Important' })
    expect(await database.entries.get('forms')).toMatchObject({ status: 'New', importance: 'Advanced' })
  })

  it('leaves learning stages and the English deck alone', async () => {
    const database = await upgraded()
    const vite = await database.entries.get('vite')
    expect(vite?.status).toBe('Learning')
    expect(vite?.importance).toBeUndefined()
    const word = await database.entries.get('word')
    expect(word?.status).toBe('Familiar')
    expect(word?.importance).toBeUndefined()
  })

  it('keeps other data and does not re-seed', async () => {
    const database = await upgraded()
    expect(await database.entries.get('mine')).toMatchObject({ importance: 'Critical', notes: 'keep me' })
    expect(await database.entries.count()).toBe(5)
  })

  it('updates only the Vue deck schema', async () => {
    const database = await upgraded()
    expect((await database.decks.get(VUE_DECK_ID))?.schema).toEqual(VUE_SCHEMA)
    expect((await database.decks.get(ENGLISH_DECK_ID))?.schema.fields).toEqual([])
  })

  it('can query by the new importance index', async () => {
    const database = await upgraded()
    const critical = await database.entries.where('importance').equals('Critical').toArray()
    expect(critical.map((e) => e.id)).toEqual(['mine'])
  })
})

describe('upgrading to v3', () => {
  it('recalculates duplicate keys with the new normalization', async () => {
    const name = `test-${nanoid()}`
    const v2 = new Dexie(name)
    v2.version(2).stores({
      decks: 'id, name',
      entries:
        'id, deckId, status, importance, kind, priority, enrichment, srs.due, updatedAt, *tags, [deckId+normalizedText]',
      reviewLogs: 'id, entryId, reviewedAt',
      studySessions: 'id, startedAt, activity',
      videoSessions: 'id, videoId, updatedAt',
      tutorConversations: 'id, updatedAt',
      mistakes: 'id, entryId, createdAt',
    })
    await v2.table('entries').add({
      id: 'btw',
      deckId: ENGLISH_DECK_ID,
      text: 'By the way...',
      normalizedText: 'by the way...',
    })
    v2.close()

    const repository = createEntryRepository(freshDb(name))
    expect((await repository.findByText(ENGLISH_DECK_ID, 'by the way'))?.id).toBe('btw')
  })
})

describe('deck repository', () => {
  it('renames an option on the deck and on every entry using it', async () => {
    const database = freshDb()
    await createDeckRepository(database).renameOption(ENGLISH_DECK_ID, 'tone', 'Casual', 'Relaxed')

    const deck = await database.decks.get(ENGLISH_DECK_ID)
    const options = deck?.schema.fields.find((f) => f.key === 'tone')?.options
    expect(options).toContain('Relaxed')
    expect(options).not.toContain('Casual')

    const entries = await database.entries.where('deckId').equals(ENGLISH_DECK_ID).toArray()
    expect(entries.find((e) => e.text === 'Figure out')?.tone).toBe('Relaxed')
    expect(entries.find((e) => e.text === "I'm down")?.tone).toBe('Informal')
  })

  it('leaves other decks alone', async () => {
    const database = freshDb()
    await createDeckRepository(database).setFieldOptions(ENGLISH_DECK_ID, 'tone', ['Only'])
    const decks = await database.decks.toArray()
    const toneOptions = decks.map((d) => d.schema.fields.find((f) => f.key === 'tone')?.options)
    expect(toneOptions).toContainEqual(['Only'])
    expect(decks.find((d) => d.id === VUE_DECK_ID)?.schema).toEqual(VUE_SCHEMA)
  })
})

describe('entry repository', () => {
  it('saves changes and stamps the update time', async () => {
    const database = freshDb()
    const repository = createEntryRepository(database)
    const [entry] = await repository.listByDeck(ENGLISH_DECK_ID)
    const now = new Date('2030-01-01T00:00:00.000Z')
    await repository.patch(entry!.id, { tone: 'Formal' }, now)
    expect(await database.entries.get(entry!.id)).toMatchObject({
      tone: 'Formal',
      updatedAt: now.toISOString(),
      text: entry!.text,
    })
  })

  it('finds an entry by its duplicate key within one deck', async () => {
    const repository = createEntryRepository(freshDb())
    expect((await repository.findByText(ENGLISH_DECK_ID, 'figure out'))?.text).toBe('Figure out')
    expect(await repository.findByText(VUE_DECK_ID, 'figure out')).toBeUndefined()
  })

  it('merges entries and moves their history to the one kept', async () => {
    const database = freshDb()
    const repository = createEntryRepository(database)
    const keep = await repository.findByText(ENGLISH_DECK_ID, 'figure out')
    const other = await repository.findByText(ENGLISH_DECK_ID, 'borrow')
    await database.mistakes.add({ id: 'm', error: 'e', correction: 'c', entryId: other!.id, createdAt: 'x' })
    await database.reviewLogs.add({
      id: 'r', entryId: other!.id, mode: 'cloze', rating: 3, reviewedAt: 'x', previous: other!.srs,
    })

    await repository.merge(keep!.id, other!.id)

    expect(await database.entries.get(other!.id)).toBeUndefined()
    expect((await database.entries.get(keep!.id))?.variations).toContain('Borrow')
    expect((await database.mistakes.get('m'))?.entryId).toBe(keep!.id)
    expect((await database.reviewLogs.get('r'))?.entryId).toBe(keep!.id)
  })

  it('remembers dismissed duplicates in either order', async () => {
    const repository = createEntryRepository(freshDb())
    await repository.dismissDuplicate('b', 'a')
    await repository.dismissDuplicate('a', 'b')
    expect(await repository.listDismissedDuplicates()).toEqual(['a|b'])
  })

  it('saves an import all or nothing', async () => {
    const database = freshDb()
    const repository = createEntryRepository(database)
    const [existing] = await repository.listByDeck(ENGLISH_DECK_ID)
    await expect(repository.saveImport([existing!], [])).rejects.toThrow()
    expect(await database.entries.count()).toBe(39)
  })

  it('leaves entries awaiting enrichment out of the due count', async () => {
    const counts = await createEntryRepository(freshDb()).counts(
      ENGLISH_DECK_ID,
      new Date(Date.now() + 1000),
    )
    expect(counts).toEqual({ total: 12, empty: 8, due: 4 })
  })

  it('does not count cards due in the future', async () => {
    const counts = await createEntryRepository(freshDb()).counts(
      ENGLISH_DECK_ID,
      new Date('2000-01-01'),
    )
    expect(counts.due).toBe(0)
  })
})

describe('moveEnrichment', () => {
  async function pendingEntry() {
    const database = freshDb()
    const repo = createEntryRepository(database)
    const entry = (await repo.listUnconfirmed()).find((e) => e.text === 'Borrow')!
    await repo.moveEnrichment([entry.id], 'empty', { enrichment: 'pending' })
    return { repo, id: entry.id }
  }
  const stored = async (repo: ReturnType<typeof createEntryRepository>, id: string) =>
    (await repo.listUnconfirmed()).find((e) => e.id === id)

  it('moves an entry that is still in the expected state', async () => {
    const { repo, id } = await pendingEntry()
    await repo.moveEnrichment([id], 'pending', { enrichment: 'draft' })
    expect((await stored(repo, id))?.enrichment).toBe('draft')
  })

  it('ignores an entry that has changed since, as when the user edited it', async () => {
    const { repo, id } = await pendingEntry()
    await repo.patch(id, { enrichment: 'confirmed', meanings: ['Mine'] })
    await repo.moveEnrichment([id], 'pending', { enrichment: 'draft', meanings: ['AI'] })
    expect(await stored(repo, id)).toBeUndefined()
    const [kept] = (await repo.listByDeck(ENGLISH_DECK_ID)).filter((e) => e.id === id)
    expect(kept?.meanings).toEqual(['Mine'])
  })

  it('can release every entry left pending by a closed page', async () => {
    const { repo, id } = await pendingEntry()
    await repo.moveEnrichment('all', 'pending', { enrichment: 'empty' })
    expect((await stored(repo, id))?.enrichment).toBe('empty')
  })

  it('leaves a cleared field empty', async () => {
    const { repo, id } = await pendingEntry()
    await repo.moveEnrichment([id], 'pending', { enrichment: 'empty', aiError: 'refused' })
    await repo.moveEnrichment([id], 'empty', { aiError: undefined })
    expect((await stored(repo, id))?.aiError).toBeUndefined()
  })
})

describe('recording reviews', () => {
  const ANSWER = { id: 'log-1', mode: 'cloze', rating: 3, languageDeck: true } as const

  async function setUp() {
    const database = freshDb()
    const repo = createEntryRepository(database)
    const entry = (await repo.listByDeck(ENGLISH_DECK_ID)).find((e) => e.text === 'Figure out')!
    return { database, repo, entry }
  }

  it('saves the schedule and the log together', async () => {
    const { database, repo, entry } = await setUp()
    const saved = await repo.recordReview(entry.id, ANSWER)
    expect(saved?.entry.srs.reps).toBe(1)
    expect(await database.reviewLogs.count()).toBe(1)
    expect((await database.entries.get(entry.id))?.srs.reps).toBe(1)
  })

  it('undoes both, keeping edits made since', async () => {
    const { database, repo, entry } = await setUp()
    const saved = await repo.recordReview(entry.id, ANSWER)
    await repo.patch(entry.id, { notes: 'Edited after the review' })
    const restored = await repo.undoReview(saved!.log)
    expect(restored?.srs).toEqual(entry.srs)
    expect(restored?.status).toBe(entry.status)
    expect(restored?.notes).toBe('Edited after the review')
    expect(await database.reviewLogs.count()).toBe(0)
  })

  it('returns null for an entry deleted during the session', async () => {
    const { repo, entry } = await setUp()
    await repo.remove(entry.id)
    expect(await repo.recordReview(entry.id, ANSWER)).toBeNull()
  })

  it('counts each card once a day, however many times it came back', async () => {
    const { repo, entry } = await setUp()
    const now = new Date('2026-11-04T12:00:00Z')
    await repo.recordReview(entry.id, { ...ANSWER, id: 'a' }, now)
    await repo.recordReview(entry.id, { ...ANSWER, id: 'b' }, new Date(now.getTime() + 60_000))
    expect(await repo.reviewedSince(new Date('2026-11-04T00:00:00Z'))).toEqual([entry.id])
    expect(await repo.reviewedSince(new Date('2026-11-05T00:00:00Z'))).toEqual([])
  })
})
