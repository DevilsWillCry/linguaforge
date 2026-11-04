import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const entries = (page: Page) => page.getByTestId('entry')
const entry = (page: Page, text: string) => entries(page).filter({ hasText: text })

/** Finds a column by its heading, because every card's status menu lists all statuses. */
const kanbanColumn = (page: Page) => (status: string) =>
  page.getByTestId('kanban-column').filter({ has: page.getByRole('heading', { name: status }) })

async function openLibrary(page: Page, view: 'Tabla' | 'Tarjetas' | 'Kanban' = 'Tarjetas') {
  await page.goto('/library')
  await page.getByRole('button', { name: view, exact: true }).click()
  await expect(entries(page).first()).toBeVisible()
}

async function quickAdd(page: Page, text: string) {
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByTestId('palette-input').pressSequentially('+')
  const input = page.getByTestId('quick-add').getByRole('textbox')
  await input.fill(text)
  await input.press('Enter')
}

test.describe('Quick Add', () => {
  test('adds a word with the keyboard, and it joins the queue and survives a reload', async ({ page }) => {
    await openLibrary(page)
    await quickAdd(page, 'Nevertheless')

    await expect(entry(page, 'Nevertheless')).toContainText('Por completar')
    await expect(entry(page, 'Nevertheless')).toContainText('Word')
    await expect(page.getByTestId('entry-count')).toContainText('13 de 13')

    await page.reload()
    await expect(entry(page, 'Nevertheless')).toBeVisible()
  })

  test('refuses an exact duplicate, ignoring case and punctuation', async ({ page }) => {
    await openLibrary(page)
    await quickAdd(page, 'by the way')
    await expect(page.getByTestId('toast')).toContainText('ya está en la biblioteca')
    await expect(page.getByTestId('entry-count')).toContainText('12 de 12')
  })

  test('suggests near-duplicates while typing', async ({ page }) => {
    await openLibrary(page)
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByTestId('palette-input').pressSequentially('+')
    await page.getByTestId('quick-add').getByRole('textbox').fill('figured out')
    await expect(page.getByTestId('quick-add-similar')).toContainText('Figure out')
  })

  test('carries over text typed after the plus sign', async ({ page }) => {
    await openLibrary(page)
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByTestId('palette-input').fill('+hello')
    await expect(page.getByTestId('quick-add').getByRole('textbox')).toHaveValue('hello')
  })

  test('opens from the floating button on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The floating button is mobile only')
    await openLibrary(page)
    await page.getByTestId('quick-add-fab').click()
    const input = page.getByTestId('quick-add').getByRole('textbox')
    await input.fill('Meanwhile')
    await page.getByTestId('quick-add').getByRole('button', { name: 'Guardar' }).click()
    await expect(entry(page, 'Meanwhile')).toBeVisible()
  })
})

test.describe('capture link', () => {
  test('pre-fills Quick Add and saves nothing until confirmed', async ({ page }) => {
    const params = new URLSearchParams({
      text: 'a captured phrase',
      url: 'https://example.com/post',
      title: 'A blog post',
    })
    await page.goto(`/capture?${params}`)
    const form = page.getByTestId('quick-add')
    await expect(form.getByRole('textbox')).toHaveValue('a captured phrase')
    await expect(form).toContainText('A blog post')

    // Closing without saving adds nothing.
    await page.keyboard.press('Escape')
    await page.goto('/library')
    await expect(page.getByTestId('entry-count')).toContainText('12 de 12')

    await page.goto(`/capture?${params}`)
    await page.getByTestId('quick-add').getByRole('textbox').press('Enter')
    await expect(page).toHaveURL(/\/library$/)
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await expect(entry(page, 'a captured phrase')).toBeVisible()
  })

  test('ignores a javascript: URL', async ({ page }) => {
    await page.goto(`/capture?${new URLSearchParams({ text: 'x', url: 'javascript:alert(1)' })}`)
    const input = page.getByTestId('quick-add').getByRole('textbox')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await entry(page, 'x').first().getByRole('button').click()
    await expect(page.getByTestId('entry-editor').getByRole('link')).toHaveCount(0)
  })
})

