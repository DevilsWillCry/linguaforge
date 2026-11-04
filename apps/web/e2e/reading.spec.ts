import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const PAGE_URL = 'https://news.example/post'
const ARTICLE = {
  url: PAGE_URL,
  title: 'How we fixed it',
  paragraphs: [
    'Today we figured out the problem. It took extraordinary patience.',
    'Sometimes you need to borrow ideas. That helps a lot.',
  ],
}

async function mockArticle(page: Page, response: { status?: number; json: unknown } = { json: ARTICLE }) {
  const asked: string[] = []
  await page.route('**/api/reading/extract', (route) => {
    asked.push((route.request().postDataJSON() as { url: string }).url)
    return route.fulfill(response)
  })
  return asked
}

async function openArticle(page: Page) {
  const asked = await mockArticle(page)
  await page.goto(`/reading?url=${encodeURIComponent(PAGE_URL)}`)
  await expect(page.getByTestId('reading-article')).toContainText('figured out')
  return asked
}

const article = (page: Page) => page.getByTestId('reading-article')
const word = (page: Page, text: string) => article(page).locator('[data-word]').filter({ hasText: new RegExp(`^${text}$`) })
const storedEntry = (page: Page, text: string) =>
  page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('linguaforge')
      request.onsuccess = () => resolve(request.result)
    })
    const all = await new Promise<Record<string, any>[]>((resolve) => {
      const request = db.transaction('entries').objectStore('entries').getAll()
      request.onsuccess = () => resolve(request.result)
    })
    db.close()
    return all.find((entry) => entry.text === name) ?? null
  }, text)

test.describe('opening a page', () => {
  test('opens a link, and the address can be shared or reloaded', async ({ page }) => {
    const asked = await mockArticle(page)
    await page.goto('/reading')
    await page.getByLabel('Enlace de la página').fill(PAGE_URL)
    await page.getByRole('button', { name: 'Abrir', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('How we fixed it')
    await expect(page).toHaveURL(/reading\?url=/)
    expect(asked).toEqual([PAGE_URL])
    await page.reload()
    await expect(article(page)).toContainText('figured out')
  })

  test('rejects something that is not a link, without calling the server', async ({ page }) => {
    const asked = await mockArticle(page)
    await page.goto('/reading')
    await page.getByLabel('Enlace de la página').fill('javascript:alert(1)')
    await page.getByRole('button', { name: 'Abrir', exact: true }).click()
    await expect(page.getByTestId('reading-open').getByRole('alert')).toBeVisible()
    expect(asked).toEqual([])
  })

  test('ignores an unsafe link in the address', async ({ page }) => {
    const asked = await mockArticle(page)
    await page.goto('/reading?url=javascript:alert(1)')
    await expect(page.getByTestId('reading-open')).toBeVisible()
    expect(asked).toEqual([])
  })

  test('explains a page it cannot open, and pasting still works with its source', async ({ page }) => {
    await mockArticle(page, { status: 502, json: { error: 'fetch_failed' } })
    await page.goto(`/reading?url=${encodeURIComponent(PAGE_URL)}`)
    const error = page.getByTestId('reading-error')
    await expect(error).toContainText('No se pudo abrir la página')
    await expect(error.getByRole('link', { name: 'Ver la página original' })).toHaveAttribute('href', PAGE_URL)

    await page.getByLabel('O pega el texto').fill('First pasted part.\n\nSecond pasted part with extraordinary words.')
    await page.getByRole('button', { name: 'Leer este texto' }).click()
    await expect(article(page).locator('p.mb-4')).toHaveCount(2)
    await word(page, 'extraordinary').click()
    await page.getByTestId('capture-card').getByRole('button', { name: 'Añadir a la biblioteca' }).click()
    await expect(page.getByTestId('toast')).toContainText('añadida')
    expect((await storedEntry(page, 'extraordinary'))!.source.url).toBe(PAGE_URL)
  })

  test('says so for internal addresses, and offers no link to them', async ({ page }) => {
    await mockArticle(page, { status: 400, json: { error: 'blocked_url' } })
    await page.goto(`/reading?url=${encodeURIComponent('http://192.168.1.1/')}`)
    const error = page.getByTestId('reading-error')
    await expect(error).toContainText('páginas públicas')
    await expect(error.getByRole('link')).toHaveCount(0)
  })

  test('says so when the local server is down', async ({ page }) => {
    await page.goto(`/reading?url=${encodeURIComponent(PAGE_URL)}`)
    await expect(page.getByTestId('reading-error')).toContainText('servidor local')
  })

  test('remembers titles and links, but never the text', async ({ page }) => {
    await openArticle(page)
    await page.getByRole('button', { name: 'Elegir otra' }).click()
    await expect(page.getByTestId('reading-recent').getByRole('link', { name: 'How we fixed it' })).toBeVisible()
    const stored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('linguaforge')
        request.onsuccess = () => resolve(request.result)
      })
      const tables: unknown[] = []
      for (const name of db.objectStoreNames) {
        tables.push(await new Promise((resolve) => {
          const request = db.transaction(name).objectStore(name).getAll()
          request.onsuccess = () => resolve(request.result)
        }))
      }
      db.close()
      return JSON.stringify([tables, { ...localStorage }, { ...sessionStorage }])
    })
    expect(stored).toContain('How we fixed it')
    expect(stored).not.toContain('extraordinary patience')
  })
})

