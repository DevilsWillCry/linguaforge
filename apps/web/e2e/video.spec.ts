import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const VIDEO_ID = 'dQw4w9WgXcQ'

const TRANSCRIPT = [
  '0:00', 'Welcome back to the channel everyone',
  '0:05', 'Today we figured out the problem',
  '0:10', 'Sometimes you need to borrow extraordinary ideas',
  '0:15', 'Thanks for watching this',
].join('\n')

/**
 * Stands in for YouTube's player script, so tests don't depend on the network. It keeps the
 * same API, and time only moves when a test moves it or while "playing" at one second a second.
 */
const FAKE_YOUTUBE = `
  window.fakeYt = { time: 0, playing: false, rate: 1, seeks: [], options: null };
  window.YT = {
    PlayerState: { PLAYING: 1 },
    Player: class {
      constructor(element, options) {
        window.fakeYt.options = options;
        window.fakeYt.time = options.playerVars.start || 0;
        element.textContent = 'Fake player'; element.style.color = 'white';
        setInterval(() => { if (window.fakeYt.playing) window.fakeYt.time += 0.1 }, 100);
        setTimeout(() => options.events.onReady(), 0);
      }
      playVideo() { window.fakeYt.playing = true }
      pauseVideo() { window.fakeYt.playing = false }
      seekTo(seconds) { window.fakeYt.time = seconds; window.fakeYt.seeks.push(seconds) }
      getCurrentTime() { return window.fakeYt.time }
      getPlayerState() { return window.fakeYt.playing ? 1 : 2 }
      setPlaybackRate(rate) { window.fakeYt.rate = rate }
      getVideoData() { return { title: 'A test video' } }
      destroy() { window.fakeYt.playing = false }
    },
  };
  window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();
`

interface FakeYt {
  time: number
  playing: boolean
  rate: number
  seeks: number[]
  options: { host?: string; playerVars: Record<string, number> }
}
const fake = (page: Page) => page.evaluate(() => (window as unknown as { fakeYt: FakeYt }).fakeYt)
const setTime = (page: Page, time: number) =>
  page.evaluate((value) => {
    ;(window as unknown as { fakeYt: FakeYt }).fakeYt.time = value
  }, time)

async function openVideo(page: Page, query = `v=${VIDEO_ID}`) {
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_YOUTUBE }),
  )
  await page.goto(`/video?${query}`)
  await expect(page.getByTestId('player')).toContainText('Fake player')
}

async function pasteTranscript(page: Page, text = TRANSCRIPT) {
  await page.getByLabel('O pega la transcripción').fill(text)
  await page.getByRole('button', { name: 'Cargar transcripción' }).click()
  await expect(page.getByTestId('cue').first()).toBeVisible()
}

const cue = (page: Page, text: string) => page.getByTestId('cue').filter({ hasText: text })
const word = (page: Page, line: string, text: string) => cue(page, line).locator('[data-word]').filter({ hasText: new RegExp(`^${text}$`) })
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

/** A real, silent audio file, so the local player is tested with a real media element. */
function silentWav(seconds: number): Buffer {
  const rate = 8000
  const samples = rate * seconds
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + samples, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate, 28)
  header.writeUInt16LE(1, 32)
  header.writeUInt16LE(8, 34)
  header.write('data', 36)
  header.writeUInt32LE(samples, 40)
  return Buffer.concat([header, Buffer.alloc(samples, 128)])
}

test.describe('opening something to watch', () => {
  test('rejects a link that is not YouTube', async ({ page }) => {
    await page.goto('/video')
    await page.getByLabel('Enlace de YouTube').fill('https://example.com/watch?v=abc')
    await page.getByRole('button', { name: 'Abrir', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('no parece un video')
  })

  test('embeds with the official player, captions off, and no cookies host', async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: FAKE_YOUTUBE }),
    )
    await page.goto('/video')
    await page.getByLabel('Enlace de YouTube').fill(`https://youtu.be/${VIDEO_ID}`)
    await page.getByRole('button', { name: 'Abrir', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`v=${VIDEO_ID}`))
    await expect(page.getByTestId('player')).toContainText('Fake player')
    const { options } = await fake(page)
    expect(options.host).toBe('https://www.youtube-nocookie.com')
    expect(options.playerVars.cc_load_policy).toBe(0)
  })

  test('says so when the player cannot load', async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', (route) => route.abort())
    await page.goto(`/video?v=${VIDEO_ID}`)
    await expect(page.getByTestId('player-error')).toContainText('No se pudo cargar')
  })

  test('plays a local file with a real player and keeps its transcript', async ({ page }) => {
    await page.goto('/video')
    const file = { name: 'talk.wav', mimeType: 'audio/wav', buffer: silentWav(30) }
    await page.getByTestId('video-file').setInputFiles(file)
    await expect(page.getByTestId('media')).toBeVisible()
    await pasteTranscript(page)

    await cue(page, 'Thanks for watching').getByRole('button', { name: /^Ir a/ }).click()
    await expect(page.getByTestId('video-time')).toHaveText('0:15')
    await expect(cue(page, 'Thanks for watching')).toHaveAttribute('aria-current', 'true')

    await page.getByRole('button', { name: 'Elegir otro' }).click()
    await page.getByTestId('video-file').setInputFiles(file)
    await expect(page.getByTestId('cue').first()).toBeVisible()
  })
})

