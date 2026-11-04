import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const USAGE = { inputTokens: 100, outputTokens: 50 }

const OPENING = { reply: 'Morning! Any blockers today?', correction: null, usedTargets: [], newExpression: null }
const CORRECTED = {
  reply: 'Oh nice, how did you solve it?',
  correction: {
    isNatural: false,
    natural: 'I figured out the bug yesterday.',
    reason: 'Hace falta el pasado.',
    toneNote: 'El tono encaja con una reunión.',
    keyPhrase: 'figure out the bug',
  },
  usedTargets: ['Figure out'],
  newExpression: { text: 'blocker', meaning: 'something that stops your work' },
}

/** Turns AI on and answers the tutor. The queue is kept off so it doesn't add requests. */
async function mockTutor(page: Page, turns: unknown[] = [OPENING, CORRECTED]) {
  const bodies: Record<string, any>[] = []
  await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, aiConfigured: true } }))
  await page.route('**/api/ai/enrich', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
  await page.route('**/api/ai/tutor', (route) => {
    bodies.push(route.request().postDataJSON())
    const turn = turns[Math.min(bodies.length - 1, turns.length - 1)]
    return route.fulfill({ json: { turn, usage: USAGE } })
  })
  return bodies
}

async function startChat(page: Page, name = 'Reunión diaria') {
  await page.goto('/tutor')
  await page.getByTestId('scenarios').getByRole('button', { name }).click()
  await expect(page.getByTestId('chat-messages')).toContainText('Any blockers')
}

async function sendLine(page: Page, text = 'I figure out the bug yesterday') {
  await page.getByLabel('Tu respuesta').fill(text)
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
}

const stored = (page: Page, table: string) =>
  page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('linguaforge')
      request.onsuccess = () => resolve(request.result)
    })
    const rows = await new Promise<Record<string, any>[]>((resolve) => {
      const request = db.transaction(name).objectStore(name).getAll()
      request.onsuccess = () => resolve(request.result)
    })
    db.close()
    return rows
  }, table)

const entryNamed = async (page: Page, text: string) => (await stored(page, 'entries')).find((entry) => entry.text === text)

test('explains that the tutor needs AI when it is off', async ({ page }) => {
  await page.goto('/tutor')
  await expect(page.getByTestId('tutor-off')).toContainText('La IA está apagada')
  await expect(page.getByTestId('tutor-off').getByRole('link', { name: 'Abrir Ajustes' })).toHaveAttribute('href', '/settings')
})