test.describe('table view', () => {
  test.skip(({ isMobile }) => isMobile, 'Editing cells is covered on desktop')

  test('edits a cell inline and keeps the change after a reload', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const row = entry(page, 'Figure out')
    await row.getByRole('button', { name: 'Editar Tono de Figure out' }).click()
    await row.getByRole('combobox').selectOption('Formal')
    await expect(row).toContainText('Formal')

    await page.reload()
    await expect(entry(page, 'Figure out')).toContainText('Formal')
  })

  test('shows priority as labelled bars, and edits it as a number', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const row = entry(page, 'Figure out')
    await expect(row.getByRole('img', { name: 'Prioridad 4 de 5' })).toBeVisible()
    await expect(entry(page, 'Borrow').first().getByRole('img', { name: 'Sin prioridad' })).toBeVisible()

    await row.getByRole('button', { name: 'Editar Prioridad de Figure out' }).click()
    await row.getByRole('combobox').selectOption('2')
    await expect(row.getByRole('img', { name: 'Prioridad 2 de 5' })).toBeVisible()
  })

  test('shows the first list items and counts the rest', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const meanings = page.getByRole('button', { name: 'Editar Significado de Figure out' })
    await expect(meanings).toContainText('To understand.')
    await expect(meanings).not.toContainText('→')
    await expect(meanings).toContainText('+1 más')
  })

  test('styles code columns as code, and descriptions as ordinary text', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    await page.getByRole('button', { name: 'Vue 3 / Tech' }).click()
    await expect(page.getByRole('button', { name: 'Editar Sintaxis de ref()' }).locator('code')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Editar Qué hace de ref()' }).locator('code')).toHaveCount(0)
  })

  test('screen readers hear the value of a cell as well as its action', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    await expect(
      page.getByRole('button', { name: 'Editar Tono de Figure out: Casual' }),
    ).toBeVisible()
  })

  test('cancels an edit with Escape', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const row = entry(page, 'Figure out')
    await row.getByRole('button', { name: 'Editar Origen de Figure out' }).click()
    const input = row.getByRole('textbox')
    await input.fill('changed')
    await input.press('Escape')
    await expect(row).not.toContainText('changed')
    await expect(row).toContainText('IA Tool')
  })

  test('rejects blank text', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const row = entry(page, 'Figure out')
    await row.getByRole('button', { name: 'Editar Palabra o frase de Figure out' }).click()
    const input = row.getByRole('textbox')
    await input.fill('   ')
    await input.press('Enter')
    await expect(page.getByTestId('toast')).toContainText('necesita un texto')
    await expect(entry(page, 'Figure out')).toBeVisible()
  })

  test('prompts for an own example when there is none', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tabla', exact: true }).click()
    // "Borrow" also appears in an example of "By the way...", so name the exact cell.
    await expect(page.getByRole('button', { name: 'Editar Tus ejemplos de Borrow' })).toContainText(
      'Escribe tu propia frase',
    )
  })

  test('sorts by one column, then several with shift+click', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const header = (name: string) => page.getByRole('columnheader', { name })
    await expect(header('Prioridad')).toHaveAttribute('aria-sort', 'descending')

    await header('Tono').getByRole('button').click()
    await expect(header('Tono')).toHaveAttribute('aria-sort', 'ascending')
    await expect(header('Prioridad')).toHaveAttribute('aria-sort', 'none')
    await expect(entries(page).first()).toContainText('Figure out')

    await header('Prioridad').getByRole('button').click({ modifiers: ['Shift'] })
    await expect(header('Tono')).toHaveAttribute('aria-sort', 'ascending')
    await expect(header('Prioridad')).toHaveAttribute('aria-sort', 'ascending')
  })

  test('hides a column and remembers it', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    await expect(page.getByRole('columnheader', { name: 'Tono' })).toBeVisible()
    await page.getByRole('button', { name: 'Columnas', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Tono' }).uncheck()
    await expect(page.getByRole('columnheader', { name: 'Tono' })).toHaveCount(0)

    await page.reload()
    await expect(entries(page).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Tono' })).toHaveCount(0)
  })

  test('resizes a column by dragging and with the keyboard', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    // "Tipo" is well inside the visible part of the scrolling table.
    const header = page.getByRole('columnheader', { name: 'Tipo' })
    const handle = header.getByTestId('column-resize')
    const before = (await header.boundingBox())!.width

    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 80, box.y + box.height / 2)
    await page.mouse.up()
    const dragged = (await header.boundingBox())!.width
    expect(dragged).toBeGreaterThan(before + 50)

    await handle.focus()
    await page.keyboard.press('ArrowRight')
    expect((await header.boundingBox())!.width).toBeGreaterThan(dragged)
  })
})

