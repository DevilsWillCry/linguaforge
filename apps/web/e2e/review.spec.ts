import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const card = (page: Page) => page.getByTestId('review-card')
const answerBox = (page: Page) => card(page).getByRole('textbox')
const progress = (page: Page) => page.getByTestId('review-progress')
const modeOf = (page: Page) => card(page).getAttribute('data-mode')

async function openReview(page: Page) {
  await page.goto('/review')
  await expect(card(page)).toBeVisible()
}

/** Answers the card on screen with no attempt, then grades it. */
async function answerAndGrade(page: Page, grade: string) {
  await card(page).getByRole('button', { name: /^(Comprobar|Revisar mi frase)$/ }).click()
  await page.getByTestId('grades').getByRole('button', { name: new RegExp(`^${grade}`) }).click()
}

/** Gives the browser one English voice, and records what it is asked to say. */
async function fakeVoice(page: Page) {
  await page.addInitScript(() => {
    const said: string[] = []
    Object.assign(window, { said })
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'en-US', name: 'Test' }],
        addEventListener: () => {},
        cancel: () => {},
        speak: (utterance: { text: string }) => said.push(utterance.text),
      },
    })
    Object.assign(window, { SpeechSynthesisUtterance: class { voice = null; lang = ''; rate = 1; constructor(public text: string) {} } })
  })
}

async function patchEntry(page: Page, text: string, change: string) {
  await page.evaluate(
    async ({ text, change }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('linguaforge')
        request.onsuccess = () => resolve(request.result)
      })
      const store = db.transaction('entries', 'readwrite').objectStore('entries')
      const all = await new Promise<Record<string, any>[]>((resolve) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
      })
      for (const entry of all) {
        if (entry.text !== text) continue
        new Function('entry', change)(entry)
        store.put(entry)
      }
      db.close()
    },
    { text, change },
  )
}

