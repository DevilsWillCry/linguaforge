import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'
import { createMemoryReminderStore, createReminderService, isDue, localClock, type StoredReminder } from './reminders.js'

const INPUT = {
  subscription: { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abc', keys: { p256dh: 'p', auth: 'a' } },
  time: '19:00',
  timeZone: 'America/Bogota',
  title: 'LinguaForge',
  body: 'Cinco minutos bastan.',
}
const reminder = (over: Partial<StoredReminder> = {}): StoredReminder => ({ ...INPUT, ...over })
/** 7:30 pm in Bogotá, which is UTC-5. */
const EVENING = new Date('2026-11-05T00:30:00Z')

describe('localClock', () => {
  it('uses the learner\'s day, not the server\'s', () => {
    expect(localClock(EVENING, 'America/Bogota')).toEqual({ day: '2026-11-04', minutes: 19 * 60 + 30 })
    expect(localClock(EVENING, 'UTC')).toEqual({ day: '2026-11-05', minutes: 30 })
  })
})

describe('isDue', () => {
  it('is due once the time has come', () => {
    expect(isDue(reminder(), EVENING)).toBe(true)
    expect(isDue(reminder({ time: '20:00' }), EVENING)).toBe(false)
  })

  it('reminds only once a day', () => {
    expect(isDue(reminder({ lastSentDay: '2026-11-04' }), EVENING)).toBe(false)
    expect(isDue(reminder({ lastSentDay: '2026-11-03' }), EVENING)).toBe(true)
  })

  it('stays quiet once today has output', () => {
    expect(isDue(reminder({ outputDay: '2026-11-04' }), EVENING)).toBe(false)
    expect(isDue(reminder({ outputDay: '2026-11-03' }), EVENING)).toBe(true)
  })

  it('does not announce a reminder hours late', () => {
    expect(isDue(reminder({ time: '16:30' }), EVENING)).toBe(true)
    expect(isDue(reminder({ time: '16:29' }), EVENING)).toBe(false)
  })
})

describe('sendDue', () => {
  const setup = (send = vi.fn(async () => {})) => {
    const store = createMemoryReminderStore()
    return { store, send, service: createReminderService(store, send, 'public-key') }
  }

  it('sends once, however many checks follow', async () => {
    const { store, send, service } = setup()
    await store.save('local', reminder())
    await service.sendDue(EVENING)
    await service.sendDue(EVENING)
    expect(send).toHaveBeenCalledOnce()
    expect((await store.get('local'))?.lastSentDay).toBe('2026-11-04')
  })

  it('removes a subscription the push service says is gone', async () => {
    const { store, service } = setup(vi.fn(async () => Promise.reject(Object.assign(new Error('gone'), { statusCode: 410 }))))
    await store.save('local', reminder())
    await service.sendDue(EVENING)
    expect(await store.get('local')).toBeUndefined()
  })

  it('tries again after a temporary failure, logging only the status', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store, send, service } = setup(vi.fn(async () => Promise.reject(Object.assign(new Error(INPUT.subscription.endpoint), { statusCode: 503 }))))
    await store.save('local', reminder())
    await service.sendDue(EVENING)
    expect((await store.get('local'))?.lastSentDay).toBeUndefined()
    await service.sendDue(EVENING)
    expect(send).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(log.mock.calls)).not.toContain('mozilla')
    log.mockRestore()
  })
})

describe('the routes', () => {
  const setup = () => {
    const send = vi.fn(async () => {})
    const store = createMemoryReminderStore()
    const app = createApp({}, { reminders: createReminderService(store, send, 'public-key') })
    const call = (path: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
      app.request(`/api/reminders${path}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
        headers: { 'content-type': 'application/json', ...headers },
      })
    return { call, store, send }
  }

  it('gives the public key and the state, and never the subscription', async () => {
    const { call, store } = setup()
    await store.save('local', reminder())
    const text = await (await call('', 'GET')).text()
    expect(JSON.parse(text)).toEqual({ publicKey: 'public-key', enabled: true, time: '19:00' })
    expect(text).not.toContain('mozilla')
  })

  it('saves, sends a test and removes', async () => {
    const { call, store, send } = setup()
    expect((await call('', 'PUT', INPUT)).status).toBe(200)
    expect((await store.get('local'))?.time).toBe('19:00')
    expect((await call('/test', 'POST', {})).status).toBe(200)
    expect(send).toHaveBeenCalledOnce()
    expect((await call('', 'DELETE')).status).toBe(200)
    expect(await store.get('local')).toBeUndefined()
    expect((await call('/test', 'POST', {})).status).toBe(409)
  })

  it.each([
    ['an address that is not a push service', { subscription: { ...INPUT.subscription, endpoint: 'https://169.254.169.254/latest' } }],
    ['a lookalike of a push service', { subscription: { ...INPUT.subscription, endpoint: 'https://push.services.mozilla.com.evil.example/x' } }],
    ['plain http', { subscription: { ...INPUT.subscription, endpoint: 'http://updates.push.services.mozilla.com/x' } }],
    ['an impossible time', { time: '25:00' }],
    ['an unknown time zone', { timeZone: 'Mars/Olympus' }],
  ])('rejects %s', async (_name, change) => {
    const { call, store } = setup()
    expect((await call('', 'PUT', { ...INPUT, ...change })).status).toBe(400)
    expect(await store.get('local')).toBeUndefined()
  })

  it('records output for today, so that day stays quiet', async () => {
    const { call, store } = setup()
    await store.save('local', reminder())
    await call('/progress', 'POST', { outputDay: '2026-11-04' })
    expect(isDue((await store.get('local'))!, EVENING)).toBe(false)
  })

  it('changing the time cannot cause a second reminder that day', async () => {
    const { call, store } = setup()
    await store.save('local', reminder({ lastSentDay: '2026-11-04' }))
    await call('', 'PUT', { ...INPUT, time: '19:15' })
    expect(isDue((await store.get('local'))!, EVENING)).toBe(false)
  })

  it('refuses other websites, like the rest of the API', async () => {
    const { call } = setup()
    expect((await call('', 'PUT', INPUT, { origin: 'https://evil.example' })).status).toBe(403)
  })
})
