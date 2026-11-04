import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'

const USAGE = { inputTokens: 100, outputTokens: 50 }

interface Item {
  id: string
  text: string
}

const noteFor = ({ id, text }: Item) => ({
  id,
  kind: 'Word',
  meanings: [`Meaning of ${text} — significado`],
  tone: 'Casual',
  context: 'Workplace',
  realExamples: [`A model sentence with ${text}.`],
  variations: ['a synonym'],
  collocations: [`${text} something`],
  ipa: '/test/',
  notes: 'Una nota en español.',
  priority: 4,
})

const FEEDBACK = {
  verdict: 'understandable',
  usesTarget: true,
  grammar: 'Falta un artículo.',
  naturalness: 'Suena un poco raro.',
  toneFit: 'El tono encaja.',
  betterVersion: 'A better sentence from AI.',
}

const itemsOf = (route: Route) => (route.request().postDataJSON() as { items: Item[] }).items

async function aiOn(page: Page) {
  await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, aiConfigured: true } }))
}

/** Turns AI on and answers every enrichment request. Returns the items it was asked about. */
async function mockEnrichment(page: Page) {
  const asked: string[] = []
  await aiOn(page)
  await page.route('**/api/ai/enrich', (route) => {
    const items = itemsOf(route)
    asked.push(...items.map((item) => item.text))
    return route.fulfill({ json: { results: items.map(noteFor), usage: USAGE } })
  })
  return asked
}

const review = (page: Page) => page.getByTestId('draft-review')
const draftItems = (page: Page) => page.getByTestId('draft-item')

async function openReview(page: Page) {
  await page.goto('/enrich')
  await expect(review(page)).toBeVisible()
}

async function openDraftFor(page: Page, text: string) {
  await draftItems(page).filter({ hasText: text }).click()
  await expect(review(page).getByRole('heading', { name: text })).toBeVisible()
}

test.describe('drafting', () => {
  test('turns the waiting words into drafts on its own, in small batches', async ({ page }) => {
    const asked = await mockEnrichment(page)
    await openReview(page)
    await expect(draftItems(page)).toHaveCount(8)
    expect([...asked].sort()).toEqual(
      ['Beyond', 'Borrow', 'Disbelief', 'Incidentally', 'May', 'Shall', 'Such', 'Willing'],
    )
  })

  test('sends only the text and the option lists', async ({ page }) => {
    await aiOn(page)
    const bodies: string[] = []
    await page.route('**/api/ai/enrich', (route) => {
      bodies.push(route.request().postData() ?? '')
      return route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } })
    })
    await openReview(page)
    const body = JSON.parse(bodies[0]!) as { items: Record<string, unknown>[] }
    expect(Object.keys(body).sort()).toEqual(['items', 'options'])
    for (const item of body.items) {
      expect(Object.keys(item).every((key) => ['id', 'text', 'kindHint'].includes(key))).toBe(true)
    }
  })

  test('drafts a word added with Quick Add while the app is open', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Quick Add is covered on desktop')
    await mockEnrichment(page)
    await openReview(page)
    await expect(draftItems(page)).toHaveCount(8)
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByTestId('palette-input').pressSequentially('+')
    await page.getByTestId('quick-add').getByRole('textbox').fill('Look forward to')
    await page.keyboard.press('Enter')
    await expect(draftItems(page).filter({ hasText: 'Look forward to' })).toBeVisible()
  })

  test('marks entries in the library and links to the review', async ({ page }) => {
    await mockEnrichment(page)
    await page.goto('/library')
    await page.getByRole('link', { name: 'Revisar borradores (8)' }).click()
    await expect(review(page)).toBeVisible()
  })

  test('keeps a draft out of the library fields until it is confirmed', async ({ page }) => {
    await mockEnrichment(page)
    await openReview(page)
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    const card = page.getByTestId('entry').filter({ hasText: 'Borrow' })
    await expect(card.getByText('Borrador por revisar')).toBeVisible()
    await expect(card.getByText('Meaning of Borrow')).toHaveCount(0)
  })

  test('recovers an entry left waiting by a page closed mid-request', async ({ page }) => {
    await aiOn(page)
    let hang = true
    await page.route('**/api/ai/enrich', async (route) => {
      if (hang) return // Never answers, like a page closed during the request.
      return route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } })
    })
    await page.goto('/enrich')
    await expect(page.getByText('La IA está preparando 5 entradas')).toBeVisible()
    hang = false
    await page.reload()
    await expect(draftItems(page)).toHaveCount(8)
  })
})

