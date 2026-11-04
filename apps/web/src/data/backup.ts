import { DECK_PRESETS } from '@/domain/deckPresets'
import type { Deck } from '@/domain/types'
import { db, type LinguaForgeDb } from './db'

const APP_ID = 'linguaforge'

export interface Backup {
  app: typeof APP_ID
  version: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

export async function createBackup(database: LinguaForgeDb = db, now = new Date()): Promise<Backup> {
  const tables: Backup['tables'] = {}
  await Promise.all(
    database.tables.map(async (table) => {
      tables[table.name] = await table.toArray()
    }),
  )
  return { app: APP_ID, version: database.verno, exportedAt: now.toISOString(), tables }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const LIST_FIELDS = ['meanings', 'realExamples', 'ownExamples', 'variations', 'collocations', 'tags']

/** Why the data can't be restored, or null if it's valid. Checked before anything is erased. */
export function backupProblem(data: unknown, database: LinguaForgeDb = db): string | null {
  if (!isObject(data) || data.app !== APP_ID || !isObject(data.tables)) return 'notBackup'
  if (typeof data.version !== 'number' || data.version > database.verno) return 'tooNew'

  const known = new Set(database.tables.map((t) => t.name))
  for (const [name, rows] of Object.entries(data.tables)) {
    if (!known.has(name) || !Array.isArray(rows)) return 'malformed'
  }

  const { decks, entries } = data.tables
  if (!Array.isArray(decks) || !Array.isArray(entries)) return 'malformed'
  const validDeck = (d: unknown) =>
    isObject(d) && typeof d.id === 'string' && isObject(d.schema) && Array.isArray(d.schema.fields)
  const validEntry = (e: unknown) =>
    isObject(e) &&
    typeof e.id === 'string' &&
    typeof e.deckId === 'string' &&
    typeof e.text === 'string' &&
    isObject(e.srs) &&
    LIST_FIELDS.every((field) => Array.isArray(e[field]))
  return decks.every(validDeck) && entries.every(validEntry) ? null : 'malformed'
}

/** Replaces all data with the backup. Atomic, so a failure leaves the old data untouched. */
export async function restoreBackup(backup: Backup, database: LinguaForgeDb = db): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) {
      await table.clear()
      const rows = backup.tables[table.name]
      if (rows?.length) await table.bulkAdd(rows)
    }
  })
}

/** Erases all user data and leaves the two empty preset decks, so the app still works. */
export async function deleteEverything(database: LinguaForgeDb = db, now = new Date()): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) await table.clear()
    const decks: Deck[] = DECK_PRESETS.map(({ id, name, schema }) => ({
      id,
      name,
      schema,
      createdAt: now.toISOString(),
    }))
    await database.decks.bulkAdd(decks)
  })
}