test.describe('moving around a wide table', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones scroll by touch')

  const scroller = (page: Page) => page.getByTestId('table-scroller')
  const scrollLeft = (page: Page) => scroller(page).evaluate((el) => Math.round(el.scrollLeft))
  const leftButton = (page: Page) => page.getByRole('button', { name: 'Ver columnas anteriores' })
  const rightButton = (page: Page) => page.getByRole('button', { name: 'Ver más columnas' })

  /** Drags from the middle of a cell, using real mouse steps. */
  async function dragCell(page: Page, name: string, distance: number) {
    const box = (await page.getByRole('button', { name }).boundingBox())!
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + box.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + distance, y, { steps: 8 })
    await page.mouse.up()
  }

  test('dragging scrolls sideways without opening the cell', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    expect(await scrollLeft(page)).toBe(0)

    await dragCell(page, 'Editar Significado de Figure out', -250)

    expect(await scrollLeft(page)).toBeGreaterThanOrEqual(240)
    await expect(entry(page, 'Figure out').getByRole('textbox')).toHaveCount(0)
  })

  test('dragging back scrolls the other way', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    await dragCell(page, 'Editar Significado de Figure out', -300)
    const moved = await scrollLeft(page)
    await dragCell(page, 'Editar Tipo de Figure out', 100)
    expect(await scrollLeft(page)).toBeLessThan(moved)
  })

  test('a click after a drag still edits, so the drag leaves nothing behind', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    await dragCell(page, 'Editar Significado de Figure out', -250)
    await page.getByRole('button', { name: 'Editar Tipo de Figure out' }).click()
    await expect(entry(page, 'Figure out').getByRole('combobox')).toBeVisible()
  })

  test('a slightly shaky click still counts as a click', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const before = await scrollLeft(page)
    await dragCell(page, 'Editar Tipo de Figure out', 3)
    await expect(entry(page, 'Figure out').getByRole('combobox')).toBeVisible()
    expect(await scrollLeft(page)).toBe(before)
  })

  test('dragging a column edge resizes it instead of scrolling', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const box = (await page.getByRole('columnheader', { name: 'Tipo' }).getByTestId('column-resize').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 5 })
    await page.mouse.up()
    expect(await scrollLeft(page)).toBe(0)
  })

  test('arrow buttons move a page at a time and stop at each end', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    await expect(leftButton(page)).toBeDisabled()
    await expect(rightButton(page)).toBeEnabled()

    await rightButton(page).click()
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(200)
    await expect(leftButton(page)).toBeEnabled()

    // Reaching the far end disables the button.
    await scroller(page).evaluate((el) => el.scrollTo({ left: el.scrollWidth }))
    await expect(rightButton(page)).toBeDisabled()
    await expect(page.getByTestId('table-fade')).toBeHidden()

    await leftButton(page).click()
    await expect(rightButton(page)).toBeEnabled()
    await expect(page.getByTestId('table-fade')).toBeVisible()
  })

  test('keeps the word in view and on top while scrolling', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const word = page.getByRole('button', { name: 'Editar Palabra o frase de Figure out' })
    const before = (await word.boundingBox())!

    await scroller(page).evaluate((el) => el.scrollTo({ left: 600 }))
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(500)
    const after = (await word.boundingBox())!
    expect(after.x).toBe(before.x)

    // Other columns pass underneath it, so a real click must land on the word.
    await word.click()
    await expect(entry(page, 'Figure out').getByRole('textbox').first()).toHaveValue('Figure out')
  })

  test('puts the word first without changing the export order', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    await expect(page.getByRole('columnheader').first()).toContainText('Palabra o frase')
    await page.getByRole('button', { name: 'Exportar' }).click()
    const pending = page.waitForEvent('download')
    await page.getByTestId('export-csv').click()
    const content = readFileSync(await (await pending).path(), 'utf8')
    expect(content).toContain('Priority,Use,Setence/Word,')
  })

  test('uses the full width for the Library, and keeps other pages narrow', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 900 })
    await openLibrary(page, 'Tabla')
    expect((await scroller(page).boundingBox())!.width).toBeGreaterThan(1400)

    await page.goto('/settings')
    const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!
    expect(heading.x).toBeGreaterThan(400)
  })

  test('hides the controls when every column fits', async ({ page }) => {
    // Wide enough for the columns left after hiding, which total about 1076px.
    await page.setViewportSize({ width: 1600, height: 900 })
    await openLibrary(page, 'Tabla')
    await expect(rightButton(page)).toBeVisible()
    await page.getByRole('button', { name: 'Columnas', exact: true }).click()
    for (const name of ['Ejemplos reales', 'Tus ejemplos', 'Variaciones', 'Colocaciones', 'Origen', 'Fuente', 'Contexto', 'Tono']) {
      await page.getByRole('checkbox', { name }).uncheck()
    }
    await page.keyboard.press('Escape')
    await expect(rightButton(page)).toBeHidden()
    await expect(page.getByText('Arrastra la tabla')).toHaveCount(0)
  })
})

