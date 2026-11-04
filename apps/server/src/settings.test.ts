import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { LOCAL_USER_ID } from './auth.js'
import { cleanBaseUrl, createFileStore, createLocalSettings, createMemoryStore, createSecretBox } from './ai/settings.js'

const KEY = 'sk-or-v1-supersecretvalue1234'
const OPTIONS = { kinds: ['Word'], tones: ['Casual'], contexts: ['Workplace'] }
const ENRICH = { items: [{ id: 'a1', text: 'Borrow' }], options: OPTIONS }

const NOTE = {
  id: 'a1',
  kind: 'Word',
  meanings: ['To take for a time — pedir prestado'],
  tone: 'Casual',
  context: 'Workplace',
  realExamples: ['Can I borrow your pen?'],
  variations: [],
  collocations: [],
  ipa: '',
  notes: '',
  priority: 4,
}

const chatReply = (content: unknown, finish_reason = 'stop') =>
  Response.json({
    id: 'gen-1',
    object: 'chat.completion',
    created: 1,
    model: 'x',
    choices: [{ index: 0, finish_reason, message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  })

function setUp(reply: (url: string, body: Record<string, any> | undefined) => Response = () => chatReply({ results: [NOTE] }), env: NodeJS.ProcessEnv = {}) {
  const calls: { url: string; headers: Headers; body?: Record<string, any>; redirect?: RequestRedirect }[] = []
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, headers: new Headers(init?.headers), body, ...(init?.redirect ? { redirect: init.redirect } : {}) })
    return reply(url, body)
  }) as typeof fetch
  const store = createMemoryStore()
  const box = createSecretBox(randomBytes(32))
  const app = createApp(env, { store, box, fetch: fakeFetch })
  return { app, store, box, calls }
}