test.describe('a conversation', () => {
  test('opens the scene, with only the item names, first meanings and the scenario id', async ({ page }) => {
    const bodies = await mockTutor(page)
    await startChat(page)
    const [first] = bodies
    expect(first!.scenario).toBe('standup')
    expect(first!.history).toEqual([])
    expect(first!.targets.length).toBeGreaterThan(0)
    expect(first!.targets.length).toBeLessThanOrEqual(5)
    for (const target of first!.targets) expect(Object.keys(target).sort()).toEqual(['meaning', 'text'])
    expect(JSON.stringify(first)).not.toContain('Own')
  })

  test('shows the correction, with a diff, reason and tone note', async ({ page }) => {
    const bodies = await mockTutor(page)
    await startChat(page)
    await sendLine(page)
    const correction = page.getByTestId('correction')
    await expect(correction).toContainText('Hace falta el pasado.')
    await expect(correction).toContainText('El tono encaja')
    await expect(correction.getByTestId('word-diff').locator('del')).toHaveText('figure')
    await expect(correction.getByTestId('word-diff').locator('ins')).toHaveText('figured')
    await expect(page.getByTestId('chat-messages')).toContainText('how did you solve it')
    expect(bodies[1]!.history.at(-1)).toEqual({ role: 'user', content: 'I figure out the bug yesterday' })
    expect(bodies[1]!.history[0]).toEqual({ role: 'assistant', content: OPENING.reply })
  })

  test('sends with Enter, and Shift + Enter makes a new line', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones send with the button')
    const bodies = await mockTutor(page)
    await startChat(page)
    const box = page.getByLabel('Tu respuesta')
    await box.pressSequentially('line one')
    await box.press('Shift+Enter')
    await box.pressSequentially('line two')
    expect(bodies).toHaveLength(1)
    await box.press('Enter')
    await expect(page.getByTestId('correction')).toBeVisible()
    expect(bodies[1]!.history.at(-1).content).toBe('line one\nline two')
    await expect(box).toHaveValue('')
  })

  test('says so when a line is already natural, and offers nothing to save', async ({ page }) => {
    await mockTutor(page, [OPENING, { ...CORRECTED, correction: { isNatural: true, natural: 'x', reason: '', toneNote: '', keyPhrase: '' } }])
    await startChat(page)
    await sendLine(page, 'x')
    const correction = page.getByTestId('correction')
    await expect(correction).toContainText('Suena natural')
    await expect(correction.getByRole('button')).toHaveCount(0)
  })

  test('ticks a target used and counts it as real output', async ({ page }) => {
    await mockTutor(page)
    await startChat(page)
    const target = page.getByTestId('chat-targets').locator('li').filter({ hasText: 'Figure out' })
    await expect(target).toHaveAttribute('data-used', 'false')
    await sendLine(page)
    await expect(target).toHaveAttribute('data-used', 'true')
    expect((await entryNamed(page, 'Figure out'))!.stats.lastUsedInOutputAt).toBeTruthy()
  })

  test('saves a mistake to the Library, and only once', async ({ page }) => {
    await mockTutor(page)
    await startChat(page)
    await sendLine(page)
    const save = page.getByTestId('correction').getByRole('button', { name: /Guardar «figure out the bug»/ })
    await save.click()
    await expect(page.getByTestId('toast').filter({ hasText: '«figure out the bug» guardada' })).toBeVisible()
    await expect(page.getByTestId('correction').getByRole('button', { name: 'Guardada' })).toBeDisabled()

    const entry = (await entryNamed(page, 'figure out the bug'))!
    expect(entry.trigger).toBe('Own mistake')
    expect(entry.realExamples).toEqual(['I figured out the bug yesterday.'])
    expect(entry.ownExamples).toEqual([])
    expect(entry.enrichment).toBe('empty')
    expect(entry.source).toEqual({})

    const mistakes = await stored(page, 'mistakes')
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0]).toMatchObject({
      error: 'I figure out the bug yesterday',
      correction: 'I figured out the bug yesterday.',
      explanation: 'Hace falta el pasado.',
      entryId: entry.id,
    })
  })

  test('saves a useful expression from the tutor', async ({ page }) => {
    await mockTutor(page)
    await startChat(page)
    await sendLine(page)
    await page.getByTestId('new-expression').getByRole('button', { name: /blocker/ }).click()
    await expect(page.getByTestId('toast').filter({ hasText: '«blocker» guardada' })).toBeVisible()
    const entry = (await entryNamed(page, 'blocker'))!
    expect(entry.trigger).toBe('Conversation')
    expect(entry.ownExamples).toEqual([])
  })

  test('keeps your line and the conversation when sending fails', async ({ page }) => {
    await mockTutor(page)
    await startChat(page)
    await page.unroute('**/api/ai/tutor')
    await page.route('**/api/ai/tutor', (route) => route.fulfill({ status: 429, json: { error: 'rate_limited' } }))
    await sendLine(page, 'My careful sentence')
    await expect(page.getByTestId('toast').filter({ hasText: 'demasiadas peticiones' })).toBeVisible()
    await expect(page.getByLabel('Tu respuesta')).toHaveValue('My careful sentence')
    await expect(page.getByTestId('chat-messages').locator('[data-role="user"]')).toHaveCount(0)
  })

  test('goes back to the choices if the scene cannot open', async ({ page }) => {
    await mockTutor(page)
    await page.unroute('**/api/ai/tutor')
    await page.route('**/api/ai/tutor', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await page.goto('/tutor')
    await page.getByTestId('scenarios').getByRole('button', { name: 'Reunión diaria' }).click()
    await expect(page.getByTestId('toast').filter({ hasText: 'no responde' }).first()).toBeVisible()
    await expect(page.getByTestId('scenarios')).toBeVisible()
  })

  test('stops at the daily limit without calling the AI', async ({ page }) => {
    const bodies = await mockTutor(page)
    await page.addInitScript(() => localStorage.setItem('lf-ai-budget', '0'))
    await page.goto('/tutor')
    await page.getByTestId('scenarios').getByRole('button', { name: 'Reunión diaria' }).click()
    await expect(page.getByTestId('toast').filter({ hasText: 'límite diario' })).toBeVisible()
    expect(bodies).toHaveLength(0)
  })

  test('continues a saved conversation after a reload, and it can be deleted', async ({ page }) => {
    await mockTutor(page)
    await startChat(page)
    await sendLine(page)
    await expect(page.getByTestId('correction')).toBeVisible()
    await page.reload()
    const recent = page.getByTestId('recent-chats')
    await recent.getByRole('button', { name: /Reunión diaria/ }).first().click()
    await expect(page.getByTestId('correction')).toContainText('Hace falta el pasado.')
    await page.getByRole('button', { name: 'Terminar' }).click()
    await recent.getByRole('button', { name: 'Eliminar Reunión diaria' }).click()
    await expect(recent).toHaveCount(0)
  })
})

