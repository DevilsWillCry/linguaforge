import 'fake-indexeddb/auto'
import { nanoid } from 'nanoid'
import { afterEach, describe, expect, it } from 'vitest'
import { ENGLISH_DECK_ID } from '@/domain/deckPresets'
import { backupProblem, createBackup, deleteEverything, restoreBackup } from './backup'
import { LinguaForgeDb } from './db'

const open: LinguaForgeDb[] = []
function freshDb() {
  const database = new LinguaForgeDb(`test-${nanoid()}`)
  open.push(database)
  return database
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((database) => database.delete()))
})

const asJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('backup', () => {
  it('restores all data after passing through JSON', async () => {
    const source = freshDb()
    const before = await source.entries.toArray()
    await source.mistakes.add({ id: 'm1', error: 'a', correction: 'b', createdAt: 'x' })
    const backup = asJson(await createBackup(source))

    const target = freshDb()
    await target.entries.clear()
    expect(backupProblem(backup, target)).toBeNull()
    await restoreBackup(backup, target)

    expect(await target.entries.toArray()).toEqual(before)
    expect(await target.mistakes.count()).toBe(1)
    expect(await target.decks.count()).toBe(2)
  })

  it('replaces existing data rather than adding to it', async () => {
    const database = freshDb()
    const backup = asJson(await createBackup(database))
    await database.entries.where('deckId').equals(ENGLISH_DECK_ID).delete()
    await database.savedViews.add({ id: 'later', deckId: 'x', name: 'x', filters: {} as never, sort: [] })

    await restoreBackup(backup, database)
    expect(await database.entries.count()).toBe(39)
    expect(await database.savedViews.count()).toBe(0)
  })

  it('leaves the old data untouched if restoring fails', async () => {
    const database = freshDb()
    const backup = asJson(await createBackup(database))
    // Two rows with one id make bulkAdd fail partway through the transaction.
    const first = backup.tables.entries![0]
    backup.tables.entries = [first, first]

    await expect(restoreBackup(backup, database)).rejects.toThrow()
    expect(await database.entries.count()).toBe(39)
  })
})

describe('backupProblem', () => {
  it.each([
    ['not an object', 'hello', 'notBackup'],
    ['another app', { app: 'other', version: 1, tables: {} }, 'notBackup'],
    ['a newer version', { app: 'linguaforge', version: 9999, tables: {} }, 'tooNew'],
    ['no decks or entries', { app: 'linguaforge', version: 1, tables: {} }, 'malformed'],
    ['an unknown table', { app: 'linguaforge', version: 1, tables: { decks: [], entries: [], hack: [] } }, 'malformed'],
    ['a table that is not a list', { app: 'linguaforge', version: 1, tables: { decks: {}, entries: [] } }, 'malformed'],
    ['an entry missing fields', { app: 'linguaforge', version: 1, tables: { decks: [], entries: [{ id: 'x' }] } }, 'malformed'],
  ])('rejects %s', (_name, data, problem) => {
    expect(backupProblem(data, freshDb())).toBe(problem)
  })
})

describe('deleteEverything', () => {
  it('erases user data and keeps the empty decks', async () => {
    const database = freshDb()
    await database.mistakes.add({ id: 'm1', error: 'a', correction: 'b', createdAt: 'x' })
    await deleteEverything(database)
    expect(await database.entries.count()).toBe(0)
    expect(await database.mistakes.count()).toBe(0)
    expect((await database.decks.toArray()).map((d) => d.name).sort()).toEqual(['English', 'Vue 3 / Tech'])
  })

  it('stays empty after the database reopens', async () => {
    const name = `test-${nanoid()}`
    const first = new LinguaForgeDb(name)
    open.push(first)
    await deleteEverything(first)
    first.close()
    const second = new LinguaForgeDb(name)
    open.push(second)
    expect(await second.entries.count()).toBe(0)
  })
})