test.describe('a page closed while the last batch is running', () => {
  /** Answers the first batch of five and leaves the other three words hanging. */
  async function hangAfterFirstBatch(page: Page) {
    await aiOn(page)
    let calls = 0
    await page.route('**/api/ai/enrich', async (route) => {
      calls += 1
      if (calls > 1) return
      await route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } })
    })
    await page.goto('/enrich')
    await expect(draftItems(page)).toHaveCount(5)
    await expect(page.getByText('La IA está preparando 3 entradas')).toBeVisible()
  }

  test('finishes those entries after a reload, with nothing else waiting', async ({ page }) => {
    await hangAfterFirstBatch(page)
    await page.unroute('**/api/ai/enrich')
    await page.route('**/api/ai/enrich', (route) =>
      route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } }),
    )
    await page.reload()
    await expect(draftItems(page)).toHaveCount(8)
  })

  test('does not leave them saying they are being completed when AI is off', async ({ page }) => {
    await hangAfterFirstBatch(page)
    await page.unroute('**/api/health')
    await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, aiConfigured: false } }))
    await page.reload()
    await expect(page.getByText('En cola')).toHaveCount(3)
    await expect(page.getByText('Completando…')).toHaveCount(0)
  })
})

test.describe('confirming', () => {
  test('saves the edited values, and the entry leaves the queue', async ({ page }) => {
    await mockEnrichment(page)
    await openReview(page)
    await openDraftFor(page, 'Borrow')

    await review(page).getByLabel('Significado').fill('→ My own meaning')
    await review(page).getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByText('«Borrow» guardada en tu biblioteca')).toBeVisible()
    await expect(draftItems(page)).toHaveCount(7)
    await expect(draftItems(page).filter({ hasText: 'Borrow' })).toHaveCount(0)
    await expect(review(page)).toBeVisible()

    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    const card = page.getByTestId('entry').filter({ hasText: 'Borrow' })
    await expect(card.getByText('My own meaning')).toBeVisible()
    await expect(card.getByText('Borrador por revisar')).toHaveCount(0)
    await expect(card.getByText('Escribe tu propia frase')).toBeVisible()
  })

  test('confirms with the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones have no Ctrl key')
    await mockEnrichment(page)
    await openReview(page)
    await review(page).getByLabel('Significado').focus()
    await page.keyboard.press('Control+Enter')
    await expect(draftItems(page)).toHaveCount(7)
  })

  test('leaves the own example blank and says the sentences are written by AI', async ({ page }) => {
    await mockEnrichment(page)
    await openReview(page)
    await expect(review(page).getByLabel('Tus ejemplos')).toHaveValue('')
    await expect(review(page).getByText('no vienen de una fuente real')).toBeVisible()
    await expect(review(page).getByText('A model sentence with', { exact: false }).first()).toBeVisible()
  })

  test('asks for a new draft on request', async ({ page }) => {
    const asked = await mockEnrichment(page)
    await openReview(page)
    await expect(draftItems(page)).toHaveCount(8)
    await openDraftFor(page, 'Borrow')
    const before = asked.length
    await review(page).getByRole('button', { name: 'Pedir otro borrador' }).click()
    await expect.poll(() => asked.length).toBe(before + 1)
    expect(asked.at(-1)).toBe('Borrow')
    await expect(draftItems(page)).toHaveCount(8)
  })
})

