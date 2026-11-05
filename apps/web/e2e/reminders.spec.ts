import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** Stands in for the browser's push machinery. The real path is checked by hand against Mozilla's service. */
async function fakePush(page: Page, { permission = 'granted', subscribed = false } = {}) {
  await page.addInitScript(
    ({ permission, subscribed }) => {
      let subscription: object | null = subscribed
        ? { endpoint: 'https://updates.push.services.mozilla.com/x', toJSON: () => ({ endpoint: 'https://updates.push.services.mozilla.com/x', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => { subscription = null } }
        : null
      const pushManager = {
        getSubscription: async () => subscription,
        subscribe: async () => {
          subscription = { endpoint: 'https://updates.push.services.mozilla.com/x', toJSON: () => ({ endpoint: 'https://updates.push.services.mozilla.com/x', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => { subscription = null } }
          return subscription
        },
      }
      Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve({ pushManager }) } })
      Object.assign(window, { PushManager: class {} })
      Object.assign(window, { Notification: { requestPermission: async () => permission, permission } })
    },
    { permission, subscribed },
  )
}

/** A small server: remembers what it was sent, and answers like the real one. */
async function mockServer(page: Page, { enabled = false, time = null as string | null, fails = false } = {}) {
  const calls: { method: string; path: string; body: Record<string, any> | null }[] = []
  await page.route('**/api/reminders**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    calls.push({ method: request.method(), path, body: request.postDataJSON() })
    if (fails && request.method() !== 'GET') return route.fulfill({ status: 502, json: { error: 'failed' } })
    if (request.method() === 'GET') return route.fulfill({ json: { publicKey: 'AQAB', enabled, time } })
    return route.fulfill({ json: { ok: true } })
  })
  return calls
}

const section = (page: Page) => page.getByTestId('reminder-settings')

test('turning reminders on sends the plan, with a generic message and the time zone', async ({ page }) => {
  await fakePush(page)
  const calls = await mockServer(page)
  await page.goto('/settings')
  await section(page).getByLabel('Hora').fill('20:15')
  await section(page).getByLabel('Hora').blur()
  await section(page).getByRole('button', { name: 'Activar recordatorios' }).click()
  await expect(section(page).getByRole('button', { name: 'Desactivar' })).toBeVisible()
  const saved = calls.find((call) => call.method === 'PUT')!.body!
  expect(saved.time).toBe('20:15')
  expect(saved.timeZone).toBeTruthy()
  expect(saved.subscription.endpoint).toContain('mozilla')
  expect(saved.body).toContain('5 minutos')
  expect(JSON.stringify(saved)).not.toContain('Figure out')
})

test('explains a blocked permission, and stays off', async ({ page }) => {
  await fakePush(page, { permission: 'denied' })
  const calls = await mockServer(page)
  await page.goto('/settings')
  await section(page).getByRole('button', { name: 'Activar recordatorios' }).click()
  await expect(page.getByTestId('reminders-blocked')).toBeVisible()
  expect(calls.filter((call) => call.method === 'PUT')).toEqual([])
})

test('shows a clear error when the server is off', async ({ page }) => {
  await fakePush(page)
  await mockServer(page, { fails: true })
  await page.goto('/settings')
  await section(page).getByRole('button', { name: 'Activar recordatorios' }).click()
  await expect(page.getByText('No se pudo completar')).toBeVisible()
  await expect(section(page).getByRole('button', { name: 'Activar recordatorios' })).toBeVisible()
})

test('shows as off if the server remembers a browser that no longer has a subscription', async ({ page }) => {
  await fakePush(page, { subscribed: false })
  await mockServer(page, { enabled: true, time: '19:00' })
  await page.goto('/settings')
  await expect(section(page).getByRole('button', { name: 'Activar recordatorios' })).toBeVisible()
})

test('can send a test, change the time and turn off', async ({ page }) => {
  await fakePush(page, { subscribed: true })
  const calls = await mockServer(page, { enabled: true, time: '19:00' })
  await page.goto('/settings')
  await section(page).getByRole('button', { name: 'Enviar una prueba' }).click()
  await expect(page.getByText('Prueba enviada')).toBeVisible()

  await section(page).getByLabel('Hora').fill('07:30')
  await section(page).getByLabel('Hora').blur()
  await expect.poll(() => calls.find((call) => call.method === 'PUT')?.body?.time).toBe('07:30')

  await section(page).getByRole('button', { name: 'Desactivar' }).click()
  await expect(section(page).getByRole('button', { name: 'Activar recordatorios' })).toBeVisible()
  expect(calls.some((call) => call.method === 'DELETE')).toBe(true)
})

test('tells the server once today has real output, so that day stays quiet', async ({ page }) => {
  await fakePush(page, { subscribed: true })
  const calls = await mockServer(page, { enabled: true, time: '19:00' })
  await page.goto('/settings')
  await expect(section(page).getByRole('button', { name: 'Desactivar' })).toBeVisible()
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('linguaforge')
      request.onsuccess = () => resolve(request.result)
    })
    const tx = db.transaction('studySessions', 'readwrite')
    tx.objectStore('studySessions').put({ id: 'w', activity: 'writing', startedAt: new Date().toISOString(), minutes: 0 })
    await new Promise((resolve) => {
      tx.oncomplete = resolve
    })
    db.close()
  })
  // Outside Dexie, so a reload makes the page read it.
  await page.reload()
  await expect.poll(() => calls.filter((call) => call.path.endsWith('/progress')).length).toBe(1)
  await page.reload()
  await expect(section(page).getByRole('button', { name: 'Desactivar' })).toBeVisible()
  expect(calls.filter((call) => call.path.endsWith('/progress'))).toHaveLength(1)
})

test('a normal visit asks the server nothing when reminders are off', async ({ page }) => {
  const calls = await mockServer(page)
  await page.goto('/')
  await expect(page.getByTestId('today-session')).toBeVisible()
  expect(calls).toEqual([])
})

test('says so in a browser without push', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { PushManager?: unknown }).PushManager
  })
  await page.goto('/settings')
  await expect(page.getByTestId('reminders-unsupported')).toBeVisible()
})

test('has no accessibility problems', async ({ page }) => {
  await fakePush(page, { subscribed: true })
  await mockServer(page, { enabled: true, time: '19:00' })
  await page.goto('/settings')
  await expect(section(page).getByRole('button', { name: 'Desactivar' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include('[data-testid="reminder-settings"]').withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(violations.map((violation) => violation.id)).toEqual([])
})