test.describe('table on phones', () => {
  test.skip(({ isMobile }) => !isMobile, 'Only phones leave the word unpinned')

  test('does not pin the word, which would fill the small screen', async ({ page }) => {
    await openLibrary(page, 'Tabla')
    const position = await page.locator('[data-pinned]').first().evaluate((el) => getComputedStyle(el).position)
    expect(position).toBe('static')
  })
})

test.describe('filters and search', () => {
  test('searches inside examples and shows when nothing matches', async ({ page }) => {
    await openLibrary(page)
    const search = page.getByRole('searchbox')
    await search.fill('firewall')
    await expect(entries(page)).toHaveCount(1)
    await expect(entries(page).first()).toContainText('By the way')
    await expect(page.getByTestId('entry-count')).toContainText('1 de 12')

    await search.fill('zzzz')
    await expect(page.getByText('Ninguna entrada coincide')).toBeVisible()

    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(entries(page)).toHaveCount(12)
  })

  test('filters by a facet and by due today', async ({ page }) => {
    await openLibrary(page)
    await page.getByRole('button', { name: 'Tipo' }).click()
    await page.getByRole('checkbox', { name: 'Connector' }).check()
    await page.keyboard.press('Escape')
    await expect(entries(page)).toHaveCount(1)

    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await page.getByRole('button', { name: 'Para hoy' }).click()
    await expect(entries(page)).toHaveCount(4)
  })

  test('saves filters and applies them after a reload', async ({ page }) => {
    await openLibrary(page)
    await page.getByRole('searchbox').fill('firewall')
    await page.getByRole('button', { name: 'Filtros guardados' }).click()
    await page.getByRole('textbox', { name: 'Nombre para estos filtros' }).fill('Tech talk')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByTestId('toast')).toContainText('Filtros guardados')

    await page.reload()
    await expect(entries(page)).toHaveCount(12)
    await page.getByRole('button', { name: 'Filtros guardados' }).click()
    await page.getByRole('button', { name: 'Tech talk', exact: true }).click()
    await expect(entries(page)).toHaveCount(1)
  })
})