test.describe('a review session', () => {
  test('hides the answer until you try, then shows it with a suggested grade', async ({ page }) => {
    await openReview(page)
    await expect(page.getByTestId('grades')).toHaveCount(0)
    await expect(page.getByTestId('review-answer')).toHaveCount(0)

    await answerBox(page).fill('something wrong')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('review-answer')).toContainText('No era eso')
    await expect(page.getByTestId('expected-answer')).toBeVisible()
    await expect(page.getByTestId('grades').getByRole('button', { name: /^Otra vez/ })).toHaveClass(/lf-btn-primary/)
  })

  test('does not reveal the target in the text of a fill-in card', async ({ page }) => {
    await openReview(page)
    expect(await modeOf(page)).toBe('cloze')
    const sentence = page.getByTestId('cloze-sentence')
    await expect(sentence).toContainText('_____')
    const visible = await sentence.textContent()
    await card(page).getByRole('button', { name: 'Comprobar' }).click()
    const answer = await page.getByTestId('expected-answer').textContent()
    expect(visible!.toLowerCase()).not.toContain(answer!.toLowerCase())
  })

  test('accepts the right answer, ignoring case', async ({ page }) => {
    await openReview(page)
    await card(page).getByRole('button', { name: 'Comprobar' }).click()
    const answer = await page.getByTestId('expected-answer').textContent()
    await page.reload()
    await expect(card(page)).toBeVisible()
    await answerBox(page).fill(answer!.toUpperCase())
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('review-answer')).toContainText('Correcto')
    await expect(page.getByTestId('grades').getByRole('button', { name: /^Bien/ })).toHaveClass(/lf-btn-primary/)
  })

  test('grades with the keyboard and brings a failed card back later', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones have no number keys')
    await openReview(page)
    await expect(progress(page)).toContainText('Quedan 4')
    await page.keyboard.press('Enter')
    await page.keyboard.press('1')
    // "Again" is due again within minutes, so the count stays the same.
    await expect(progress(page)).toContainText('Quedan 4')
    await page.keyboard.press('Enter')
    await page.keyboard.press('4')
    await expect(progress(page)).toContainText('Quedan 3')
  })

  test('tests a card that comes back in a different way', async ({ page }) => {
    await openReview(page)
    const first = await modeOf(page)
    const name = await card(page).getByRole('button', { name: 'Comprobar' }).click().then(() => page.getByTestId('review-answer').locator('p.font-semibold').textContent())
    await page.getByTestId('grades').getByRole('button', { name: /^Otra vez/ }).click()
    for (let i = 0; i < 3; i += 1) await answerAndGrade(page, 'Fácil')
    await expect(card(page)).toBeVisible()
    expect(await modeOf(page)).not.toBe(first)
    await card(page).getByRole('button', { name: /Comprobar|Revisar/ }).click()
    await expect(page.getByTestId('review-answer').locator('p.font-semibold')).toHaveText(name!)
  })

  test('undoes the last answer, and the status with it', async ({ page }) => {
    await openReview(page)
    const before = await progress(page).textContent()
    await answerAndGrade(page, 'Fácil')
    await expect(progress(page)).not.toHaveText(before!)
    await card(page).getByRole('button', { name: /Deshacer/ }).click()
    await expect(progress(page)).toHaveText(before!)
    await expect(page.getByTestId('grades')).toHaveCount(0)
  })

  test('survives a reload, without repeating finished cards', async ({ page }) => {
    await openReview(page)
    await answerAndGrade(page, 'Fácil')
    await expect(progress(page)).toContainText('Quedan 3')
    await page.reload()
    await expect(progress(page)).toContainText('Quedan 3')
  })

  test('finishes, and has nothing left to review', async ({ page }) => {
    await openReview(page)
    for (let i = 0; i < 4; i += 1) await answerAndGrade(page, 'Fácil')
    await expect(page.getByTestId('review-finished')).toContainText('Respuestas de hoy: 4')
    await page.reload()
    await expect(page.getByTestId('review-finished')).toContainText('Nada por repasar')
  })

  test('moves a New card to Learning after a correct answer', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByTestId('entry').first().waitFor()
    await patchEntry(page, 'Figure out', "entry.status = 'New'")
    await page.goto('/review')
    await expect(card(page)).toBeVisible()
    for (let i = 0; i < 4; i += 1) await answerAndGrade(page, 'Fácil')
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await expect(page.getByTestId('entry').filter({ hasText: 'Figure out' })).toContainText('Learning')
  })

  test('respects the daily limit', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lf-review-limit', '2'))
    await openReview(page)
    await expect(progress(page)).toContainText('Quedan 2')
    await answerAndGrade(page, 'Fácil')
    // Waits for the answer to be saved, so the reload can't interrupt it.
    await expect(progress(page)).toContainText('Quedan 1')
    await page.reload()
    await expect(progress(page)).toContainText('Quedan 1')
  })

  test('leaves unconfirmed entries out', async ({ page }) => {
    await openReview(page)
    for (let i = 0; i < 4; i += 1) {
      await card(page).getByRole('button', { name: /Comprobar|Revisar/ }).click()
      await expect(page.getByTestId('review-answer')).not.toContainText(/Borrow|Shall|Such|Willing/)
      await page.getByTestId('grades').getByRole('button', { name: /^Fácil/ }).click()
    }
  })

  test('warns about a card that keeps failing and offers to edit it', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByTestId('entry').first().waitFor()
    for (const text of ['Figure out', "I'm down", "There's no way...", 'By the way...']) {
      await patchEntry(page, text, 'entry.srs.lapses = 5')
    }
    await openReview(page)
    await card(page).getByRole('button', { name: /Comprobar|Revisar/ }).click()
    const notice = page.getByTestId('leech-notice')
    await expect(notice).toContainText('mnemotecnia')
    await notice.getByRole('button', { name: 'Editar' }).click()
    await expect(page.getByTestId('entry-editor')).toBeVisible()
  })

  test('does not grade while typing in the entry editor', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones have no number keys')
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByTestId('entry').first().waitFor()
    for (const text of ['Figure out', "I'm down", "There's no way...", 'By the way...']) {
      await patchEntry(page, text, 'entry.srs.lapses = 5')
    }
    await openReview(page)
    await page.keyboard.press('Enter')
    await page.getByTestId('leech-notice').getByRole('button', { name: 'Editar' }).click()
    await page.getByTestId('entry-editor').getByLabel('Apuntes').fill('1234')
    await expect(page.getByTestId('entry-editor').getByLabel('Apuntes')).toHaveValue('1234')
    await expect(progress(page)).toContainText('Quedan 4')
  })

  test('keeps a status chosen by hand, until you set it back to automatic', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    const open = page.getByRole('button', { name: "Abrir I'm down" })
    const editor = page.getByTestId('entry-editor')
    await open.click()
    await editor.getByLabel('Estado').selectOption('New')
    await editor.getByRole('button', { name: 'Guardar' }).click()
    await expect(editor).toHaveCount(0)

    await page.goto('/review')
    for (let i = 0; i < 4; i += 1) await answerAndGrade(page, 'Fácil')
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await expect(page.getByTestId('entry').filter({ hasText: "I'm down" })).toContainText('New')

    await open.click()
    await editor.getByRole('button', { name: 'Volver al estado automático' }).click()
    await editor.getByRole('button', { name: 'Guardar' }).click()
    await expect(editor).toHaveCount(0)
    await open.click()
    await expect(editor.getByRole('button', { name: 'Volver al estado automático' })).toHaveCount(0)
  })
})