test.describe('voice', () => {
  async function fakeSpeech(page: Page) {
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
      Object.assign(window, {
        SpeechSynthesisUtterance: class { voice = null; lang = ''; rate = 1; constructor(public text: string) {} },
        // Current Chromium has the unprefixed name, and it would win over the prefixed one.
        SpeechRecognition: class {
          onresult: ((event: unknown) => void) | null = null
          onend: (() => void) | null = null
          onerror: (() => void) | null = null
          start() {
            const fail = (window as unknown as { micFails?: boolean }).micFails
            setTimeout(() => {
              if (fail) this.onerror?.()
              else this.onresult?.({ results: [[{ transcript: 'heard from the mic' }]] })
              this.onend?.()
            }, 0)
          }
          stop() {}
        },
      })
    })
  }

  test('puts what you say in the box, for you to check before sending', async ({ page }) => {
    await fakeSpeech(page)
    const bodies = await mockTutor(page)
    await startChat(page)
    await page.getByRole('button', { name: 'Hablar' }).click()
    await expect(page.getByLabel('Tu respuesta')).toHaveValue('heard from the mic')
    expect(bodies).toHaveLength(1)
    await expect(page.getByTestId('chat')).toContainText('servicio de voz')
  })

  test('keeps working by typing when the microphone fails', async ({ page }) => {
    await fakeSpeech(page)
    await page.addInitScript(() => Object.assign(window, { micFails: true }))
    await mockTutor(page)
    await startChat(page)
    await page.getByRole('button', { name: 'Hablar' }).click()
    await expect(page.getByTestId('toast').filter({ hasText: 'micrófono' })).toBeVisible()
    await expect(page.getByLabel('Tu respuesta')).toBeEditable()
  })

  test('reads replies aloud only when you ask', async ({ page }) => {
    await fakeSpeech(page)
    await mockTutor(page)
    await startChat(page)
    const said = () => page.evaluate(() => (window as unknown as { said: string[] }).said)
    expect(await said()).toEqual([])
    await page.getByRole('button', { name: 'Escuchar' }).click()
    expect(await said()).toEqual([OPENING.reply])
    await page.getByLabel('Leer las respuestas en voz alta').check()
    await sendLine(page)
    await expect.poll(said).toContain(CORRECTED.reply)
  })

  test('has no voice buttons where the browser has no support', async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { webkitSpeechRecognition: undefined, SpeechRecognition: undefined })
    })
    await mockTutor(page)
    await startChat(page)
    await expect(page.getByRole('button', { name: 'Hablar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Escuchar' })).toHaveCount(0)
  })
})

