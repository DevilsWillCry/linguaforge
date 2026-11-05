import { expect, test } from '@playwright/test'

/**
 * Needs a production build, so it only runs when asked:
 *
 *   LF_E2E_PREVIEW=1 pnpm exec playwright test pwa --project=desktop
 *   LF_E2E_PREVIEW=1 LF_E2E_FIREFOX=1 pnpm exec playwright test pwa --project=firefox
 */
test.skip(!process.env.LF_E2E_PREVIEW, 'Set LF_E2E_PREVIEW=1 to test the production build')

test('installs, then opens every page and keeps data with no connection', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByTestId('today-session')).toBeVisible()
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
  const parsed = await (await page.request.get(manifest!)).json()
  expect(parsed.name).toBe('LinguaForge')
  expect(parsed.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true)

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller) return
    await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
  })

  await context.setOffline(true)
  for (const [path, testId] of [['/', 'today-session'], ['/stats', 'dashboard'], ['/settings', 'voice-settings']] as const) {
    await page.goto(path)
    await expect(page.getByTestId(testId)).toBeVisible()
  }
  await page.goto('/library')
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
  await expect(page.getByTestId('entry').first()).toBeVisible()
  await page.goto('/review')
  await expect(page.getByTestId('review-card')).toBeVisible()
  await context.setOffline(false)
})
