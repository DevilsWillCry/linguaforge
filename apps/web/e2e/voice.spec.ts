import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

type Failure = 'load' | 'speak'

/**
 * Replaces only the worker that runs the model, so these tests need no download. Everything
 * after it is real: the store, the pacing and the Web Audio calls.
 */
async function fakeModel(page: Page, { fail, hang }: { fail?: Failure; hang?: boolean } = {}) {
  await page.addInitScript(
    ({ fail, hang }) => {
      const generated: { text: string; voice: string; speed: number }[] = []
      const played: number[] = []
      Object.assign(window, { generated, played })

      const start = AudioBufferSourceNode.prototype.start
      AudioBufferSourceNode.prototype.start = function (...args) {
        played.push(this.buffer?.duration ?? 0)
        return start.apply(this, args)
      }

      const RealWorker = window.Worker
      class FakeModelWorker {
        onmessage: ((event: { data: unknown }) => void) | null = null
        onerror: (() => void) | null = null
        terminate() {}
        private send(data: unknown) {
          setTimeout(() => this.onmessage?.({ data }), 0)
        }
        postMessage(message: { type: string; id: number; text: string; voice: string; speed: number }) {
          if (message.type === 'load') {
            if (hang) {
              this.send({ type: 'progress', file: 'model.onnx', loaded: 46, total: 92 })
              return
            }
            if (fail === 'load') {
              this.send({ type: 'loadFailed' })
              return
            }
            this.send({ type: 'progress', file: 'model.onnx', loaded: 92, total: 92 })
            this.send({ type: 'ready' })
          } else if (message.type === 'speak') {
            if (fail === 'speak') {
              this.send({ type: 'speakFailed', id: message.id })
              return
            }
            generated.push({ text: message.text, voice: message.voice, speed: message.speed })
            this.send({ type: 'chunk', id: message.id, samples: new Float32Array(2400), sampleRate: 24000, chars: message.text.length })
            this.send({ type: 'done', id: message.id })
          }
        }
      }
      window.Worker = new Proxy(RealWorker, {
        construct(target, args: [string | URL, WorkerOptions?]) {
          return String(args[0]).includes('kokoro.worker') ? (new FakeModelWorker() as unknown as Worker) : new target(...args)
        },
      })
    },
    { fail, hang },
  )
}

/** A basic voice that records what it is asked to say. */
async function fakeBrowserVoice(page: Page) {
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
    })
  })
}

const generated = (page: Page) => page.evaluate(() => (window as unknown as { generated: { text: string; voice: string; speed: number }[] }).generated)
const said = (page: Page) => page.evaluate(() => (window as unknown as { said: string[] }).said)
const played = (page: Page) => page.evaluate(() => (window as unknown as { played: number[] }).played)
const settings = (page: Page) => page.getByTestId('voice-settings')

async function lastReviewedAsProduction(page: Page, texts: string[]) {
  await page.evaluate(async (texts) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('linguaforge')
      request.onsuccess = () => resolve(request.result)
    })
    const store = db.transaction('entries', 'readwrite').objectStore('entries')
    const entries = await new Promise<{ text: string; stats: { lastMode?: string } }[]>((resolve) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
    })
    await Promise.all(
      entries
        .filter((entry) => texts.includes(entry.text))
        .map(
          (entry) =>
            new Promise((resolve) => {
              entry.stats.lastMode = 'production'
              store.put(entry).onsuccess = resolve
            }),
        ),
    )
    db.close()
  }, texts)
}

async function turnOnNaturalVoice(page: Page) {
  await page.goto('/settings')
  await settings(page).getByRole('button', { name: 'Natural (descarga 92 MB)' }).click()
  await expect(settings(page).getByRole('button', { name: 'Natural', exact: true })).toHaveAttribute('aria-pressed', 'true')
}

