import { expect, test } from '@playwright/test'

/** Dialogs, English and the monospace font load after the page, so nothing may depend on their timing. */
test.describe('things that load after the page', () => {
  test('the command palette opens straight away, before its code has been fetched', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The shortcut needs a keyboard')
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/CommandPalette.vue*', async (route) => {
      await held
      await route.continue()
    })
    await page.goto('/')
    await expect(page.getByTestId('today-session')).toBeVisible()
    await page.keyboard.press('Control+k')
    release()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('Quick Add opens straight away and saves', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Añadir/ }).filter({ visible: true }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').first().fill('straight away')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('toast').first()).toBeVisible()
  })

  test('a page sent by the bookmarklet keeps its text, even though the dialog loads late', async ({ page }) => {
    await page.goto(`/capture?text=${encodeURIComponent('a selected sentence')}&url=${encodeURIComponent('https://example.com/a')}`)
    await expect(page.getByRole('dialog').getByRole('textbox').first()).toHaveValue('a selected sentence')
  })

  test('the entry editor fills in when opened right after the page loads', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByTestId('entry').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox').first()).not.toHaveValue('')
  })

  test('the monospace font arrives once the page has settled', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => [...document.fonts].some((font) => font.family.includes('JetBrains Mono')))).toBe(true)
  })
})

test.describe('language', () => {
  test('switching to English shows English, and never raw keys', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('body')).not.toContainText('settings.')
    await page.getByRole('button', { name: 'Español', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
  })

  test('English survives a reload, with no Spanish first', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    const seen: string[] = []
    await page.exposeFunction('reportHeading', (text: string) => seen.push(text))
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const heading = document.querySelector('h1')?.textContent
        if (heading) (window as unknown as { reportHeading: (text: string) => void }).reportHeading(heading)
      }).observe(document, { childList: true, subtree: true })
    })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    expect(seen).not.toContain('Ajustes')
  })

  test('the app still opens if the English messages cannot load', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await page.route(/locales\/en|\/en-[\w-]+\.js/, (route) => route.abort())
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
