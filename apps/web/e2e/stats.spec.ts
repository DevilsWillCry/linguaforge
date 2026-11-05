import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const daysAgo = (n: number, hour = 12) => {
  const date = new Date()
  date.setDate(date.getDate() - n)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

interface Seed {
  logs?: unknown[]
  sessions?: unknown[]
  conversations?: unknown[]
  mistakes?: unknown[]
  /** Runs against each entry, by text. */
  patches?: Record<string, Record<string, unknown>>
}

/** Writes directly to the app's database, then opens the page so it reads the result. */
async function seed(page: Page, data: Seed) {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
  await page.getByTestId('entry').first().waitFor()
  await page.evaluate(async (data: Seed) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('linguaforge')
      request.onsuccess = () => resolve(request.result)
    })
    const tx = db.transaction(['entries', 'reviewLogs', 'studySessions', 'tutorConversations', 'mistakes'], 'readwrite')
    const entries = await new Promise<Record<string, any>[]>((resolve) => {
      const request = tx.objectStore('entries').getAll()
      request.onsuccess = () => resolve(request.result)
    })
    const idOf = new Map(entries.map((entry) => [entry.text, entry.id]))
    for (const log of data.logs ?? []) {
      const row = log as { entryText: string; entryId?: string }
      row.entryId = idOf.get(row.entryText)
      tx.objectStore('reviewLogs').put(row)
    }
    for (const row of data.sessions ?? []) tx.objectStore('studySessions').put(row as object)
    for (const row of data.conversations ?? []) tx.objectStore('tutorConversations').put(row as object)
    for (const row of data.mistakes ?? []) tx.objectStore('mistakes').put(row as object)
    for (const entry of entries) {
      const patch = data.patches?.[entry.text]
      if (patch) tx.objectStore('entries').put({ ...entry, ...patch, stats: { ...entry.stats, ...(patch.stats as object) } })
    }
    await new Promise((resolve) => {
      tx.oncomplete = resolve
    })
    db.close()
  }, data)
}

let logId = 0
const answer = (entryText: string, rating: number, mode = 'cloze', ago = 0, reps = 2) => ({
  id: `log-${logId++}`,
  entryText,
  mode,
  rating,
  reviewedAt: daysAgo(ago),
  previous: { reps, due: daysAgo(ago), stability: 1, difficulty: 5, scheduledDays: 1, learningSteps: 0, lapses: 0, state: 2 },
})
const tile = (page: Page, name: string) => page.getByTestId(`tile-${name}`)

test('a new learner sees honest empty states, with no invented numbers', async ({ page }) => {
  await page.goto('/stats')
  await expect(tile(page, 'streak')).toContainText('0')
  await expect(tile(page, 'retention')).toContainText('—')
  await expect(tile(page, 'minutes')).toContainText('Aparecen al avanzar')
  await expect(tile(page, 'weakness')).toContainText('al menos 5 respuestas')
  await expect(tile(page, 'mistakes')).toContainText('Los errores que guardes')
  await expect(tile(page, 'used')).toContainText('Las palabras que uses')
  await expect(page.getByTestId('heatmap').locator('[data-level]:not([data-level="0"])')).toHaveCount(0)
})

test('the funnel counts the seeded deck by status', async ({ page }) => {
  await seed(page, { patches: { 'Figure out': { status: 'Natural' } } })
  await page.goto('/stats')
  const rows = tile(page, 'funnel').getByTestId('bar-row')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(3)).toContainText('Natural')
  await expect(rows.nth(3)).toContainText('1')
})

