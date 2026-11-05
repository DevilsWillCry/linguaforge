import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import webPush from 'web-push'
import { z } from 'zod'

/** The services browsers really use. A subscription can't make this server call anything else. */
const PUSH_HOSTS = [/\.push\.services\.mozilla\.com$/, /^fcm\.googleapis\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/]

function isPushService(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.some((host) => host.test(url.hostname))
  } catch {
    return false
  }
}

function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

export const reminderInputSchema = z.object({
  subscription: z.object({
    endpoint: z.string().max(1000).refine(isPushService),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }),
  /** Local time of day, as HH:MM. */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timeZone: z.string().max(100).refine(isTimeZone),
  // Sent by the browser in the learner's language. It's generic, with nothing about what they study.
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(200),
  outputDay: z.string().regex(DAY).optional(),
})
export type ReminderInput = z.infer<typeof reminderInputSchema>
export const progressSchema = z.object({ outputDay: z.string().regex(DAY) })

export interface StoredReminder extends ReminderInput {
  lastSentDay?: string
}

export interface ReminderStore {
  all(): Promise<Map<string, StoredReminder>>
  get(userId: string): Promise<StoredReminder | undefined>
  save(userId: string, reminder: StoredReminder): Promise<void>
  remove(userId: string): Promise<void>
}

export function createMemoryReminderStore(): ReminderStore {
  const rows = new Map<string, StoredReminder>()
  return {
    all: async () => rows,
    get: async (userId) => rows.get(userId),
    save: async (userId, reminder) => void rows.set(userId, reminder),
    remove: async (userId) => void rows.delete(userId),
  }
}

export function createFileReminderStore(directory: string): ReminderStore {
  const path = join(directory, 'reminders.json')
  let rows: Promise<Map<string, StoredReminder>> | null = null
  const load = () =>
    (rows ??= readFile(path, 'utf8').then(
      (text) => new Map(Object.entries(JSON.parse(text) as Record<string, StoredReminder>)),
      () => new Map(),
    ))
  async function persist() {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const temporary = `${path}.tmp`
    await writeFile(temporary, JSON.stringify(Object.fromEntries(await load()), null, 2), { mode: 0o600 })
    await rename(temporary, path)
  }
  return {
    all: load,
    get: async (userId) => (await load()).get(userId),
    async save(userId, reminder) {
      ;(await load()).set(userId, reminder)
      await persist()
    },
    async remove(userId) {
      ;(await load()).delete(userId)
      await persist()
    },
  }
}

/** The calendar day and minutes since midnight in the learner's time zone. */
export function localClock(now: Date, timeZone: string): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return { day: `${part('year')}-${part('month')}-${part('day')}`, minutes: Number(part('hour')) * 60 + Number(part('minute')) }
}

/** A computer woken up late in the evening shouldn't announce a morning reminder. */
const LATEST_MINUTES = 180

/** Whether to send now: the time has come, it's not sent yet, and today has no output yet. */
export function isDue(reminder: StoredReminder, now: Date): boolean {
  const { day, minutes } = localClock(now, reminder.timeZone)
  const [hour, minute] = reminder.time.split(':').map(Number) as [number, number]
  const late = minutes - (hour * 60 + minute)
  return late >= 0 && late <= LATEST_MINUTES && reminder.lastSentDay !== day && reminder.outputDay !== day
}

export type SendPush = (reminder: StoredReminder) => Promise<void>

/** The push service's way of saying the subscription no longer exists. */
const isGone = (error: unknown) => {
  const status = (error as { statusCode?: number }).statusCode
  return status === 404 || status === 410
}

export function createReminderService(store: ReminderStore, send: SendPush, publicKey: string) {
  async function deliver(userId: string, reminder: StoredReminder): Promise<'sent' | 'gone' | 'failed'> {
    try {
      await send(reminder)
      return 'sent'
    } catch (error) {
      if (isGone(error)) {
        await store.remove(userId)
        return 'gone'
      }
      // The endpoint identifies the browser, so only the status goes in the log.
      console.error(`Reminder failed (HTTP ${(error as { statusCode?: number }).statusCode ?? 'none'})`)
      return 'failed'
    }
  }

  return {
    publicKey,
    store,
    deliver,
    /** Sends whatever is due. A failed send is left to try again at the next check. */
    async sendDue(now = new Date()) {
      for (const [userId, reminder] of await store.all()) {
        if (!isDue(reminder, now)) continue
        if ((await deliver(userId, reminder)) === 'sent') {
          await store.save(userId, { ...reminder, lastSentDay: localClock(now, reminder.timeZone).day })
        }
      }
    },
  }
}
export type ReminderService = ReturnType<typeof createReminderService>

/** Server identity for push services. Made once and kept with the other local secrets. */
async function localVapidKeys(directory: string): Promise<{ publicKey: string; privateKey: string }> {
  const path = join(directory, 'vapid.json')
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    const keys = webPush.generateVAPIDKeys()
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(path, JSON.stringify(keys), { mode: 0o600 })
    return keys
  }
}

const CHECK_EVERY_MS = 60_000

/** The real thing, for the running server. Tests build a service with their own sender. */
export async function startReminders(env: NodeJS.ProcessEnv, directory: string): Promise<ReminderService> {
  const { publicKey, privateKey } = await localVapidKeys(directory)
  // Push services want a contact URL. This one says nothing about who runs the server.
  const subject = env.VAPID_SUBJECT || 'https://linguaforge.invalid'
  const service = createReminderService(
    createFileReminderStore(directory),
    async ({ subscription, title, body }) => {
      await webPush.sendNotification(subscription, JSON.stringify({ title, body }), {
        vapidDetails: { subject, publicKey, privateKey },
        TTL: 3600,
      })
    },
    publicKey,
  )
  setInterval(() => void service.sendDue().catch((error) => console.error(error)), CHECK_EVERY_MS).unref()
  void service.sendDue().catch((error) => console.error(error))
  return service
}

/** For tests and for a server started without reminders. */
export const unusedReminderService = (): ReminderService =>
  createReminderService(createMemoryReminderStore(), async () => {}, randomBytes(32).toString('base64url'))