const json = (method: string, body?: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

const OPENROUTER = { provider: 'openrouter', model: 'some/model:free', apiKey: KEY }

afterEach(() => vi.restoreAllMocks())

describe('saving AI settings', () => {
  it('never returns or stores the key in the clear', async () => {
    const { app, store } = setUp()
    const saved = await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    const read = await app.request('/api/ai/settings')
    const texts = [await saved.text(), await read.text(), JSON.stringify(await store.get(LOCAL_USER_ID))]
    for (const text of texts) expect(text).not.toContain('supersecret')
    expect(JSON.parse(texts[1]!)).toEqual({
      source: 'user',
      provider: 'openrouter',
      model: 'some/model:free',
      hasKey: true,
      keyHint: '…1234',
    })
  })

  it('reports AI as available once saved', async () => {
    const { app } = setUp()
    expect(await (await app.request('/api/health')).json()).toEqual({ ok: true, aiConfigured: false })
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    expect(await (await app.request('/api/health')).json()).toEqual({ ok: true, aiConfigured: true })
  })

  it('requires a key for a hosted service', async () => {
    const { app } = setUp()
    const res = await app.request('/api/ai/settings', json('PUT', { provider: 'openrouter', model: 'x' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'key_required' })
  })

  it('needs no key for a local server such as Ollama', async () => {
    const { app } = setUp()
    const res = await app.request('/api/ai/settings', json('PUT', { provider: 'custom', model: 'llama3', baseUrl: 'http://localhost:11434/v1/' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ baseUrl: 'http://localhost:11434/v1', hasKey: false })
  })

  it('keeps the saved key when only the model changes', async () => {
    const { app, calls } = setUp()
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    await app.request('/api/ai/settings', json('PUT', { provider: 'openrouter', model: 'other/model:free' }))
    await app.request('/api/ai/enrich', json('POST', ENRICH))
    expect(calls[0]!.headers.get('authorization')).toBe(`Bearer ${KEY}`)
    expect(calls[0]!.body!.model).toBe('other/model:free')
  })

  it('does not carry a saved key over to another address', async () => {
    const { app, calls } = setUp()
    await app.request('/api/ai/settings', json('PUT', { provider: 'custom', model: 'm', baseUrl: 'https://good.example/v1', apiKey: KEY }))
    const res = await app.request('/api/ai/settings', json('PUT', { provider: 'custom', model: 'm', baseUrl: 'https://evil.example/v1' }))
    expect(await res.json()).toMatchObject({ hasKey: false })
    await app.request('/api/ai/enrich', json('POST', ENRICH))
    expect(calls[0]!.url).toContain('evil.example')
    expect(calls[0]!.headers.get('authorization')).not.toContain(KEY)
  })

  it('does not carry a saved key over to another provider', async () => {
    const { app } = setUp()
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    const res = await app.request('/api/ai/settings', json('PUT', { provider: 'anthropic', model: 'claude-haiku-5-5' }))
    expect(await res.json()).toEqual({ error: 'key_required' })
  })

  it('does not send a saved key when listing models from another address', async () => {
    const { app, calls } = setUp(() => Response.json({ data: [] }))
    await app.request('/api/ai/settings', json('PUT', { provider: 'custom', model: 'm', baseUrl: 'https://good.example/v1', apiKey: KEY }))
    await app.request('/api/ai/models', json('POST', { provider: 'custom', baseUrl: 'https://evil.example/v1' }))
    expect(calls[0]!.headers.get('authorization')).toBeNull()
  })

  it('goes back to the key in .env when reset', async () => {
    const { app } = setUp(undefined, { ANTHROPIC_API_KEY: 'sk-server' })
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    const res = await app.request('/api/ai/settings', json('DELETE', {}))
    expect(await res.json()).toEqual({ source: 'server', hasKey: false })
  })

  it.each([
    ['javascript:alert(1)'],
    ['not a url'],
    ['https://user:pass@example.com/v1'],
    ['ftp://example.com'],
  ])('rejects the address %s', async (baseUrl) => {
    const { app } = setUp()
    const res = await app.request('/api/ai/settings', json('PUT', { provider: 'custom', model: 'm', baseUrl }))
    expect(await res.json()).toEqual({ error: 'invalid_url' })
  })

  it('rejects settings from another website', async () => {
    const { app } = setUp()
    const res = await app.request('/api/ai/settings', json('PUT', OPENROUTER, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
  })

  it('will not reveal settings to a site whose domain points at this server', async () => {
    const { app } = setUp()
    const res = await app.request('/api/ai/settings', { headers: { host: 'evil.example' } })
    expect(res.status).toBe(403)
  })
})

describe('using OpenRouter', () => {
  it('sends a strict schema and only accepts providers that honour it', async () => {
    const { app, calls } = setUp()
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    const res = await app.request('/api/ai/enrich', json('POST', ENRICH))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: [NOTE], usage: { inputTokens: 100, outputTokens: 50 } })
    const [call] = calls
    expect(call!.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(call!.body!.provider).toEqual({ require_parameters: true })
    expect(call!.body!.response_format.type).toBe('json_schema')
    expect(call!.body!.response_format.json_schema.strict).toBe(true)
  })

  it('gives the model no way to return an own example', async () => {
    const { app, calls } = setUp()
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    await app.request('/api/ai/enrich', json('POST', ENRICH))
    const fields = Object.keys(calls[0]!.body!.response_format.json_schema.schema.properties.results.items.properties)
    expect(fields.some((field) => /own/i.test(field))).toBe(false)
  })

  it('accepts JSON wrapped in code fences', async () => {
    const { app } = setUp(() => chatReply('```json\n' + JSON.stringify({ results: [NOTE] }) + '\n```'))
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    expect((await app.request('/api/ai/enrich', json('POST', ENRICH))).status).toBe(200)
  })

  it('still rejects extra or wrong content from a model that ignores the schema', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { app } = setUp(() => chatReply({ results: [{ ...NOTE, tone: 'Made up' }] }))
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    expect(await (await app.request('/api/ai/enrich', json('POST', ENRICH))).json()).toEqual({ error: 'invalid' })
  })

  it('drops an own example that a model adds anyway', async () => {
    const { app } = setUp(() => chatReply({ results: [{ ...NOTE, ownExamples: ['Written by AI'] }] }))
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    const body = await (await app.request('/api/ai/enrich', json('POST', ENRICH))).text()
    expect(body).not.toContain('Written by AI')
  })

  it('also serves sentence feedback', async () => {
    const feedback = { verdict: 'natural', usesTarget: true, grammar: 'g', naturalness: 'n', toneFit: 't', betterVersion: 'b' }
    const { app } = setUp(() => chatReply(feedback))
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))
    const res = await app.request('/api/ai/feedback', json('POST', { target: { text: 'Borrow' }, sentence: 'A sentence' }))
    expect((await res.json()).feedback).toEqual(feedback)
  })

  describe('failures', () => {
    const errorReply = (status: number) => () => Response.json({ error: { message: `leak ${KEY}` } }, { status })

    it.each([
      ['a bad key', errorReply(401), 'auth'],
      ['no credit', errorReply(402), 'no_credit'],
      ['a model it does not have', errorReply(404), 'unsupported_model'],
      ['a rejected model id', errorReply(400), 'unsupported_model'],
      ['a rate limit', errorReply(429), 'rate_limited'],
      ['an outage', errorReply(503), 'unavailable'],
      ['a filtered answer', () => chatReply('', 'content_filter'), 'refused'],
      ['a cut-off answer', () => chatReply('{"results":[', 'length'), 'incomplete'],
      ['a failure hidden in a 200', () => Response.json({ error: { code: 502 } }), 'unavailable'],
      ['an answer that is not JSON', () => chatReply('Sure! Here it is'), 'invalid'],
    ])('reports %s by code only', async (_name, reply, code) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { app } = setUp(reply)
      await app.request('/api/ai/settings', json('PUT', OPENROUTER))
      const text = await (await app.request('/api/ai/enrich', json('POST', ENRICH))).text()
      expect(JSON.parse(text)).toEqual({ error: code })
      expect(text).not.toContain('supersecret')
    })
  })
})