test.describe('listening', () => {
  test('plays the audio without showing the text, and can replay it', async ({ page }) => {
    await fakeVoice(page)
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByTestId('entry').first().waitFor()
    for (const text of ['Figure out', "I'm down", "There's no way...", 'By the way...']) {
      await patchEntry(page, text, "entry.stats.lastMode = 'production'")
    }
    await openReview(page)
    expect(await modeOf(page)).toBe('listening')
    const said = () => page.evaluate(() => (window as unknown as { said: string[] }).said)
    await expect.poll(async () => (await said()).length).toBe(1)
    const [sentence] = await said()
    await expect(card(page)).not.toContainText(sentence!)

    await card(page).getByRole('button', { name: /^Escuchar/ }).click()
    await expect.poll(async () => (await said()).length).toBe(2)

    await answerBox(page).fill(sentence!)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('review-answer')).toContainText('Correcto')
  })

  test('is skipped, with a note, when the browser has no voice', async ({ page }) => {
    await openReview(page)
    await expect(page.getByTestId('no-voice')).toBeVisible()
  })
})

test.describe('use it', () => {
  async function toUseIt(page: Page) {
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByTestId('entry').first().waitFor()
    for (const text of ['Figure out', "I'm down", "There's no way...", 'By the way...']) {
      await patchEntry(page, text, "entry.stats.lastMode = 'production'")
    }
  }

  test('grades your sentence with AI, and counts it as real output', async ({ page }) => {
    await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, aiConfigured: true } }))
    await page.route('**/api/ai/enrich', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await page.route('**/api/ai/feedback', (route) =>
      route.fulfill({
        json: {
          feedback: { verdict: 'natural', usesTarget: true, grammar: 'Bien.', naturalness: 'Natural.', toneFit: 'Encaja.', betterVersion: 'Same sentence.' },
          usage: { inputTokens: 10, outputTokens: 5 },
        },
      }),
    )
    await toUseIt(page)
    await openReview(page)
    expect(await modeOf(page)).toBe('useIt')
    await answerBox(page).fill('My own sentence.')
    await card(page).getByRole('button', { name: 'Revisar mi frase' }).click()
    await expect(page.getByTestId('review-feedback')).toContainText('Natural.')
    await expect(page.getByTestId('grades').getByRole('button', { name: /^Bien/ })).toHaveClass(/lf-btn-primary/)
    await page.getByTestId('review-answer').getByRole('button', { name: 'Añadir a mis ejemplos' }).click()
    await page.getByTestId('grades').getByRole('button', { name: /^Fácil/ }).click()

    const stored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('linguaforge')
        request.onsuccess = () => resolve(request.result)
      })
      const all = await new Promise<Record<string, any>[]>((resolve) => {
        const request = db.transaction('entries').objectStore('entries').getAll()
        request.onsuccess = () => resolve(request.result)
      })
      return all.filter((entry) => entry.stats.lastUsedInOutputAt && entry.ownExamples.includes('My own sentence.')).length
    })
    expect(stored).toBe(1)
  })

  test('falls back to grading yourself when AI is off', async ({ page }) => {
    await toUseIt(page)
    await openReview(page)
    await answerBox(page).fill('My own sentence.')
    await card(page).getByRole('button', { name: 'Revisar mi frase' }).click()
    await expect(page.getByTestId('review-feedback')).toHaveCount(0)
    await expect(page.getByTestId('grades')).toBeVisible()
  })

  test('carries on when the AI request fails', async ({ page }) => {
    await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, aiConfigured: true } }))
    await page.route('**/api/ai/enrich', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await page.route('**/api/ai/feedback', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await toUseIt(page)
    await openReview(page)
    await answerBox(page).fill('My own sentence.')
    await card(page).getByRole('button', { name: 'Revisar mi frase' }).click()
    await expect(page.getByTestId('grades')).toBeVisible()
    await expect(answerBox(page)).toHaveValue('My own sentence.')
  })
})