test.describe('feedback on your own sentence', () => {
  async function setUp(page: Page) {
    await mockEnrichment(page)
    const sentences: string[] = []
    await page.route('**/api/ai/feedback', (route) => {
      sentences.push((route.request().postDataJSON() as { sentence: string }).sentence)
      return route.fulfill({ json: { feedback: FEEDBACK, usage: USAGE } })
    })
    await openReview(page)
    await openDraftFor(page, 'Borrow')
    return sentences
  }
  const coach = (page: Page) => review(page).getByTestId('own-example-coach')

  test('shows the feedback without touching the examples field', async ({ page }) => {
    await setUp(page)
    await coach(page).getByLabel('Escribe tu propia frase').fill('Can I borrow charger?')
    await coach(page).getByRole('button', { name: 'Pedir opinión' }).click()

    const feedback = page.getByTestId('sentence-feedback')
    await expect(feedback.getByText('Se entiende, pero se puede mejorar')).toBeVisible()
    await expect(feedback.getByText('Falta un artículo.')).toBeVisible()
    await expect(feedback.getByText('A better sentence from AI.')).toBeVisible()
    await expect(review(page).getByLabel('Tus ejemplos')).toHaveValue('')
  })

  test('adds only the sentence you wrote', async ({ page }) => {
    await setUp(page)
    await coach(page).getByLabel('Escribe tu propia frase').fill('Can I borrow charger?')
    await coach(page).getByRole('button', { name: 'Pedir opinión' }).click()
    await expect(page.getByTestId('sentence-feedback')).toBeVisible()
    await coach(page).getByRole('button', { name: 'Añadir a mis ejemplos' }).click()
    await expect(review(page).getByLabel('Tus ejemplos')).toHaveValue('→ Can I borrow charger?')
  })

  test('does not pay twice for the same sentence', async ({ page }) => {
    const sentences = await setUp(page)
    const ask = coach(page).getByRole('button', { name: 'Pedir opinión' })
    await coach(page).getByLabel('Escribe tu propia frase').fill('Can I borrow charger?')
    await ask.click()
    await expect(page.getByTestId('sentence-feedback')).toBeVisible()
    await expect.poll(() => sentences.length).toBe(1)
    await ask.click()
    await coach(page).getByLabel('Escribe tu propia frase').fill('Can I borrow charger? ')
    await ask.click()
    await expect(page.getByTestId('sentence-feedback')).toBeVisible()
    expect(sentences).toHaveLength(1)
  })

  test('keeps your sentence when the request fails', async ({ page }) => {
    await mockEnrichment(page)
    await page.route('**/api/ai/feedback', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await openReview(page)
    await coach(page).getByLabel('Escribe tu propia frase').fill('My sentence')
    await coach(page).getByRole('button', { name: 'Pedir opinión' }).click()
    await expect(page.getByText('El servicio de IA no responde')).toBeVisible()
    await expect(coach(page).getByLabel('Escribe tu propia frase')).toHaveValue('My sentence')
  })

  test('is also in the full editor of a confirmed entry', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir Figure out' }).click()
    const editor = page.getByTestId('entry-editor')
    await editor.getByLabel('Escribe tu propia frase').fill('I finally figured it out')
    await editor.getByRole('button', { name: 'Añadir a mis ejemplos' }).click()
    await expect(editor.getByLabel('Tus ejemplos')).toHaveValue(/→ I finally figured it out$/)
  })
})