test.describe('the transcript', () => {
  test('explains why it is needed, and rejects text with no times', async ({ page }) => {
    await openVideo(page)
    await expect(page.getByTestId('transcript-empty')).toContainText('dueños del video')
    await page.getByLabel('O pega la transcripción').fill('just words')
    await page.getByRole('button', { name: 'Cargar transcripción' }).click()
    await expect(page.getByTestId('toast')).toContainText('No se encontraron')
  })

  test('loads from a file and is still there after a reload', async ({ page }) => {
    await openVideo(page)
    await page.getByLabel('Archivo .srt o .vtt').setInputFiles({
      name: 'subs.srt',
      mimeType: 'text/plain',
      buffer: Buffer.from('1\n00:00:01,000 --> 00:00:03,000\nFrom a file\n'),
    })
    await expect(cue(page, 'From a file')).toBeVisible()
    await page.reload()
    await expect(cue(page, 'From a file')).toBeVisible()
  })

  test('follows playback, and a click on the time seeks', async ({ page }) => {
    await openVideo(page)
    await pasteTranscript(page)
    await setTime(page, 11)
    await expect(cue(page, 'borrow extraordinary')).toHaveAttribute('aria-current', 'true')
    await cue(page, 'Welcome back').getByRole('button', { name: /^Ir a/ }).click()
    await expect(cue(page, 'Welcome back')).toHaveAttribute('aria-current', 'true')
    expect((await fake(page)).seeks).toContain(0)
    expect((await fake(page)).playing).toBe(true)
  })

  test('marks what is in the Library, including inflected phrases', async ({ page }) => {
    await openVideo(page)
    await pasteTranscript(page)
    const figured = cue(page, 'figured out').locator('[data-status]')
    await expect(figured).toHaveText('figured out')
    await expect(cue(page, 'Thanks for watching').locator('[data-status]')).toHaveCount(0)
  })
})

