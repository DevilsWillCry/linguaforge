import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { extractArticle } from './extract.js'
import { PageError, fetchPublicPage, isPublicAddress, parsePageUrl, type FetchedPage } from './fetchPage.js'

const LONG = 'The team needed to figure out why the release kept failing every single morning. '.repeat(4)
const HTML = `<!doctype html><html><head><title>A real article</title></head><body>
  <nav><a href="/">Home</a><a href="/about">About us</a></nav>
  <article>
    <h1>A real article</h1>
    <p>${LONG}</p>
    <p>Second paragraph with <b>bold</b> text and a <a href="https://x.example">link</a>. ${LONG}</p>
    <ul><li><p>Item in a list. ${LONG}</p></li></ul>
    <script>window.hacked = true; document.write('INJECTED')</script>
    <p onclick="steal()"><img src="https://evil.example/x.png" onerror="steal()">Text after an image. ${LONG}</p>
  </article>
  <footer>Cookie policy and other noise</footer>
</body></html>`

const page = (body: string, contentType = 'text/html'): FetchedPage => ({
  url: 'https://news.example/post',
  contentType,
  body: Buffer.from(body),
})

const post = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1', '127.8.8.8', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:169.254.169.254',
    'not-an-ip', '',
  ])('treats %s as internal', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('treats %s as public', (address) => {
    expect(isPublicAddress(address)).toBe(true)
  })
})

describe('parsePageUrl', () => {
  const code = (raw: string) => {
    try {
      parsePageUrl(raw)
      return 'ok'
    } catch (error) {
      return (error as PageError).code
    }
  }

  it('accepts ordinary pages', () => {
    expect(code('https://example.com/a?b=1')).toBe('ok')
    expect(code('http://example.com:80/a')).toBe('ok')
  })

  it.each(['file:///etc/passwd', 'ftp://example.com', 'javascript:alert(1)', 'not a url', 'https://user:pass@example.com'])(
    'rejects %s',
    (raw) => {
      expect(code(raw)).toBe('invalid_url')
    },
  )

  it.each([
    'http://localhost/admin',
    'http://foo.localhost/',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data',
    'http://2130706433/',
    'http://0x7f.0.0.1/',
    'https://example.com:8080/',
    'http://example.com:22/',
  ])('blocks %s', (raw) => {
    expect(code(raw)).toBe('blocked_url')
  })
})

describe('fetchPublicPage against a real server on this machine', () => {
  let server: Server
  let port: number

  beforeAll(async () => {
    server = createServer((_request, response) => response.end('secret internal data'))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })
  afterAll(() => new Promise((resolve) => server.close(resolve)))

  it('refuses to reach it directly, by name or by address', async () => {
    await expect(fetchPublicPage(`http://127.0.0.1:${port}/`)).rejects.toMatchObject({ code: 'blocked_url' })
    await expect(fetchPublicPage(`http://localhost:${port}/`)).rejects.toMatchObject({ code: 'blocked_url' })
    await expect(fetchPublicPage('http://localhost/')).rejects.toMatchObject({ code: 'blocked_url' })
  })
})

describe('extractArticle', () => {
  const article = extractArticle(Buffer.from(HTML), 'https://news.example/post', 'text/html')!

  it('keeps the article and drops the page around it', () => {
    const text = article.paragraphs.join(' ')
    expect(article.title).toBe('A real article')
    expect(text).toContain('figure out why the release')
    expect(text).toContain('bold text and a link')
    expect(text).not.toContain('Cookie policy')
    expect(text).not.toContain('About us')
  })

  it('returns only plain text, with no markup or script', () => {
    const output = JSON.stringify(article)
    expect(output).not.toMatch(/<|onerror|steal|INJECTED|evil\.example/)
  })

  it('does not repeat a paragraph nested in a list item', () => {
    expect(article.paragraphs.filter((p) => p.startsWith('Item in a list'))).toHaveLength(1)
  })

  it('reads plain text pages', () => {
    const plain = extractArticle(Buffer.from(`${LONG}\n\n${LONG}`), 'https://news.example/a.txt', 'text/plain')
    expect(plain?.paragraphs).toHaveLength(2)
    expect(plain?.title).toBe('news.example')
  })

  it('finds nothing in a login wall', () => {
    const wall = '<html><body><form><input name="password"><button>Sign in</button></form></body></html>'
    expect(extractArticle(Buffer.from(wall), 'https://news.example/post', 'text/html')).toBeNull()
  })
})

describe('POST /api/reading/extract', () => {
  const app = (fetchPage: (url: string) => Promise<FetchedPage>, env: NodeJS.ProcessEnv = {}) => createApp(env, { fetchPage })

  it('returns the article', async () => {
    const res = await app(async () => page(HTML)).request('/api/reading/extract', post({ url: 'https://news.example/post' }))
    expect(res.status).toBe(200)
    expect((await res.json()).title).toBe('A real article')
  })

  it('needs no AI key', async () => {
    const res = await createApp({}, { fetchPage: async () => page(HTML) }).request('/api/reading/extract', post({ url: 'https://a.example' }))
    expect(res.status).toBe(200)
  })

  it.each([
    ['invalid_url', 400],
    ['blocked_url', 400],
    ['fetch_failed', 502],
    ['not_html', 502],
    ['too_large', 502],
  ] as const)('reports %s', async (code, status) => {
    const res = await app(async () => {
      throw new PageError(code)
    }).request('/api/reading/extract', post({ url: 'https://a.example' }))
    expect(res.status).toBe(status)
    expect(await res.json()).toEqual({ error: code })
  })

  it('reports a page with nothing to read', async () => {
    const res = await app(async () => page('<html><body>Short</body></html>')).request('/api/reading/extract', post({ url: 'https://a.example' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'no_content' })
  })

  it('blocks internal addresses without a stub, using the real fetcher', async () => {
    const res = await createApp({}).request('/api/reading/extract', post({ url: 'http://169.254.169.254/latest/meta-data' }))
    expect(await res.json()).toEqual({ error: 'blocked_url' })
  })

  it('cannot be used by another website', async () => {
    const fetched: string[] = []
    const guarded = app(async (url) => {
      fetched.push(url)
      return page(HTML)
    })
    const res = await guarded.request('/api/reading/extract', post({ url: 'https://a.example' }, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
    expect(fetched).toEqual([])
  })

  it('refuses a hosted server until logins exist', async () => {
    const res = await app(async () => page(HTML), { LF_HOSTED: '1' }).request('/api/reading/extract', post({ url: 'https://a.example' }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/ai/level', () => {
  it('needs an AI service, and limits how much text it sends', async () => {
    const off = await createApp({}).request('/api/ai/level', post({ text: 'Some text' }))
    expect(await off.json()).toEqual({ error: 'not_configured' })
    const long = await createApp({}).request('/api/ai/level', post({ text: 'x'.repeat(3001) }))
    expect(long.status).toBe(400)
  })
})