test.describe('when things go wrong', () => {
  test('explains that AI is off, and entries can still be completed by hand', async ({ page }) => {
    await page.goto('/enrich')
    await expect(page.getByTestId('enrichment-status')).toContainText('La IA está apagada')
    await expect(page.getByText('En cola').first()).toBeVisible()
    await expect(review(page)).toHaveCount(0)
  })

  test('pauses on a service failure, keeps the work, and resumes on retry', async ({ page }) => {
    await aiOn(page)
    let down = true
    let calls = 0
    await page.route('**/api/ai/enrich', (route) => {
      calls += 1
      if (down) return route.fulfill({ status: 503, json: { error: 'unavailable' } })
      return route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } })
    })
    await page.goto('/enrich')
    await expect(page.getByTestId('enrichment-status')).toContainText('El servicio de IA no responde')
    expect(calls).toBe(1)

    down = false
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(draftItems(page)).toHaveCount(8)
    await expect(page.getByTestId('enrichment-status')).toHaveCount(0)
  })

  test('sets aside only the entry the model refuses', async ({ page }) => {
    await aiOn(page)
    await page.route('**/api/ai/enrich', (route) => {
      const items = itemsOf(route)
      if (items.some((item) => item.text === 'Such')) {
        return route.fulfill({ status: 502, json: { error: 'refused' } })
      }
      return route.fulfill({ json: { results: items.map(noteFor), usage: USAGE } })
    })
    await page.goto('/enrich')
    await expect(draftItems(page)).toHaveCount(7)
    const problem = page.getByTestId('problem-item')
    await expect(problem).toContainText('Such')
    await expect(problem).toContainText('La IA no quiso completar esta entrada')
  })

  test('reports the API server being down as a connection problem', async ({ page }) => {
    await aiOn(page)
    await page.route('**/api/ai/enrich', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto('/enrich')
    await expect(page.getByTestId('enrichment-status')).toContainText('No se pudo conectar')
  })

  test('your edit wins over an AI answer that arrives later', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Editing cells is covered on desktop')
    await aiOn(page)
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/ai/enrich', async (route) => {
      await held
      await route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } })
    })
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tabla', exact: true }).click()
    await expect(page.getByText('Completando…').first()).toBeVisible()

    const row = page.getByRole('row').filter({ hasText: 'Borrow' })
    await row.getByRole('button', { name: /^Editar Significado/ }).click()
    await row.getByRole('textbox').fill('→ Typed by me')
    await row.getByRole('textbox').blur()
    await expect(row.getByText('Typed by me')).toBeVisible()

    release()
    await expect(page.getByRole('link', { name: /Revisar borradores/ })).toBeVisible()
    await expect(row.getByText('Typed by me')).toBeVisible()
    await expect(row.getByText('Meaning of Borrow')).toHaveCount(0)
    await expect(row.getByText('Borrador por revisar')).toHaveCount(0)
  })

  test('asks for the word instead of sending a URL to AI', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Quick Add is covered on desktop')
    const asked = await mockEnrichment(page)
    await openReview(page)
    await expect(draftItems(page)).toHaveCount(8)
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByTestId('palette-input').pressSequentially('+')
    await page.getByTestId('quick-add').getByRole('textbox').fill('https://example.com/post')
    await page.keyboard.press('Enter')

    const problem = page.getByTestId('problem-item')
    await expect(problem).toContainText('Es una URL')
    expect(asked).not.toContain('https://example.com/post')
  })
})

test.describe('the daily budget', () => {
  test('stops the queue, and raising it in Settings resumes', async ({ page }) => {
    const asked = await mockEnrichment(page)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('budget-set')) {
        localStorage.setItem('lf-ai-budget', '0')
        sessionStorage.setItem('budget-set', '1')
      }
    })
    await page.goto('/enrich')
    await expect(page.getByTestId('enrichment-status')).toContainText('límite diario')
    expect(asked).toHaveLength(0)

    await page.goto('/settings')
    const settings = page.getByTestId('ai-settings')
    await settings.getByLabel('Límite diario de tokens').fill('50000')
    await settings.getByLabel('Límite diario de tokens').blur()
    await expect.poll(() => asked.length).toBe(8)
    await expect(settings.getByText(/Usados hoy/)).toContainText('300')
  })
})

test('keeps what you are typing in the limit when the panel refreshes', async ({ page }) => {
  await aiOn(page)
  await page.route('**/api/ai/settings', (route) => route.fulfill({ json: { source: 'none', hasKey: false } }))
  let answerModels = () => {}
  const held = new Promise<void>((resolve) => (answerModels = resolve))
  await page.route('**/api/ai/models', async (route) => {
    await held
    await route.fulfill({ json: { models: [{ id: 'a/model:free', name: 'A', free: true }] } })
  })
  await page.route('**/api/ai/enrich', (route) => route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } }))
  await page.goto('/settings')
  const limit = page.getByLabel('Límite diario de tokens')
  await limit.fill('12345')
  answerModels()
  await expect(page.getByText('Modelos disponibles: 1')).toBeVisible()
  await expect(limit).toHaveValue('12345')
})

test('clearing a note in the editor really clears it', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
  const open = page.getByRole('button', { name: 'Abrir Figure out' })
  const editor = page.getByTestId('entry-editor')

  await open.click()
  await editor.getByLabel('Apuntes').fill('A note to delete')
  await editor.getByRole('button', { name: 'Guardar' }).click()
  await expect(editor).toHaveCount(0)

  await open.click()
  await expect(editor.getByLabel('Apuntes')).toHaveValue('A note to delete')
  await editor.getByLabel('Apuntes').fill('')
  await editor.getByRole('button', { name: 'Guardar' }).click()
  await expect(editor).toHaveCount(0)

  await open.click()
  await expect(editor.getByLabel('Apuntes')).toHaveValue('')
})