test.describe('views and editing', () => {
  test('switches deck and shows importance as a separate label', async ({ page }) => {
    await openLibrary(page)
    await page.getByRole('button', { name: 'Vue 3 / Tech' }).click()
    await expect(entries(page)).toHaveCount(27)
    const props = entry(page, 'Props')
    await expect(props).toContainText('Important')
    await expect(props).toContainText('New')
  })

  test('moves a card between Kanban columns with its menu', async ({ page }) => {
    await openLibrary(page, 'Kanban')
    const column = kanbanColumn(page)
    await expect(column('Familiar')).toContainText('By the way')

    await page.getByRole('combobox', { name: 'Mover Figure out a otro estado' }).selectOption('Natural')
    await expect(column('Natural')).toContainText('Figure out')
    await page.reload()
    await expect(column('Natural')).toContainText('Figure out')
  })

  test('moves a card between Kanban columns by dragging', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones use the menu instead')
    await openLibrary(page, 'Kanban')
    const column = kanbanColumn(page)
    await expect(column('Familiar')).not.toContainText('Figure out')

    // Real mouse steps, because dragTo() scrolls the page in the middle of a drag.
    const from = (await entry(page, 'Figure out').boundingBox())!
    const to = (await column('Familiar').getByRole('heading').boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + 24)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 })
    await page.mouse.up()

    await expect(column('Familiar')).toContainText('Figure out')
    await expect(column('New')).not.toContainText('Figure out')
  })

  test('edits every field in the full editor, and own examples stay manual', async ({ page }) => {
    await openLibrary(page)
    await entry(page, 'Borrow').getByRole('button').click()
    const editor = page.getByTestId('entry-editor')
    await expect(editor).toContainText('La IA nunca rellena este campo')
    await editor.getByLabel('Significado').fill('→ to take for a while\n→ to use temporarily')
    await editor.getByLabel('Etiquetas').fill('work, money')
    await editor.getByRole('button', { name: 'Guardar' }).click()

    // Typing a meaning completes the entry, so it leaves the queue.
    await expect(entry(page, 'Borrow')).toContainText('to take for a while')
    await expect(entry(page, 'Borrow')).not.toContainText('Por completar')
    await expect(page.getByRole('button', { name: 'Etiquetas' })).toBeVisible()
  })

  test('discards editor changes on cancel', async ({ page }) => {
    await openLibrary(page)
    await entry(page, 'Borrow').getByRole('button').click()
    const editor = page.getByTestId('entry-editor')
    await editor.getByLabel('Significado').fill('→ should not save')
    await editor.getByRole('button', { name: 'Cancelar' }).click()
    await expect(entry(page, 'Borrow')).not.toContainText('should not save')
  })

  test('deletes an entry and brings it back with undo', async ({ page }) => {
    await openLibrary(page)
    await entry(page, 'Borrow').getByRole('button').click()
    await page.getByTestId('entry-editor').getByRole('button', { name: 'Eliminar' }).click()
    await expect(entry(page, 'Borrow')).toHaveCount(0)
    await page.getByTestId('toast').getByRole('button', { name: 'Deshacer' }).click()
    await expect(entry(page, 'Borrow')).toBeVisible()
  })
})

test.describe('duplicates', () => {
  test('merges a near-duplicate and keeps the other text as a variation', async ({ page }) => {
    await openLibrary(page)
    await quickAdd(page, 'figured out')
    await page.getByRole('button', { name: 'Duplicados (1)' }).click()

    const pair = page.getByTestId('duplicate-pair')
    await pair.getByRole('button', { name: 'Conservar «Figure out»' }).click()
    await expect(page.getByTestId('toast').first()).toBeVisible()
    await expect(pair).toHaveCount(0)
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('entry-count')).toContainText('12 de 12')
    await entry(page, 'Figure out').getByRole('button').click()
    await expect(page.getByTestId('entry-editor').getByLabel('Variaciones')).toHaveValue(/figured out/)
  })

  test('remembers when a pair is not a duplicate', async ({ page }) => {
    await openLibrary(page)
    await quickAdd(page, 'figured out')
    await page.getByRole('button', { name: 'Duplicados (1)' }).click()
    await page.getByRole('button', { name: 'No son duplicados' }).click()
    await expect(page.getByTestId('duplicate-pair')).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Duplicados', exact: true })).toBeVisible()
  })
})

