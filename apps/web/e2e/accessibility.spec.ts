import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const summary = violations.map((v) => ({
    rule: v.id,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    detail: v.nodes[0]?.any[0]?.message,
  }))
  expect(summary).toEqual([])
}

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`Library in ${colorScheme} theme`, () => {
    test.use({ colorScheme })

    for (const view of ['Tabla', 'Tarjetas', 'Kanban']) {
      for (const deck of ['English', 'Vue 3 / Tech']) {
        test(`${view} of ${deck} meets WCAG AA`, async ({ page }) => {
          await page.goto('/library')
          await page.getByRole('button', { name: view, exact: true }).click()
          await page.getByRole('button', { name: deck, exact: true }).click()
          await expect(page.getByTestId('entry').first()).toBeVisible()
          await expectNoViolations(page)
        })
      }
    }
  })
}

// Every other page, in both themes and at both sizes, as the final check on each release.
for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`All pages in ${colorScheme} theme`, () => {
    test.use({ colorScheme })
    for (const path of ['/', '/enrich', '/review', '/video', '/tutor', '/reading', '/stats', '/settings']) {
      test(`${path} meets WCAG AA`, async ({ page }) => {
        await page.goto(path)
        await page.getByRole('heading', { level: 1 }).first().waitFor()
        await page.waitForLoadState('networkidle')
        await expectNoViolations(page)
      })
    }
  })
}