test('fits a phone screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only about phones')
  await mockEnrichment(page)
  await openReview(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`accessibility in ${colorScheme} theme`, () => {
    test.use({ colorScheme })

    async function expectNoViolations(page: Page) {
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(violations.map((v) => ({ rule: v.id, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))).toEqual([])
    }

    test('the review screen meets WCAG AA', async ({ page }) => {
      await mockEnrichment(page)
      await page.route('**/api/ai/feedback', (route) => route.fulfill({ json: { feedback: FEEDBACK, usage: USAGE } }))
      await openReview(page)
      await page.getByLabel('Escribe tu propia frase').fill('My sentence')
      await page.getByRole('button', { name: 'Pedir opinión' }).click()
      await expect(page.getByTestId('sentence-feedback')).toBeVisible()
      await expectNoViolations(page)
    })

    test('the queue with AI off meets WCAG AA', async ({ page }) => {
      await page.goto('/enrich')
      await expect(page.getByTestId('enrichment-status')).toBeVisible()
      await expectNoViolations(page)
    })

    test('the settings meet WCAG AA', async ({ page }) => {
      await aiOn(page)
      await page.route('**/api/ai/settings', (route) => route.fulfill({ json: { source: 'none', hasKey: false } }))
      await page.route('**/api/ai/models', (route) => route.fulfill({ json: { models: [] } }))
      await page.route('**/api/ai/enrich', (route) => route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } }))
      await page.goto('/settings')
      await page.getByRole('combobox', { name: 'Modelo', exact: true }).fill('free/model:free')
      await expect(page.getByTestId('free-warning')).toBeVisible()
      await expectNoViolations(page)
    })
  })
}

