import { expect, test } from '@playwright/test'

test('seeds both decks on first run and shows their counts', async ({ page }) => {
  await page.goto('/')
  const cards = page.getByTestId('deck-card')
  await expect(cards).toHaveCount(2)
  await expect(cards.filter({ hasText: 'English' })).toContainText('12')
  await expect(cards.filter({ hasText: 'English' })).toContainText('8')
  await expect(cards.filter({ hasText: 'Vue 3 / Tech' })).toContainText('27')
})

test('navigates with the layout for the current screen size', async ({ page, isMobile }) => {
  await page.goto('/')
  const nav = page.getByTestId(isMobile ? 'tabbar' : 'sidebar')
  await expect(nav).toBeVisible()
  await expect(page.getByTestId(isMobile ? 'sidebar' : 'tabbar')).toBeHidden()

  await nav.getByRole('link', { name: 'Progreso' }).click()
  await expect(page).toHaveURL(/\/stats$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Progreso' })).toBeVisible()
  await expect(page.getByText('Fase 6')).toBeVisible()
})

test('has no horizontal overflow on any page', async ({ page }) => {
  for (const path of ['/', '/library', '/settings', '/video']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test.describe('when the OS asks for light', () => {
  test.use({ colorScheme: 'light' })

  test('follows it', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})

test.describe('when the OS asks for dark', () => {
  test.use({ colorScheme: 'dark' })

  test('remembers a chosen theme and language across reloads', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.getByRole('button', { name: 'Claro' }).click()
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  })
})
