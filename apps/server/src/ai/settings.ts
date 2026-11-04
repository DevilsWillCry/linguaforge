import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { ProviderId } from './providers.js'

/** One user's AI choice, as stored. The key is only ever kept encrypted. */
export interface StoredAiSettings {
  provider: ProviderId
  model: string
  baseUrl?: string
  encryptedKey?: string
  keyHint?: string
}

/**
 * Where settings live. This file-based version serves one local user. Phase 6 adds a
 * database version of the same interface, and it never sees a key in the clear.
 */
export interface AiSettingsStore {
  get(userId: string): Promise<StoredAiSettings | null>
  save(userId: string, settings: StoredAiSettings): Promise<void>
  remove(userId: string): Promise<void>
}

export const aiSettingsInputSchema = z.object({
  provider: z.enum(['anthropic', 'openrouter', 'custom']),
  model: z.string().trim().min(1).max(200),
  baseUrl: z.string().trim().max(500).optional(),
  apiKey: z.string().trim().min(1).max(1000).optional(),
})
export type AiSettingsInput = z.infer<typeof aiSettingsInputSchema>

/** What the browser may see. The key itself is never part of it. */
export function publicSettings(settings: StoredAiSettings | null, envKeyInUse: boolean) {
  if (!settings) return { source: envKeyInUse ? 'server' : 'none', hasKey: false } as const
  return {
    source: 'user',
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    hasKey: Boolean(settings.encryptedKey),
    keyHint: settings.keyHint,
  } as const
}

/** Enough to recognize a key in Settings, and too little to use it. */
export const keyHintOf = (key: string) => (key.length >= 12 ? `…${key.slice(-4)}` : '…')

const PRIVATE_HOST =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[.*\])$/i

/**
 * Checks an address a user typed for the server to call, and returns it tidied up, or null.
 * On a hosted server it must not reach internal machines, while a local one can use Ollama.
 * Hostnames are checked as written, so hosting also needs a check of the resolved address.
 */
export function cleanBaseUrl(raw: string | undefined, { hosted }: { hosted: boolean }): string | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password || url.search || url.hash) return null
  if (hosted && (url.protocol !== 'https:' || PRIVATE_HOST.test(url.hostname))) return null
  return url.href.replace(/\/+$/, '')
}

/**
 * Encrypts keys with AES-256-GCM. The user id is bound into each value, so a value
 * copied onto another user's record can't be decrypted there.
 */
export interface SecretBox {
  seal(secret: string, userId: string): string
  open(sealed: string, userId: string): string | null
}

export function createSecretBox(masterKey: Buffer): SecretBox {
  if (masterKey.length !== 32) throw new Error('The secrets key must be 32 bytes')
  return {
    seal(secret, userId) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', masterKey, iv)
      cipher.setAAD(Buffer.from(userId))
      const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
      return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.')
    },
    open(sealed, userId) {
      const [version, iv, tag, body] = sealed.split('.')
      if (version !== 'v1' || !iv || !tag || body === undefined) return null
      try {
        const decipher = createDecipheriv('aes-256-gcm', masterKey, Buffer.from(iv, 'base64'))
        decipher.setAAD(Buffer.from(userId))
        decipher.setAuthTag(Buffer.from(tag, 'base64'))
        return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8')
      } catch {
        return null
      }
    },
  }
}

export function createMemoryStore(): AiSettingsStore {
  const users = new Map<string, StoredAiSettings>()
  return {
    get: async (userId) => users.get(userId) ?? null,
    save: async (userId, settings) => void users.set(userId, settings),
    remove: async (userId) => void users.delete(userId),
  }
}

/** One JSON file, readable only by the owner of the process. */
export function createFileStore(directory: string): AiSettingsStore {
  const path = join(directory, 'ai-settings.json')
  // Writes run one at a time, so two quick saves can't overwrite each other.
  let queue: Promise<unknown> = Promise.resolve()

  async function readAll(): Promise<Map<string, StoredAiSettings>> {
    try {
      return new Map(Object.entries(JSON.parse(await readFile(path, 'utf8')) as Record<string, StoredAiSettings>))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
      throw error
    }
  }

  function update(change: (users: Map<string, StoredAiSettings>) => void): Promise<void> {
    const write = queue.then(async () => {
      const users = await readAll()
      change(users)
      await mkdir(directory, { recursive: true, mode: 0o700 })
      const temporary = `${path}.${randomBytes(4).toString('hex')}.tmp`
      await writeFile(temporary, JSON.stringify(Object.fromEntries(users), null, 2), { mode: 0o600 })
      await rename(temporary, path)
    })
    queue = write.catch(() => {})
    return write
  }

  return {
    get: async (userId) => (await readAll()).get(userId) ?? null,
    save: (userId, settings) => update((users) => void users.set(userId, settings)),
    remove: (userId) => update((users) => void users.delete(userId)),
  }
}

async function localMasterKey(directory: string): Promise<Buffer> {
  const path = join(directory, 'secret.key')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  try {
    await writeFile(path, randomBytes(32).toString('base64'), { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  await chmod(path, 0o600)
  return Buffer.from(await readFile(path, 'utf8'), 'base64')
}

/** Git-ignored folder at the root of the repo. */
const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../../../.data/', import.meta.url))

/** Sets up local storage. A hosted server must be given its key, not keep it beside the data. */
export async function createLocalSettings(env: NodeJS.ProcessEnv) {
  const directory = env.LF_DATA_DIR || DEFAULT_DATA_DIR
  let masterKey: Buffer
  if (env.AI_SECRETS_KEY) masterKey = Buffer.from(env.AI_SECRETS_KEY, 'base64')
  else if (env.LF_HOSTED) throw new Error('A hosted server needs AI_SECRETS_KEY')
  else masterKey = await localMasterKey(directory)
  return { store: createFileStore(directory), box: createSecretBox(masterKey) }
}