test.describe('import', () => {
  const csv = (content: string) => ({ name: 'words.csv', mimeType: 'text/csv', buffer: Buffer.from(content) })

  async function openImport(page: Page) {
    await openLibrary(page)
    await page.getByRole('button', { name: 'Importar' }).click()
    return page.getByTestId('import-dialog')
  }

  test('previews before saving, then imports only new entries', async ({ page }) => {
    const dialog = await openImport(page)
    await page.getByTestId('import-file').setInputFiles(
      csv('Setence/Word,Meaning/Idea,Mystery\nNonetheless,"→ however\n→ even so",x\nFigure out,→ changed,x\n,,\n'),
    )
    const summary = page.getByTestId('import-summary')
    await expect(summary).toContainText('Nuevas: 1')
    await expect(summary).toContainText('Ya existen: 1')
    await expect(dialog).toContainText('Mystery')
    await expect(dialog).toContainText('Nonetheless')

    // Nothing is saved yet.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('entry-count')).toContainText('12 de 12')

    await page.getByRole('button', { name: 'Importar' }).click()
    await page.getByTestId('import-file').setInputFiles(
      csv('Setence/Word,Meaning/Idea\nNonetheless,"→ however\n→ even so"\nFigure out,→ changed\n'),
    )
    await dialog.getByRole('button', { name: 'Importar' }).click()
    await expect(page.getByTestId('entry-count')).toContainText('13 de 13')
    await expect(entry(page, 'Nonetheless')).toContainText('however')
    await expect(entry(page, 'Figure out')).not.toContainText('changed')
  })

  test('updates existing entries when asked, keeping what the file leaves blank', async ({ page }) => {
    const dialog = await openImport(page)
    await page.getByTestId('import-file').setInputFiles(csv('Setence/Word,Emotional Tone,Context\nFigure out,Formal,\n'))
    await dialog.getByRole('radio', { name: 'Actualizarla con el archivo' }).check()
    await dialog.getByRole('button', { name: 'Importar' }).click()
    await expect(page.getByTestId('toast').first()).toContainText('1 actualizadas')

    await entry(page, 'Figure out').getByRole('button').click()
    const editor = page.getByTestId('entry-editor')
    await expect(editor.getByLabel('Tono')).toHaveValue('Formal')
    await expect(editor.getByLabel('Contexto')).toHaveValue('Daily Conversation')
  })

  test('lets the user map headers by hand', async ({ page }) => {
    const dialog = await openImport(page)
    await page.getByTestId('import-file').setInputFiles(csv('Palabra,Nota\nWhereas,mientras\n'))
    await expect(dialog).toContainText('Elige la columna que contiene')
    await expect(dialog.getByRole('button', { name: 'Importar' })).toHaveCount(1)
    await expect(dialog.getByRole('button', { name: 'Importar' })).toBeDisabled()

    await dialog.getByLabel('Palabra o frase').selectOption('Palabra')
    await expect(page.getByTestId('import-summary')).toContainText('Nuevas: 1')
  })

  test('shows an error for an unreadable file', async ({ page }) => {
    await openImport(page)
    await page.getByTestId('import-file').setInputFiles({
      name: 'bad.xlsx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('PK\u0003\u0004this is not a real workbook'),
    })
    await expect(page.getByRole('alert')).toBeVisible()
  })
})

test.describe('export', () => {
  async function download(page: Page, id: string) {
    await page.getByRole('button', { name: 'Exportar' }).click()
    const pending = page.waitForEvent('download')
    await page.getByTestId(`export-${id}`).click()
    const file = await pending
    await page.keyboard.press('Escape')
    return { name: file.suggestedFilename(), path: await file.path() }
  }

  test('exports a CSV with the exact sheet columns, which imports back unchanged', async ({ page }) => {
    await openLibrary(page)
    const { name, path } = await download(page, 'csv')
    expect(name).toMatch(/^linguaforge-english-\d{4}-\d{2}-\d{2}\.csv$/)

    const content = readFileSync(path, 'utf8')
    expect(content.startsWith('﻿')).toBe(true)
    expect(content).toContain(
      'Priority,Use,Setence/Word,Meaning/Idea,Emotional Tone,Context,Real Context,Own Example,Variations / Related Expressions,Collocations (Important),Review Status,Trigger,Source URL',
    )

    await page.getByRole('button', { name: 'Importar' }).click()
    await page.getByTestId('import-file').setInputFiles(path)
    await expect(page.getByTestId('import-summary')).toContainText('Nuevas: 0')
    await expect(page.getByTestId('import-summary')).toContainText('Ya existen: 12')
  })

  test('exports an XLSX that imports back into its own deck', async ({ page }) => {
    await openLibrary(page)
    await page.getByRole('button', { name: 'Vue 3 / Tech' }).click()
    await expect(entries(page)).toHaveCount(27)
    const { path } = await download(page, 'xlsx')

    await page.getByRole('button', { name: 'English' }).click()
    await page.getByRole('button', { name: 'Importar' }).click()
    await page.getByTestId('import-file').setInputFiles({
      name: 'vue.xlsx',
      mimeType: 'application/octet-stream',
      buffer: readFileSync(path),
    })
    await expect(page.getByTestId('import-summary')).toContainText('Ya existen: 27')
  })

  test('exports an Anki file without entries still to complete', async ({ page }) => {
    await openLibrary(page)
    const { path } = await download(page, 'anki')
    const content = readFileSync(path, 'utf8')
    expect(content).toContain('#deck:LinguaForge::English')
    expect(content).toContain('Figure out')
    expect(content).not.toContain('Borrow')
  })
})