describe('using a custom address', () => {
  it('calls that address and blocks redirects', async () => {
    const { app, calls } = setUp()
    await app.request('/api/ai/settings', json('PUT', { provider: 'custom', model: 'llama3', baseUrl: 'http://localhost:11434/v1' }))
    await app.request('/api/ai/enrich', json('POST', ENRICH))
    expect(calls[0]!.url).toBe('http://localhost:11434/v1/chat/completions')
    expect(calls[0]!.redirect).toBe('error')
    expect(calls[0]!.body!.provider).toBeUndefined()
  })
})

describe('listing models', () => {
  const MODELS = {
    data: [
      { id: 'paid/model', name: 'Paid', pricing: { prompt: '0.001', completion: '0.002' }, supported_parameters: ['structured_outputs'] },
      { id: 'free/model:free', name: 'Free', pricing: { prompt: '0', completion: '0' }, supported_parameters: ['structured_outputs', 'tools'] },
      { id: 'free/plain:free', name: 'Free without JSON', pricing: { prompt: '0', completion: '0' }, supported_parameters: ['tools'] },
    ],
  }

  it('lists free models first and hides those without structured output', async () => {
    const { app } = setUp(() => Response.json(MODELS))
    const res = await app.request('/api/ai/models', json('POST', { provider: 'openrouter' }))
    expect((await res.json()).models).toEqual([
      { id: 'free/model:free', name: 'Free', free: true },
      { id: 'paid/model', name: 'Paid', free: false },
    ])
  })

  it('offers known models for Anthropic without any network call', async () => {
    const { app, calls } = setUp()
    const res = await app.request('/api/ai/models', json('POST', { provider: 'anthropic' }))
    expect((await res.json()).models[0].id).toBe('claude-haiku-5-5')
    expect(calls).toHaveLength(0)
  })

  it('reports an unreachable service', async () => {
    const { app } = setUp(() => new Response('nope', { status: 500 }))
    const res = await app.request('/api/ai/models', json('POST', { provider: 'custom', baseUrl: 'http://localhost:1/v1' }))
    expect(await res.json()).toEqual({ error: 'unavailable' })
  })
})

describe('a server hosted for other people, before logins exist', () => {
  const HOSTED = { LF_HOSTED: '1', ANTHROPIC_API_KEY: 'sk-owner' }

  it('refuses every AI route, because it cannot tell users apart', async () => {
    const { app } = setUp(undefined, HOSTED)
    for (const [path, init] of [
      ['/api/ai/settings', { method: 'GET' }],
      ['/api/ai/settings', json('PUT', OPENROUTER)],
      ['/api/ai/enrich', json('POST', ENRICH)],
      ['/api/ai/models', json('POST', { provider: 'openrouter' })],
    ] as const) {
      expect((await app.request(path, init)).status).toBe(401)
    }
  })

  it('does not offer the owner key to anonymous visitors', async () => {
    const { app } = setUp(undefined, HOSTED)
    expect(await (await app.request('/api/health')).json()).toEqual({ ok: true, aiConfigured: false })
  })

  it('refuses to start without a secrets key of its own', async () => {
    await expect(createLocalSettings({ LF_HOSTED: '1', LF_DATA_DIR: '/nonexistent' })).rejects.toThrow('AI_SECRETS_KEY')
  })
})