test.describe('capturing', () => {
  test.beforeEach(async ({ page }) => {
    await openVideo(page)
    await pasteTranscript(page)
  })

  test('adds a new word with its sentence and exact moment', async ({ page }) => {
    await word(page, 'borrow extraordinary', 'extraordinary').click()
    const card = page.getByTestId('capture-card')
    await expect(card).toContainText('Sometimes you need')
    expect((await fake(page)).playing).toBe(false)
    await card.getByRole('button', { name: 'Añadir a la biblioteca' }).click()
    await expect(page.getByTestId('toast')).toContainText('«extraordinary» añadida')
    await expect(card).toHaveCount(0)

    const entry = (await storedEntry(page, 'extraordinary'))!
    expect(entry.realExamples).toEqual(['Sometimes you need to borrow extraordinary ideas'])
    expect(entry.ownExamples).toEqual([])
    expect(entry.enrichment).toBe('empty')
    expect(entry.trigger).toBe('Video')
    expect(entry.source).toMatchObject({ videoId: VIDEO_ID, startSec: 10, endSec: 15, title: 'A test video' })
    await expect(word(page, 'borrow extraordinary', 'extraordinary')).toHaveAttribute('data-status', 'New')
  })

  test('lets you correct the form before saving', async ({ page }) => {
    await word(page, 'Thanks for watching', 'watching').click()
    await page.getByTestId('capture-card').getByLabel('Palabra o frase').fill('watch')
    await page.getByTestId('capture-card').getByRole('button', { name: 'Añadir a la biblioteca' }).click()
    await expect(page.getByTestId('toast')).toContainText('«watch» añadida')
    expect(await storedEntry(page, 'watching')).toBeNull()
  })

  test('captures a phrase selected by dragging', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Dragging over text is a desktop gesture')
    await word(page, 'Thanks for watching', 'Thanks').evaluate(() => {
      const paragraph = [...document.querySelectorAll('[data-testid="cue"] p')].find((p) => p.textContent?.startsWith('Thanks'))!
      const range = document.createRange()
      range.setStart(paragraph.querySelector('[data-word="0"]')!, 0)
      range.setEnd(paragraph.querySelector('[data-word="2"]')!, 1)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(range)
      paragraph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await expect(page.getByTestId('capture-card').getByLabel('Palabra o frase')).toHaveValue('Thanks for')
  })

  test('shows what you know about a Library item, and adds the sentence without a duplicate', async ({ page }) => {
    const before = (await storedEntry(page, 'Figure out'))!
    await cue(page, 'figured out').locator('[data-status]').click()
    const card = page.getByTestId('capture-card')
    await expect(card).toContainText('Figure out')
    await expect(card).toContainText('To understand')
    await card.getByRole('button', { name: 'Añadir esta frase' }).click()
    await expect(page.getByTestId('toast')).toContainText('Frase añadida')
    const after = (await storedEntry(page, 'Figure out'))!
    expect(after.realExamples).toEqual([...before.realExamples, 'Today we figured out the problem'])
    expect(after.ownExamples).toEqual(before.ownExamples)
  })

  test('plays the original clip from the saved entry', async ({ page }) => {
    await word(page, 'borrow extraordinary', 'extraordinary').click()
    await page.getByTestId('capture-card').getByRole('button', { name: 'Añadir a la biblioteca' }).click()
    await expect(page.getByTestId('capture-card')).toHaveCount(0)
    await page.getByRole('link', { name: /Biblioteca/ }).first().click()
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir extraordinary' }).click()
    await page.getByTestId('entry-editor').getByTestId('clip-link').click()
    await expect(page).toHaveURL(new RegExp(`v=${VIDEO_ID}.*t=9\\.5.*end=15`))
    await expect(page.getByTestId('player')).toContainText('Fake player')
    expect((await fake(page)).options.playerVars.start).toBe(9)
  })
})

test.describe('learning controls', () => {
  test.beforeEach(async ({ page }) => {
    await openVideo(page)
    await pasteTranscript(page)
  })

  test('changes the speed', async ({ page }) => {
    await page.getByTestId('player-controls').getByLabel('Velocidad').selectOption('0.75')
    expect((await fake(page)).rate).toBe(0.75)
  })

  test('loops between A and B', async ({ page }) => {
    const controls = page.getByTestId('player-controls')
    await setTime(page, 5)
    await expect(page.getByTestId('video-time')).toHaveText('0:05')
    await controls.getByRole('button', { name: /^A/ }).click()
    await setTime(page, 6)
    await expect(page.getByTestId('video-time')).toHaveText('0:06')
    await controls.getByRole('button', { name: /^B/ }).click()
    await controls.getByRole('button', { name: 'Reproducir' }).click()
    await expect.poll(async () => (await fake(page)).seeks.filter((s) => s === 5).length, { timeout: 5000 }).toBeGreaterThan(1)

    await controls.getByRole('button', { name: 'Quitar el bucle' }).click()
    const count = (await fake(page)).seeks.length
    await page.waitForTimeout(1300)
    expect((await fake(page)).seeks.length).toBe(count)
  })

  test('swaps the ends of a loop set backwards', async ({ page }) => {
    const controls = page.getByTestId('player-controls')
    await setTime(page, 9)
    await expect(page.getByTestId('video-time')).toHaveText('0:09')
    await controls.getByRole('button', { name: /^A/ }).click()
    await setTime(page, 3)
    await expect(page.getByTestId('video-time')).toHaveText('0:03')
    await controls.getByRole('button', { name: /^B/ }).click()
    await expect(controls.getByRole('button', { name: /^A/ })).toContainText('0:03')
    await expect(controls.getByRole('button', { name: /^B/ })).toContainText('0:09')
  })

  test('repeats the sentence and stops at its end', async ({ page }) => {
    await setTime(page, 4)
    await expect(page.getByTestId('video-time')).toHaveText('0:04')
    await page.getByTestId('player-controls').getByRole('button', { name: /Repetir frase/ }).click()
    expect((await fake(page)).seeks.at(-1)).toBe(0)
    await setTime(page, 5.1)
    await expect.poll(async () => (await fake(page)).playing).toBe(false)
  })

  test('works from the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones have no keyboard shortcuts')
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.press('Space')
    await expect.poll(async () => (await fake(page)).playing).toBe(true)
    await page.keyboard.press('Space')
    await expect.poll(async () => (await fake(page)).playing).toBe(false)
    await page.keyboard.press('ArrowRight')
    await expect(cue(page, 'figured out')).toHaveAttribute('aria-current', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(cue(page, 'Welcome back')).toHaveAttribute('aria-current', 'true')
  })

  test('does not take keys typed in a text box', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones have no keyboard shortcuts')
    await word(page, 'Thanks for watching', 'watching').click()
    await page.getByTestId('capture-card').getByLabel('Palabra o frase').fill('')
    await page.getByTestId('capture-card').getByLabel('Palabra o frase').pressSequentially('a r b')
    await expect(page.getByTestId('capture-card').getByLabel('Palabra o frase')).toHaveValue('a r b')
    await expect(page.getByTestId('player-controls').getByRole('button', { name: /^A/ })).toHaveAttribute('aria-pressed', 'false')
    expect((await fake(page)).playing).toBe(false)
  })
})