test.describe('settings', () => {
  test('renames a dropdown option and updates entries using it', async ({ page }) => {
    await page.goto('/settings')
    const editor = page.getByTestId('dropdown-editor')
    await editor.getByText('Tono').click()
    const casual = editor.locator('input').and(page.locator('[value="Casual"]'))
    await casual.fill('Relaxed')
    await casual.blur()
    await expect(editor.locator('[value="Relaxed"]')).toBeVisible()

    await openLibrary(page)
    await entry(page, 'Figure out').getByRole('button').click()
    await expect(page.getByTestId('entry-editor').getByLabel('Tono')).toHaveValue('Relaxed')
  })

  test('adds an option that entries can then use', async ({ page }) => {
    await page.goto('/settings')
    const editor = page.getByTestId('dropdown-editor')
    await editor.getByText('Contexto').click()
    await editor.getByRole('textbox', { name: 'Nueva opción de Contexto' }).fill('Podcasts')
    await editor.getByRole('button', { name: 'Añadir' }).click()
    await expect(editor.locator('[value="Podcasts"]')).toBeVisible()

    await openLibrary(page)
    await entry(page, 'Figure out').getByRole('button').click()
    await page.getByTestId('entry-editor').getByLabel('Contexto').selectOption('Podcasts')
  })

  test('refuses a repeated option and locks the core statuses', async ({ page }) => {
    await page.goto('/settings')
    const editor = page.getByTestId('dropdown-editor')
    await editor.getByText('Estado').click()
    await expect(editor.locator('[value="Learning"]')).toHaveAttribute('readonly', '')
    await expect(editor.getByRole('button', { name: 'Eliminar Learning' })).toHaveCount(0)

    await editor.getByRole('textbox', { name: 'Nueva opción de Estado' }).fill('learning')
    await editor.getByRole('button', { name: 'Añadir' }).click()
    await expect(page.getByTestId('toast')).toContainText('ya existe')
  })

  test('offers a bookmarklet that points at this app', async ({ page, baseURL }) => {
    await page.goto('/settings')
    const href = await page.getByTestId('bookmarklet').getAttribute('href')
    expect(href).toMatch(/^javascript:/)
    expect(href).toContain(`${baseURL}/capture`)
  })

  test('restores a backup after confirming, replacing current data', async ({ page }) => {
    await page.goto('/settings')
    const pending = page.waitForEvent('download')
    await page.getByTestId('backup-export').click()
    const path = await (await pending).path()

    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await quickAdd(page, 'Added after backup')
    await expect(page.getByTestId('entry-count')).toContainText('13 de 13')

    await page.goto('/settings')
    await page.getByTestId('backup-file').setInputFiles(path)
    await page.getByRole('button', { name: 'Reemplazar mis datos' }).click()
    await expect(page.getByTestId('toast')).toContainText('Copia restaurada')

    await page.goto('/library')
    await expect(page.getByTestId('entry-count')).toContainText('12 de 12')
    await expect(entry(page, 'Added after backup')).toHaveCount(0)
  })

  test('rejects a file that is not a backup, without touching data', async ({ page }) => {
    await page.goto('/settings')
    await page.getByTestId('backup-file').setInputFiles({
      name: 'nope.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}'),
    })
    await expect(page.getByTestId('toast')).toContainText('no es una copia')
    await page.goto('/library')
    await expect(page.getByTestId('entry-count')).toContainText('12 de 12')
  })

  test('deletes everything only after typing the word, and the seed stays gone', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Borrar todo' }).click()
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Borrar todo' })
    await expect(confirm).toBeDisabled()
    await page.getByTestId('delete-confirm-input').fill('BORRAR')
    await confirm.click()
    await expect(page.getByTestId('toast')).toContainText('se han borrado')

    await page.goto('/library')
    await expect(page.getByText('Este mazo está vacío')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Este mazo está vacío')).toBeVisible()
  })
})