test.describe('choosing your own AI in Settings', () => {
  const MODELS = {
    models: [
      { id: 'free/model:free', name: 'Free model', free: true },
      { id: 'paid/model', name: 'Paid model', free: false },
    ],
  }

  /** A stand-in for the server's settings routes. Returns what the browser sent to it. */
  async function mockSettings(page: Page) {
    const puts: Record<string, string>[] = []
    let view: Record<string, unknown> = { source: 'none', hasKey: false }
    let configured = false
    await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, aiConfigured: configured } }))
    await page.route('**/api/ai/models', (route) => route.fulfill({ json: MODELS }))
    await page.route('**/api/ai/settings', async (route) => {
      const method = route.request().method()
      if (method === 'PUT') {
        const body = route.request().postDataJSON() as Record<string, string>
        puts.push(body)
        const { apiKey: _key, ...rest } = body
        view = { source: 'user', ...rest, hasKey: true, keyHint: '…1234' }
        configured = true
      } else if (method === 'DELETE') {
        view = { source: 'none', hasKey: false }
        configured = false
      }
      await route.fulfill({ json: view })
    })
    await page.route('**/api/ai/enrich', (route) =>
      route.fulfill({ json: { results: itemsOf(route).map(noteFor), usage: USAGE } }),
    )
    return puts
  }

  const panel = (page: Page) => page.getByTestId('ai-settings')

  test('saves OpenRouter with a free model, warns about privacy, and starts the queue', async ({ page }) => {
    const puts = await mockSettings(page)
    await page.goto('/settings')
    await expect(panel(page).getByRole('status')).toContainText('La IA está apagada')

    await panel(page).getByLabel('Clave de la API').fill('sk-or-v1-secret')
    await panel(page).getByRole('combobox', { name: 'Modelo', exact: true }).fill('free/model:free')
    await expect(page.getByTestId('free-warning')).toContainText('entrenar')
    await panel(page).getByRole('button', { name: 'Guardar' }).click()

    await expect(panel(page).getByRole('status')).toContainText('La IA está activa')
    expect(puts).toEqual([{ provider: 'openrouter', model: 'free/model:free', apiKey: 'sk-or-v1-secret' }])
    // The key is gone from the page once it has been sent.
    await expect(panel(page).getByLabel('Clave de la API')).toHaveValue('')
    await expect(panel(page).getByText('Clave guardada (…1234)')).toBeVisible()

    await page.goto('/enrich')
    await expect(draftItems(page)).toHaveCount(8)
  })

  test('never stores the key in the browser', async ({ page }) => {
    await mockSettings(page)
    await page.goto('/settings')
    await panel(page).getByLabel('Clave de la API').fill('sk-or-v1-secret')
    await panel(page).getByRole('combobox', { name: 'Modelo', exact: true }).fill('free/model:free')
    await panel(page).getByRole('button', { name: 'Guardar' }).click()
    await expect(panel(page).getByRole('status')).toContainText('La IA está activa')

    const inBrowser = await page.evaluate(async () => {
      const tables: unknown[] = []
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('linguaforge')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      for (const name of db.objectStoreNames) {
        tables.push(
          await new Promise((resolve) => {
            const request = db.transaction(name).objectStore(name).getAll()
            request.onsuccess = () => resolve(request.result)
          }),
        )
      }
      return JSON.stringify([tables, { ...localStorage }, { ...sessionStorage }])
    })
    expect(inBrowser).not.toContain('sk-or-v1-secret')
  })

  test('asks for the key again when the service changes', async ({ page }) => {
    await mockSettings(page)
    await page.goto('/settings')
    await panel(page).getByLabel('Clave de la API').fill('sk-or-v1-secret')
    await panel(page).getByRole('combobox', { name: 'Modelo', exact: true }).fill('free/model:free')
    const save = panel(page).getByRole('button', { name: 'Guardar' })
    await save.click()
    await expect(panel(page).getByText('Clave guardada')).toBeVisible()

    await panel(page).getByLabel('Servicio').selectOption('anthropic')
    await expect(panel(page).getByText('Clave guardada')).toHaveCount(0)
    await panel(page).getByRole('combobox', { name: 'Modelo', exact: true }).fill('claude-haiku-5-5')
    await expect(save).toBeDisabled()
  })

  test('a custom address needs no key, like Ollama', async ({ page }) => {
    const puts = await mockSettings(page)
    await page.goto('/settings')
    await panel(page).getByLabel('Servicio').selectOption('custom')
    await panel(page).getByLabel('Dirección de la API').fill('http://localhost:11434/v1')
    await panel(page).getByRole('combobox', { name: 'Modelo', exact: true }).fill('llama3')
    await expect(page.getByTestId('free-warning')).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Guardar' }).click()
    await expect(panel(page).getByRole('status')).toContainText('La IA está activa')
    expect(puts[0]).toEqual({ provider: 'custom', model: 'llama3', baseUrl: 'http://localhost:11434/v1' })
  })

  test('tries the saved model on a sample word', async ({ page }) => {
    await mockSettings(page)
    await page.goto('/settings')
    const test = panel(page).getByRole('button', { name: /Probar/ })
    await expect(test).toBeDisabled()
    await panel(page).getByLabel('Clave de la API').fill('sk-or-v1-secret')
    await panel(page).getByRole('combobox', { name: 'Modelo', exact: true }).fill('free/model:free')
    await panel(page).getByRole('button', { name: 'Guardar' }).click()
    await expect(test).toBeEnabled()
    await test.click()
    await expect(page.getByTestId('ai-test-result')).toContainText('Meaning of figure out')
  })

  test('removes the service', async ({ page }) => {
    await mockSettings(page)
    await page.goto('/settings')
    await panel(page).getByLabel('Clave de la API').fill('sk-or-v1-secret')
    await panel(page).getByRole('combobox', { name: 'Modelo', exact: true }).fill('free/model:free')
    await panel(page).getByRole('button', { name: 'Guardar' }).click()
    await panel(page).getByRole('button', { name: 'Quitar mi servicio' }).click()
    await expect(panel(page).getByRole('status')).toContainText('La IA está apagada')
  })

  test('says so when the local server is down', async ({ page }) => {
    await page.goto('/settings')
    await expect(panel(page).getByRole('status')).toContainText('no responde')
    await expect(panel(page).getByLabel('Límite diario de tokens')).toBeVisible()
  })
})