test.describe('reading', () => {
  test('shows plain text only, even if the text looks like markup', async ({ page }) => {
    await mockArticle(page, {
      json: { ...ARTICLE, paragraphs: ['<img src=x onerror="window.hacked=true"> and <b>bold</b> are just words here.'] },
    })
    await page.goto(`/reading?url=${encodeURIComponent(PAGE_URL)}`)
    await expect(article(page)).toContainText('<img src=x')
    await expect(article(page).locator('img, b')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { hacked?: boolean }).hacked)).toBeUndefined()
  })

  test('marks Library items and counts them', async ({ page }) => {
    await openArticle(page)
    await expect(article(page).locator('[data-status]').first()).toHaveText('figured out')
    // "figured out" and "borrow".
    await expect(page.getByTestId('reading-items')).toHaveText('2')
    await expect(page.getByTestId('reading-stats')).toContainText('%')
  })
})

test.describe('capturing', () => {
  test('adds a word with its sentence and the page as its source', async ({ page }) => {
    await openArticle(page)
    await word(page, 'extraordinary').click()
    const card = page.getByTestId('capture-card')
    await expect(card).toContainText('It took extraordinary patience.')
    await card.getByRole('button', { name: 'Añadir a la biblioteca' }).click()
    await expect(page.getByTestId('toast')).toContainText('«extraordinary» añadida')

    const entry = (await storedEntry(page, 'extraordinary'))!
    expect(entry.realExamples).toEqual(['It took extraordinary patience.'])
    expect(entry.ownExamples).toEqual([])
    expect(entry.trigger).toBe('Reading')
    expect(entry.enrichment).toBe('empty')
    expect(entry.source).toEqual({ title: 'How we fixed it', url: PAGE_URL })
    await expect(word(page, 'extraordinary')).toHaveAttribute('data-status', 'New')
  })

  test('adds the sentence to an item you already have', async ({ page }) => {
    await openArticle(page)
    const before = (await storedEntry(page, 'Figure out'))!
    await article(page).locator('[data-status]').first().click()
    await expect(page.getByTestId('capture-card')).toContainText('To understand')
    await page.getByTestId('capture-card').getByRole('button', { name: 'Añadir esta frase' }).click()
    await expect(page.getByTestId('toast')).toContainText('Frase añadida')
    const after = (await storedEntry(page, 'Figure out'))!
    expect(after.realExamples).toEqual([...before.realExamples, 'Today we figured out the problem.'])
    expect(after.ownExamples).toEqual(before.ownExamples)
  })

  test('captures by typing, finding the sentence', async ({ page }) => {
    await openArticle(page)
    await page.getByTestId('reading-type').getByLabel('Capturar una palabra o frase').fill('a lot')
    await page.getByTestId('reading-type').getByRole('button', { name: 'Capturar' }).click()
    await expect(page.getByTestId('capture-card')).toContainText('That helps a lot.')
  })

  test('captures a dragged phrase', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Dragging over text is a desktop gesture')
    await openArticle(page)
    await word(page, 'patience').evaluate((element) => {
      const sentence = element.closest('[data-sentence]')!
      const range = document.createRange()
      range.setStartBefore(sentence.querySelector('[data-word="4"]')!)
      range.setEndAfter(element)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(range)
      sentence.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await expect(page.getByTestId('capture-card').getByLabel('Palabra o frase')).toHaveValue('extraordinary patience')
  })
})

test.describe('sources from the Library', () => {
  const TITLE = 'Phrasal Verb - to figure out'
  const item = (page: Page, text: string) => page.getByTestId('library-source').filter({ hasText: text })

  test('a link to a page opens in Reading, from the list, the table and the editor', async ({ page, isMobile }) => {
    await mockArticle(page)
    await page.goto('/reading')
    await item(page, TITLE).getByLabel('Enlace del video').fill(PAGE_URL)
    await item(page, TITLE).getByRole('button', { name: 'Guardar enlace' }).click()
    await expect(item(page, TITLE).getByRole('link', { name: TITLE })).toBeVisible()
    expect((await storedEntry(page, 'Figure out'))!.source).toEqual({ title: TITLE, url: PAGE_URL })

    await item(page, TITLE).getByRole('link', { name: TITLE }).click()
    await expect(article(page)).toContainText('figured out')

    if (!isMobile) {
      await page.goto('/library')
      await page.getByRole('button', { name: 'Tabla', exact: true }).click()
      const shortcut = page.getByRole('link', { name: 'Abrir en Lectura: Figure out' })
      await shortcut.scrollIntoViewIfNeeded()
      await shortcut.click()
      await expect(article(page)).toContainText('figured out')
    }

    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir Figure out' }).click()
    await page.getByTestId('entry-editor').getByRole('link', { name: 'Abrir en Lectura' }).click()
    await expect(article(page)).toContainText('figured out')
  })

  test('a linked page moves off the Video list, and a video off the Reading list', async ({ page }) => {
    await page.goto('/reading')
    await item(page, TITLE).getByLabel('Enlace del video').fill(PAGE_URL)
    await item(page, TITLE).getByRole('button', { name: 'Guardar enlace' }).click()
    await expect(item(page, TITLE).getByRole('link', { name: TITLE })).toBeVisible()
    await page.goto('/video')
    await expect(page.getByTestId('library-source')).toHaveCount(3)
    await expect(item(page, TITLE)).toHaveCount(0)

    const OTHER = 'I Am Down Meaning'
    await item(page, OTHER).getByLabel('Enlace del video').fill('https://youtu.be/dQw4w9WgXcQ')
    await item(page, OTHER).getByRole('button', { name: 'Guardar enlace' }).click()
    await expect(item(page, OTHER)).toContainText('Sin transcripción')
    await page.goto('/reading')
    await expect(item(page, OTHER)).toHaveCount(0)
    await expect(item(page, TITLE)).toBeVisible()
  })

  test('offers both a video and a web search for a title', async ({ page }) => {
    await page.goto('/reading')
    await expect(item(page, TITLE).getByRole('link', { name: 'Buscar en la web' })).toHaveAttribute('href', /google\.com\/search/)
    await expect(item(page, TITLE).getByRole('link', { name: 'Buscar en YouTube' })).toHaveAttribute('href', /youtube\.com\/results/)
  })
})

test.describe('the level estimate', () => {
  test('only sends text when asked, and shows the answer', async ({ page }) => {
    await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, aiConfigured: true } }))
    await page.route('**/api/ai/enrich', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    const sent: string[] = []
    await page.route('**/api/ai/level', (route) => {
      sent.push((route.request().postDataJSON() as { text: string }).text)
      return route.fulfill({ json: { estimate: { level: 'B1', reason: 'Vocabulario común.' }, usage: { inputTokens: 10, outputTokens: 5 } } })
    })
    await openArticle(page)
    expect(sent).toEqual([])
    await page.getByRole('button', { name: 'Estimar el nivel con IA' }).click()
    await expect(page.getByTestId('reading-level')).toContainText('B1')
    await expect(page.getByTestId('reading-level')).toContainText('Vocabulario común.')
    expect(sent[0]).toContain('figured out')
  })

  test('explains that it needs AI when AI is off', async ({ page }) => {
    await openArticle(page)
    await expect(page.getByTestId('reading-stats')).toContainText('Activa la IA')
  })
})

test('fits a phone screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only about phones')
  await openArticle(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`accessibility in ${colorScheme} theme`, () => {
    test.use({ colorScheme })
    async function expectNoViolations(page: Page) {
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(violations.map((v) => ({ rule: v.id, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')), msg: v.nodes[0]?.any[0]?.message }))).toEqual([])
    }

    test('the start page meets WCAG AA', async ({ page }) => {
      await page.goto('/reading')
      await expect(page.getByTestId('library-source').first()).toBeVisible()
      await expectNoViolations(page)
    })

    test('a page with a capture meets WCAG AA', async ({ page }) => {
      await openArticle(page)
      await word(page, 'extraordinary').click()
      await expect(page.getByTestId('capture-card')).toBeVisible()
      await expectNoViolations(page)
    })

    test('an error meets WCAG AA', async ({ page }) => {
      await mockArticle(page, { status: 502, json: { error: 'fetch_failed' } })
      await page.goto(`/reading?url=${encodeURIComponent(PAGE_URL)}`)
      await expect(page.getByTestId('reading-error')).toBeVisible()
      await expectNoViolations(page)
    })
  })
}
