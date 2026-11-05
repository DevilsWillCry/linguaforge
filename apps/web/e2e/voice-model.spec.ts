import { expect, test } from '@playwright/test'

const SAMPLE = 'Hey! This is how'

/**
 * Downloads the real 92 MB model, so it only runs when asked:
 *
 *   LF_E2E_VOICE=1 LF_E2E_FIREFOX=1 pnpm exec playwright test voice-model --project=firefox
 */
test.skip(!process.env.LF_E2E_VOICE, 'Set LF_E2E_VOICE=1 to download and test the real model')
test.setTimeout(240_000)

test('the real model speaks, keeps the text local and works without Hugging Face', async ({ page }) => {
  // Records the loudest sample of everything played, to prove it isn't silence.
  await page.addInitScript(() => {
    const played: { seconds: number; peak: number }[] = []
    Object.assign(window, { played })
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      const samples = this.buffer?.getChannelData(0) ?? new Float32Array()
      played.push({ seconds: this.buffer?.duration ?? 0, peak: samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0) })
      return start.apply(this, args)
    }
  })
  const readPlayed = () => page.evaluate(() => (window as unknown as { played: { seconds: number; peak: number }[] }).played)

  const external: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (new URL(url).hostname === 'localhost') return
    external.push(url)
    expect(`${url} ${request.postData() ?? ''}`).not.toContain(SAMPLE)
    expect(request.method()).toBe('GET')
  })
  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(error.message))

  await page.goto('/settings')
  const settings = page.getByTestId('voice-settings')
  await settings.getByRole('button', { name: 'Natural (descarga 92 MB)' }).click()
  await expect(settings.getByTestId('voice-select')).toBeVisible({ timeout: 180_000 })
  expect(external.every((url) => /huggingface\.co|\.hf\.co/.test(url))).toBe(true)
  expect(await page.evaluate(() => caches.has('kokoro-voices'))).toBe(true)

  await settings.getByTestId('voice-test').click()
  await expect.poll(async () => (await readPlayed()).length, { timeout: 60_000 }).toBeGreaterThan(0)
  const heard = await readPlayed()
  expect(heard[0]!.seconds).toBeGreaterThan(0.3)
  expect(heard[0]!.peak).toBeGreaterThan(0.05)

  // With Hugging Face unreachable, a new page must still load the model and every voice.
  await page.context().route(/huggingface\.co|\.hf\.co/, (route) => route.abort())
  await page.reload()
  await expect(settings.getByRole('button', { name: 'Natural', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await settings.getByTestId('voice-select').selectOption('bm_george')
  await settings.getByTestId('voice-test').click()
  await expect.poll(async () => (await readPlayed()).length, { timeout: 60_000 }).toBeGreaterThan(0)
  expect((await readPlayed())[0]!.peak).toBeGreaterThan(0.05)
  await expect(page.getByText('La voz natural falló')).toHaveCount(0)
  expect(failures).toEqual([])
})