test.describe('choosing the voice', () => {
  test('keeps the basic voice and downloads nothing until asked', async ({ page }) => {
    await fakeBrowserVoice(page)
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    await page.goto('/settings')
    await expect(settings(page).getByRole('button', { name: 'Básica' })).toHaveAttribute('aria-pressed', 'true')
    await expect(settings(page)).toContainText('92 MB')
    await settings(page).getByTestId('voice-test').click()
    await expect.poll(() => said(page)).toHaveLength(1)
    expect(requests.filter((url) => /huggingface|kokoro\.worker/.test(url))).toEqual([])
  })

  test('downloads on request, then lets you pick and try a voice', async ({ page }) => {
    await fakeModel(page)
    await turnOnNaturalVoice(page)
    await settings(page).getByTestId('voice-select').selectOption('bf_emma')
    await settings(page).getByTestId('voice-test').click()
    await expect.poll(() => generated(page)).toHaveLength(1)
    expect((await generated(page))[0]).toMatchObject({ voice: 'bf_emma', speed: 1 })
    await expect.poll(() => played(page)).toHaveLength(1)
  })

  test('remembers the choice after a reload, without offering the download again', async ({ page }) => {
    await fakeModel(page)
    await turnOnNaturalVoice(page)
    await settings(page).getByTestId('voice-select').selectOption('am_michael')
    await page.reload()
    await expect(settings(page).getByRole('button', { name: 'Natural', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(settings(page).getByTestId('voice-select')).toHaveValue('am_michael')
  })

  test('switches back to the basic voice and keeps the download', async ({ page }) => {
    await fakeBrowserVoice(page)
    await fakeModel(page)
    await turnOnNaturalVoice(page)
    await settings(page).getByRole('button', { name: 'Básica' }).click()
    await settings(page).getByTestId('voice-test').click()
    await expect.poll(() => said(page)).toHaveLength(1)
    expect(await generated(page)).toEqual([])
    await expect(settings(page).getByRole('button', { name: 'Natural', exact: true })).toBeVisible()
  })

  test('shows progress and can cancel the download', async ({ page }) => {
    await fakeModel(page, { hang: true })
    await page.goto('/settings')
    await settings(page).getByRole('button', { name: 'Natural (descarga 92 MB)' }).click()
    await expect(settings(page).getByRole('status')).toContainText('50 %')
    await settings(page).getByRole('button', { name: 'Cancelar' }).click()
    await expect(settings(page).getByTestId('voice-download')).toHaveCount(0)
    await expect(settings(page).getByRole('button', { name: 'Básica' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('toast')).toHaveCount(0)
  })

  test('deleting the download empties its caches and returns to the basic voice', async ({ page }) => {
    await fakeModel(page)
    await turnOnNaturalVoice(page)
    await page.evaluate(async () => {
      await (await caches.open('kokoro-voices')).put('/fake-voice', new Response('x'))
    })
    await settings(page).getByRole('button', { name: 'Borrar la descarga' }).click()
    await expect(settings(page).getByRole('button', { name: 'Natural (descarga 92 MB)' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => caches.has('kokoro-voices'))).toBe(false)
    await expect(settings(page).getByRole('button', { name: 'Básica' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('explains a failed download and offers it again', async ({ page }) => {
    await fakeModel(page, { fail: 'load' })
    await page.goto('/settings')
    await settings(page).getByRole('button', { name: 'Natural (descarga 92 MB)' }).click()
    await expect(page.getByText('No se pudo descargar la voz natural')).toBeVisible()
    await expect(settings(page).getByRole('button', { name: 'Natural (descarga 92 MB)' })).toBeEnabled()
  })

  test('has no accessibility problems, in either state', async ({ page }) => {
    await fakeModel(page)
    await page.goto('/settings')
    const check = async () => {
      const { violations } = await new AxeBuilder({ page }).include('[data-testid="voice-settings"]').withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(violations.map((violation) => violation.id)).toEqual([])
    }
    await check()
    await settings(page).getByRole('button', { name: 'Natural (descarga 92 MB)' }).click()
    await expect(settings(page).getByTestId('voice-select')).toBeVisible()
    await check()
  })
})

test.describe('where the voice is used', () => {
  const TURN = { reply: 'Morning! Any blockers today?', correction: null, usedTargets: [], newExpression: null }

  async function startChat(page: Page) {
    await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, aiConfigured: true } }))
    await page.route('**/api/ai/enrich', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    await page.route('**/api/ai/tutor', (route) =>
      route.fulfill({ json: { turn: TURN, usage: { inputTokens: 1, outputTokens: 1 } } }),
    )
    await page.goto('/tutor')
    await page.getByTestId('scenarios').getByRole('button', { name: 'Reunión diaria' }).click()
    await expect(page.getByTestId('chat-messages')).toContainText('Any blockers')
  }

  test('the tutor reads replies with the natural voice', async ({ page }) => {
    await fakeBrowserVoice(page)
    await fakeModel(page)
    await turnOnNaturalVoice(page)
    await startChat(page)
    await page.getByRole('button', { name: 'Escuchar' }).click()
    await expect.poll(() => generated(page)).toEqual([{ text: TURN.reply, voice: 'af_heart', speed: 1 }])
    expect(await said(page)).toEqual([])
    await expect(page.getByTestId('voice-nudge')).toHaveCount(0)
  })

  test('the tutor points people with the basic voice to the natural one', async ({ page }) => {
    await fakeBrowserVoice(page)
    await startChat(page)
    await expect(page.getByTestId('voice-nudge').getByRole('link')).toHaveAttribute('href', '/settings')
  })

  test('falls back to the basic voice when generating fails, and says so', async ({ page }) => {
    await fakeBrowserVoice(page)
    await fakeModel(page, { fail: 'speak' })
    await turnOnNaturalVoice(page)
    await startChat(page)
    await page.getByRole('button', { name: 'Escuchar' }).click()
    await expect.poll(() => said(page)).toEqual([TURN.reply])
    await expect(page.getByText('La voz natural falló, así que se usó la básica')).toBeVisible()
  })

  test('says so when generating fails and there is no basic voice', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', {
        value: { getVoices: () => [], addEventListener: () => {}, cancel: () => {}, speak: () => {} },
      })
    })
    await fakeModel(page, { fail: 'speak' })
    await turnOnNaturalVoice(page)
    await startChat(page)
    await page.getByRole('button', { name: 'Escuchar' }).click()
    await expect(page.getByText('La voz natural falló y este navegador no tiene otra voz')).toBeVisible()
  })

  test('listening reviews appear without any basic voice, and "slower" slows the model', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', {
        value: { getVoices: () => [], addEventListener: () => {}, cancel: () => {}, speak: () => {} },
      })
    })
    await fakeModel(page)
    await turnOnNaturalVoice(page)
    // Only a card that was last reviewed another way can come up as listening.
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByTestId('entry').first().waitFor()
    await lastReviewedAsProduction(page, ['Figure out', "I'm down", "There's no way...", 'By the way...'])
    await page.goto('/review')
    const card = page.getByTestId('review-card')
    await expect(card).toBeVisible()
    await expect(page.getByTestId('no-voice')).toHaveCount(0)
    expect(await card.getAttribute('data-mode')).toBe('listening')
    await expect.poll(async () => (await generated(page)).length).toBeGreaterThan(0)

    await card.getByRole('button', { name: 'Más lento' }).click()
    await expect.poll(async () => (await generated(page)).at(-1)?.speed).toBe(0.7)
  })
})