test.describe('practice', () => {
  test.beforeEach(async ({ page }) => {
    await openVideo(page)
    await pasteTranscript(page)
  })

  const switchMode = (page: Page, name: string) =>
    page.getByTestId('player-controls').getByRole('button', { name, exact: true }).click()

  test('dictation hides the text, plays the line and scores with a diff', async ({ page }) => {
    await switchMode(page, 'Dictado')
    const practice = page.getByTestId('practice')
    await expect(page.getByTestId('transcript')).toHaveCount(0)
    await expect(practice).not.toContainText('Welcome')
    expect((await fake(page)).playing).toBe(true)

    await practice.getByLabel('Lo que oíste').fill('welcome back to channel everyone')
    await page.keyboard.press('Enter')
    const result = page.getByTestId('dictation-result')
    await expect(result).toContainText('83%')
    await expect(result.locator('[data-kind="missing"]')).toHaveText('the')
    await expect(page.getByTestId('practice-score')).toContainText('83%')

    await page.keyboard.press('Enter')
    await expect(practice.getByLabel('Lo que oíste')).toHaveValue('')
    await expect(page.getByTestId('dictation-result')).toHaveCount(0)
    expect((await fake(page)).seeks.at(-1)).toBe(5)
  })

  test('cloze hides Library items first, then checks them', async ({ page }) => {
    await cue(page, 'figured out').getByRole('button', { name: /^Ir a/ }).click()
    await switchMode(page, 'Completar')
    const line = page.getByTestId('cloze-line')
    await expect(line).toContainText('Today we')
    await expect(line).not.toContainText('figured')
    await line.getByRole('textbox').fill('figured out')
    await page.keyboard.press('Enter')
    await expect(line.locator('mark')).toHaveAttribute('data-result', 'correct')
    await expect(page.getByTestId('practice-score')).toContainText('100%')
  })

  test('reaches the end of the transcript', async ({ page }) => {
    await cue(page, 'Thanks for watching').getByRole('button', { name: /^Ir a/ }).click()
    await switchMode(page, 'Dictado')
    await page.getByTestId('practice').getByRole('button', { name: 'Comprobar' }).click()
    await page.getByTestId('practice').getByRole('button', { name: 'Siguiente frase' }).click()
    await expect(page.getByTestId('practice-finished')).toBeVisible()
  })

  test('brings the transcript back in Watch mode', async ({ page }) => {
    await switchMode(page, 'Dictado')
    await switchMode(page, 'Ver')
    await expect(page.getByTestId('transcript')).toBeVisible()
  })
})