describe('cleanBaseUrl when hosted', () => {
  it.each([
    'http://example.com/v1',
    'https://localhost/v1',
    'https://127.0.0.1/v1',
    'https://10.0.0.5/v1',
    'https://192.168.1.1/v1',
    'https://172.20.0.1/v1',
    'https://169.254.169.254/latest',
    'https://[::1]/v1',
    'https://db.internal/v1',
  ])('rejects %s', (url) => {
    expect(cleanBaseUrl(url, { hosted: true })).toBeNull()
  })

  it('accepts a public https address', () => {
    expect(cleanBaseUrl('https://api.example.com/v1/', { hosted: true })).toBe('https://api.example.com/v1')
  })
})

describe('createSecretBox', () => {
  const box = createSecretBox(randomBytes(32))

  it('round-trips, and differs every time', () => {
    const [a, b] = [box.seal(KEY, 'u1'), box.seal(KEY, 'u1')]
    expect(a).not.toBe(b)
    expect(a).not.toContain('supersecret')
    expect(box.open(a, 'u1')).toBe(KEY)
  })

  it('will not open a value copied from another user', () => {
    expect(box.open(box.seal(KEY, 'u1'), 'u2')).toBeNull()
  })

  it('will not open a value that was tampered with', () => {
    const parts = box.seal(KEY, 'u1').split('.')
    parts[3] = Buffer.from('tampered').toString('base64')
    expect(box.open(parts.join('.'), 'u1')).toBeNull()
  })

  it('will not open a value sealed with another master key', () => {
    expect(createSecretBox(randomBytes(32)).open(box.seal(KEY, 'u1'), 'u1')).toBeNull()
  })

  it('asks for the key again if the master key changed', async () => {
    const store = createMemoryStore()
    await store.save(LOCAL_USER_ID, { provider: 'openrouter', model: 'm', encryptedKey: box.seal(KEY, LOCAL_USER_ID) })
    const app = createApp({}, { store, box: createSecretBox(randomBytes(32)) })
    expect(await (await app.request('/api/health')).json()).toEqual({ ok: true, aiConfigured: false })
  })
})

describe('local file storage', () => {
  const directories: string[] = []
  const tempDir = async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lf-settings-'))
    directories.push(directory)
    return directory
  }
  afterEach(async () => {
    await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })))
  })

  it('keeps each user apart and survives a restart', async () => {
    const directory = await tempDir()
    await createFileStore(directory).save('u1', { provider: 'custom', model: 'a' })
    await createFileStore(directory).save('u2', { provider: 'custom', model: 'b' })
    const reopened = createFileStore(directory)
    expect((await reopened.get('u1'))?.model).toBe('a')
    expect((await reopened.get('u2'))?.model).toBe('b')
    await reopened.remove('u1')
    expect(await reopened.get('u1')).toBeNull()
    expect((await reopened.get('u2'))?.model).toBe('b')
  })

  it('does not lose a save made at the same moment as another', async () => {
    const store = createFileStore(await tempDir())
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => store.save(id, { provider: 'custom', model: id })))
    expect((await store.get('a'))?.model).toBe('a')
    expect((await store.get('d'))?.model).toBe('d')
  })

  it('writes owner-only files, with no key in the clear, and reuses the master key', async () => {
    const directory = await tempDir()
    const first = await createLocalSettings({ LF_DATA_DIR: directory })
    const app = createApp({}, first)
    await app.request('/api/ai/settings', json('PUT', OPENROUTER))

    const onDisk = await readFile(join(directory, 'ai-settings.json'), 'utf8')
    expect(onDisk).toContain('openrouter')
    expect(onDisk).not.toContain('supersecret')
    expect((await stat(join(directory, 'ai-settings.json'))).mode & 0o777).toBe(0o600)
    expect((await stat(join(directory, 'secret.key'))).mode & 0o777).toBe(0o600)

    // After a restart, the saved key can still be read.
    const second = await createLocalSettings({ LF_DATA_DIR: directory })
    const app2 = createApp({}, second)
    expect(await (await app2.request('/api/health')).json()).toEqual({ ok: true, aiConfigured: true })
  })
})