test.describe('the daily task', () => {
  const REVIEW = {
    feedback: 'Buen intento, revisa los tiempos.',
    corrected: 'Yesterday I figured out the bug.',
    items: [
      { text: 'Figure out', used: true, correct: true, note: 'Bien usada.' },
      { text: "I'm down", used: true, correct: false, note: 'Aquí no encaja.' },
      { text: 'By the way...', used: false, correct: false, note: 'No la usaste.' },
    ],
  }

  async function openTask(page: Page) {
    await mockTutor(page)
    await page.route('**/api/ai/output', (route) => route.fulfill({ json: { review: REVIEW, usage: USAGE } }))
    await page.goto('/tutor')
    await page.getByRole('button', { name: 'Tarea diaria' }).click()
    await expect(page.getByTestId('output-task')).toBeVisible()
  }

  test('counts words, and gives feedback item by item', async ({ page }) => {
    await openTask(page)
    await expect(page.getByTestId('output-targets')).toContainText('Figure out')
    await page.getByLabel('Tu texto').fill('Yesterday I figure out the bug')
    await expect(page.getByTestId('output-words')).toContainText('6')
    await page.getByRole('button', { name: 'Pedir opinión' }).click()

    const review = page.getByTestId('output-review')
    await expect(review).toContainText('Buen intento')
    await expect(review.getByTestId('word-diff').locator('ins')).toHaveText('figured')
    await expect(page.getByTestId('output-item').filter({ hasText: 'Figure out' })).toContainText('Bien usada')
    await expect(page.getByTestId('output-item').filter({ hasText: "I'm down" })).toContainText('Por mejorar')
    await expect(page.getByTestId('output-item').filter({ hasText: 'By the way' })).toContainText('Sin usar')
  })

  test('counts only the items used correctly as real output', async ({ page }) => {
    await openTask(page)
    await page.getByLabel('Tu texto').fill('Some text')
    await page.getByRole('button', { name: 'Pedir opinión' }).click()
    await expect(page.getByTestId('output-review')).toBeVisible()
    await expect.poll(async () => (await entryNamed(page, 'Figure out'))!.stats.lastUsedInOutputAt).toBeTruthy()
    expect((await entryNamed(page, "I'm down"))!.stats.lastUsedInOutputAt).toBeUndefined()
    expect((await entryNamed(page, 'By the way...'))!.stats.lastUsedInOutputAt).toBeUndefined()
  })

  test('keeps your text when the review fails', async ({ page }) => {
    await mockTutor(page)
    await page.route('**/api/ai/output', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await page.goto('/tutor')
    await page.getByRole('button', { name: 'Tarea diaria' }).click()
    await page.getByLabel('Tu texto').fill('My careful text')
    await page.getByRole('button', { name: 'Pedir opinión' }).click()
    await expect(page.getByTestId('toast').filter({ hasText: 'no responde' }).first()).toBeVisible()
    await expect(page.getByLabel('Tu texto')).toHaveValue('My careful text')
  })

  test('starts over', async ({ page }) => {
    await openTask(page)
    await page.getByLabel('Tu texto').fill('Some text')
    await page.getByRole('button', { name: 'Pedir opinión' }).click()
    await page.getByRole('button', { name: 'Escribir otro' }).click()
    await expect(page.getByLabel('Tu texto')).toHaveValue('')
  })
})

test('the Today session sends Output to the tutor', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Empezar la sesión' }).click()
  const step = page.getByTestId('today-step')
  for (let i = 0; i < 3; i += 1) await step.getByRole('button', { name: 'Marcar como hecho' }).click()
  await expect(step).toContainText('Output')
  await step.getByRole('link', { name: 'Abrir' }).click()
  await expect(page).toHaveURL(/\/tutor$/)
})

test('fits a phone screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only about phones')
  await mockTutor(page)
  await startChat(page)
  await sendLine(page)
  await expect(page.getByTestId('correction')).toBeVisible()
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

    test('the choices meet WCAG AA', async ({ page }) => {
      await mockTutor(page)
      await page.goto('/tutor')
      await expect(page.getByTestId('scenarios')).toBeVisible()
      await expectNoViolations(page)
    })

    test('a conversation with corrections meets WCAG AA', async ({ page }) => {
      await mockTutor(page)
      await startChat(page)
      await sendLine(page)
      await expect(page.getByTestId('correction')).toBeVisible()
      await expectNoViolations(page)
    })

    test('AI being off meets WCAG AA', async ({ page }) => {
      await page.goto('/tutor')
      await expect(page.getByTestId('tutor-off')).toBeVisible()
      await expectNoViolations(page)
    })
  })
}