test.describe('videos from the Source column', () => {
  const item = (page: Page, text: string) => page.getByTestId('library-source').filter({ hasText: text })
  const TITLE = 'Phrasal Verb - to figure out'

  test('lists the sources with a YouTube search for each', async ({ page }) => {
    await page.goto('/video')
    await expect(page.getByTestId('library-source')).toHaveCount(4)
    const search = item(page, TITLE).getByRole('link', { name: 'Buscar en YouTube' })
    await expect(search).toHaveAttribute('href', 'https://www.youtube.com/results?search_query=Phrasal%20Verb%20-%20to%20figure%20out')
    await expect(search).toHaveAttribute('target', '_blank')
    await expect(search).toHaveAttribute('rel', /noopener/)
  })

  test('rejects text that is not a link, and changes nothing', async ({ page }) => {
    await page.goto('/video')
    await item(page, TITLE).getByLabel('Enlace del video').fill('just some words')
    await item(page, TITLE).getByRole('button', { name: 'Guardar enlace' }).click()
    await expect(item(page, TITLE).getByRole('alert')).toContainText('enlace completo')
    expect((await storedEntry(page, 'Figure out'))!.source.url).toBeUndefined()
  })

  test('saves the link once, keeps the title, and opens the video from everywhere', async ({ page, isMobile }) => {
    await page.route('https://www.youtube.com/iframe_api', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: FAKE_YOUTUBE }),
    )
    await page.goto('/video')
    await item(page, TITLE).getByLabel('Enlace del video').fill(`https://youtu.be/${VIDEO_ID}`)
    await item(page, TITLE).getByRole('button', { name: 'Guardar enlace' }).click()
    await expect(page.getByTestId('toast')).toContainText('Enlace guardado')

    const { source } = (await storedEntry(page, 'Figure out'))!
    expect(source).toEqual({ title: TITLE, url: `https://www.youtube.com/watch?v=${VIDEO_ID}`, videoId: VIDEO_ID })
    await expect(item(page, TITLE)).toContainText('Sin transcripción')

    if (!isMobile) {
      await page.goto('/library')
      await page.getByRole('button', { name: 'Tabla', exact: true }).click()
      await expect(page.getByRole('link', { name: 'Abrir en el Video Lab: Figure out' })).toBeVisible()
    }
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tarjetas', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir Figure out' }).click()
    await page.getByTestId('entry-editor').getByRole('link', { name: 'Abrir en el Video Lab' }).click()
    await expect(page).toHaveURL(new RegExp(`/video\\?v=${VIDEO_ID}$`))
    await expect(page.getByTestId('player')).toContainText('Fake player')

    await pasteTranscript(page)
    await page.getByRole('button', { name: 'Elegir otro' }).click()
    await expect(item(page, TITLE)).toContainText('Con transcripción')
  })

  test('clicking the table shortcut opens the video, not the cell editor', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The table is covered on desktop')
    await page.route('https://www.youtube.com/iframe_api', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: FAKE_YOUTUBE }),
    )
    await page.goto('/video')
    await item(page, TITLE).getByLabel('Enlace del video').fill(`https://youtu.be/${VIDEO_ID}`)
    await item(page, TITLE).getByRole('button', { name: 'Guardar enlace' }).click()
    await expect(item(page, TITLE)).toContainText('Sin transcripción')
    await page.goto('/library')
    await page.getByRole('button', { name: 'Tabla', exact: true }).click()
    const shortcut = page.getByRole('link', { name: 'Abrir en el Video Lab: Figure out' })
    await shortcut.scrollIntoViewIfNeeded()
    await shortcut.click()
    await expect(page.getByTestId('player')).toContainText('Fake player')
  })
})

test.describe('history', () => {
  test('resumes where you left off, and lists the video with its title', async ({ page }) => {
    await openVideo(page)
    await setTime(page, 42)
    await expect(page.getByTestId('video-time')).toHaveText('0:42')
    await page.getByRole('button', { name: 'Elegir otro' }).click()
    await expect(page.getByTestId('video-history')).toContainText('A test video')
    await expect(page.getByTestId('video-history')).toContainText('En 0:42')
    await page.getByTestId('video-history').getByRole('link', { name: 'A test video' }).click()
    await expect(page.getByTestId('player')).toContainText('Fake player')
    expect((await fake(page)).options.playerVars.start).toBe(42)
  })
})

test('fits a phone screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only about phones')
  await openVideo(page)
  await pasteTranscript(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`accessibility in ${colorScheme} theme`, () => {
    test.use({ colorScheme })
    async function expectNoViolations(page: Page) {
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(violations.map((v) => ({ rule: v.id, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))).toEqual([])
    }

    test('the start page meets WCAG AA', async ({ page }) => {
      await page.goto('/video')
      await expect(page.getByTestId('video-open')).toBeVisible()
      await expectNoViolations(page)
    })

    test('the transcript and capture meet WCAG AA', async ({ page }) => {
      await openVideo(page)
      await expectNoViolations(page)
      await pasteTranscript(page)
      await word(page, 'borrow extraordinary', 'extraordinary').click()
      await expect(page.getByTestId('capture-card')).toBeVisible()
      await expectNoViolations(page)
    })

    test('dictation results meet WCAG AA', async ({ page }) => {
      await openVideo(page)
      await pasteTranscript(page)
      await page.getByTestId('player-controls').getByRole('button', { name: 'Dictado', exact: true }).click()
      await page.getByTestId('practice').getByLabel('Lo que oíste').fill('welcome wrong back')
      await page.getByTestId('practice').getByRole('button', { name: 'Comprobar' }).click()
      await expect(page.getByTestId('dictation-result')).toBeVisible()
      await expectNoViolations(page)
    })
  })
}