test('retention, weak spots and the next focus come from real answers', async ({ page }) => {
  const logs = [
    ...Array.from({ length: 4 }, () => answer('Figure out', 1)),
    answer('Figure out', 3),
    ...Array.from({ length: 5 }, () => answer('Figure out', 3, 'listening')),
  ]
  await seed(page, { logs })
  await page.goto('/stats')
  await expect(tile(page, 'retention')).toContainText('60%')
  await expect(page.getByTestId('next-focus')).toContainText('60%')

  await tile(page, 'weakness').getByRole('button', { name: 'Modo' }).click()
  const rows = tile(page, 'weakness').getByTestId('bar-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('20%')
  await expect(rows.last()).toContainText('100%')
})

test('the streak counts only days with output', async ({ page }) => {
  await seed(page, {
    logs: [answer('Figure out', 3, 'cloze', 0), answer('Figure out', 3, 'useIt', 1)],
    conversations: [
      { id: 'c', scenario: 'standup', targets: [], updatedAt: daysAgo(2), messages: [{ role: 'user', content: 'hi', at: daysAgo(2) }] },
    ],
  })
  await page.goto('/stats')
  await expect(tile(page, 'streak').getByText('2', { exact: true })).toBeVisible()
  await expect(tile(page, 'streak')).toContainText('Hoy aún falta')
  await page.goto('/')
  await expect(page.getByTestId('today-streak')).toContainText('2 días')
  await expect(page.getByTestId('today-rescue')).toContainText('2 días')
})

test('shows forecast, minutes, mistakes and words used in output', async ({ page }) => {
  await seed(page, {
    sessions: [{ id: 's', activity: 'warmup', startedAt: daysAgo(0), minutes: 12 }],
    mistakes: [{ id: 'm', error: 'I figure out it', correction: 'I figured it out', createdAt: daysAgo(0) }],
    patches: { 'Figure out': { stats: { lastUsedInOutputAt: daysAgo(0) } } },
  })
  await page.goto('/stats')
  await expect(tile(page, 'minutes')).toContainText('12 min')
  await expect(tile(page, 'mistakes')).toContainText('I figured it out')
  await expect(tile(page, 'used')).toContainText('Figure out')
  await expect(tile(page, 'week')).toContainText('12 / 225')
  await expect(page.getByTestId('forecast').getByRole('table', { includeHidden: true }).locator('tbody tr')).toHaveCount(14)
})

test('every chart offers its numbers as a table', async ({ page }) => {
  await seed(page, { logs: [answer('Figure out', 3)] })
  await page.goto('/stats')
  const heatmap = page.getByTestId('heatmap')
  await heatmap.getByText('Ver como tabla').click()
  await expect(heatmap.getByRole('table').locator('tbody tr')).toHaveCount(1)
  await page.getByTestId('forecast').getByText('Ver como tabla').click()
  await expect(page.getByTestId('forecast').getByRole('table')).toBeVisible()
})

test('has no accessibility problems, in the app\'s default theme and in light', async ({ page }) => {
  await seed(page, { logs: [answer('Figure out', 3)] })
  for (const theme of ['Oscuro', 'Claro']) {
    await page.goto('/settings')
    await page.getByRole('button', { name: theme }).click()
    await page.goto('/stats')
    await expect(page.getByTestId('dashboard')).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.map((violation) => [violation.id, violation.nodes[0]?.target])).toEqual([])
  }
})

test.describe('intensity', () => {
  test('changes the session plan and the weekly targets', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('today-rail').getByRole('listitem')).toHaveCount(5)
    await page.getByTestId('today-intensity').getByRole('button', { name: /Inmersión/ }).click()
    await expect(page.getByTestId('today-rail')).toContainText('Descanso')
    await expect(page.getByTestId('today-rail').getByRole('listitem')).toHaveCount(8)

    await page.goto('/settings')
    await expect(page.getByTestId('plan-settings').getByRole('button', { name: /Inmersión/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Minutos por semana')).toHaveValue('725')
  })

  test('keeps a session under way when the choice would change it', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Empezar la sesión' }).click()
    await expect(page.getByTestId('today-rail').getByRole('listitem')).toHaveCount(5)
    await page.goto('/settings')
    await page.getByTestId('plan-settings').getByRole('button', { name: /Ligera/ }).click()
    await page.goto('/')
    await expect(page.getByTestId('today-rail')).toContainText('10 min')
  })

  test('the 5-minute rescue session goes to output and then ends', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('today-rescue').getByRole('button').click()
    const rail = page.getByTestId('today-rail').getByRole('listitem')
    await expect(rail).toHaveCount(2)
    await page.getByRole('button', { name: 'Marcar como hecho' }).click()
    await expect(page.getByTestId('today-step').getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/tutor')
    await page.getByRole('button', { name: 'Marcar como hecho' }).click()
    await expect(page.getByTestId('today-finished')).toBeVisible()
  })

  test('hides the rescue offer once today has output', async ({ page }) => {
    await seed(page, { logs: [answer('Figure out', 3, 'useIt', 0)] })
    await page.goto('/')
    await expect(page.getByTestId('today-session')).toBeVisible()
    await expect(page.getByTestId('today-rescue')).toHaveCount(0)
  })
})

test.describe('the closing recap', () => {
  async function toWrapUp(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Empezar la sesión' }).click()
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Marcar como hecho' }).click()
    await expect(page.getByTestId('today-recap')).toBeVisible()
  }

  test('asks about what was reviewed today, hiding the answer until you try', async ({ page }) => {
    await seed(page, { logs: [answer('Figure out', 3)] })
    await toWrapUp(page)
    const recap = page.getByTestId('today-recap')
    await expect(recap).not.toContainText('Figure out')
    await recap.getByLabel('Tu respuesta').fill('figure out')
    await recap.getByRole('button', { name: 'Comprobar' }).click()
    await expect(page.getByTestId('recap-result')).toContainText('Correcto')
    await recap.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByTestId('recap-done')).toContainText('1 de 1')
  })

  test('shows the answer after a wrong try', async ({ page }) => {
    await seed(page, { logs: [answer('Figure out', 3)] })
    await toWrapUp(page)
    const recap = page.getByTestId('today-recap')
    await recap.getByLabel('Tu respuesta').fill('nothing like it')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('recap-result')).toContainText('Figure out')
  })

  test('says so when nothing was reviewed today', async ({ page }) => {
    await toWrapUp(page)
    await expect(page.getByTestId('today-recap')).toContainText('Repasa alguna tarjeta')
  })
})