test('reviews the Vue deck by its description', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Vue 3 / Tech', exact: true }).click()
  await page.getByTestId('entry').first().waitFor()
  await page.goto('/review')
  await expect(card(page)).toBeVisible()
  expect(await modeOf(page)).toBe('production')
  await expect(page.getByTestId('no-voice')).toHaveCount(0)
  await card(page).getByRole('button', { name: 'Comprobar' }).click()
  await expect(page.getByTestId('review-answer')).toContainText(/Sintaxis|Qué hace/)
})

test.describe('the Today session', () => {
  test('starts, counts time, pauses, and survives a reload', async ({ page }) => {
    await page.goto('/')
    const clock = page.getByTestId('today-clock')
    await expect(clock).toHaveText('0:00')
    await page.getByRole('button', { name: 'Empezar la sesión' }).click()
    await expect(clock).not.toHaveText('0:00')

    await page.getByRole('button', { name: 'Pausar' }).click()
    const paused = await clock.textContent()
    await page.waitForTimeout(1300)
    await expect(clock).toHaveText(paused!)
    await expect(page.getByTestId('today-session')).toContainText('En pausa')

    await page.reload()
    await expect(clock).toHaveText(paused!)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(clock).not.toHaveText(paused!)
  })

  test('walks through the steps to the wrap-up', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Empezar la sesión' }).click()
    const step = page.getByTestId('today-step')
    await expect(step).toContainText('Calentamiento')
    await step.getByRole('link', { name: 'Abrir' }).click()
    await expect(page).toHaveURL(/\/review$/)
    await expect(card(page)).toBeVisible()
    await answerAndGrade(page, 'Fácil')

    await page.goto('/')
    await step.getByRole('button', { name: 'Marcar como hecho' }).click()
    await expect(step).toContainText('Nuevas')
    await step.getByRole('button', { name: 'Marcar como hecho' }).click()
    await expect(step).toContainText('Disponible en la Fase 4')
    await step.getByRole('button', { name: 'Saltar' }).click()
    await expect(step).toContainText('Disponible en la Fase 5')
    await step.getByRole('button', { name: 'Saltar' }).click()
    await expect(page.getByTestId('today-wrapup')).toContainText('1')
    await step.getByRole('button', { name: 'Marcar como hecho' }).click()
    await expect(page.getByTestId('today-finished')).toBeVisible()
  })
})

test('has no floating add button to mis-tap beside the grades', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The floating button is mobile only')
  await openReview(page)
  await expect(page.getByTestId('quick-add-fab')).toHaveCount(0)
  await page.getByTestId('tabbar').getByRole('link', { name: 'Biblioteca' }).click()
  await expect(page.getByTestId('quick-add-fab')).toBeVisible()
})

test('fits a phone screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only about phones')
  for (const path of ['/review', '/']) {
    await page.goto(path)
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  }
})

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`accessibility in ${colorScheme} theme`, () => {
    test.use({ colorScheme })
    async function expectNoViolations(page: Page) {
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(violations.map((v) => ({ rule: v.id, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))).toEqual([])
    }

    test('a question and an answer meet WCAG AA', async ({ page }) => {
      await openReview(page)
      await expectNoViolations(page)
      await card(page).getByRole('button', { name: 'Comprobar' }).click()
      await expect(page.getByTestId('grades')).toBeVisible()
      await expectNoViolations(page)
    })

    test('the Today session meets WCAG AA', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Empezar la sesión' }).click()
      await page.getByRole('button', { name: 'Pausar' }).click()
      await expectNoViolations(page)
    })
  })
}
