import Anthropic from '@anthropic-ai/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'

const OPTIONS = { kinds: ['Word', 'N/A'], tones: ['Casual'], contexts: ['Workplace'] }
const ITEMS = [{ id: 'a1', text: 'Borrow', kindHint: 'Word' }]

const NOTE = {
  id: 'a1',
  kind: 'Word',
  meanings: ['To take something for a time — pedir prestado'],
  tone: 'Casual',
  context: 'Workplace',
  realExamples: ['Can I borrow your charger for a minute?'],
  variations: ['lend (the other direction)'],
  collocations: ['borrow money'],
  ipa: '/ˈbɑːroʊ/',
  notes: '',
  priority: 5,
}

/** A real SDK client whose HTTP layer is replaced, so the request it builds can be inspected. */
function sdkWith(handler: (body: Record<string, any>) => Response) {
  const bodies: Record<string, any>[] = []
  const client = new Anthropic({
    apiKey: 'sk-secret',
    maxRetries: 0,
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      bodies.push(body)
      return handler(body)
    },
  })
  return { client, bodies }
}

function modelReply(payload: unknown, stop_reason = 'end_turn') {
  return Response.json({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 20,
      cache_read_input_tokens: 30,
    },
  })
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers },
  path,
})

function send(app: ReturnType<typeof createApp>, request: ReturnType<typeof post>) {
  const { path, ...init } = request
  return app.request(path, init)
}

const ENV = { ANTHROPIC_API_KEY: 'sk-secret' }

afterEach(() => vi.restoreAllMocks())

describe('GET /api/health', () => {
  it('reports AI as disabled when there is no key', async () => {
    const res = await createApp({}).request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, aiConfigured: false })
  })

  it('reports AI as configured without leaking the key', async () => {
    const res = await createApp(ENV).request('/api/health')
    const body = await res.text()
    expect(JSON.parse(body)).toEqual({ ok: true, aiConfigured: true })
    expect(body).not.toContain('sk-secret')
  })
})

describe('protecting the API credit from other websites', () => {
  const unused = {} as Pick<Anthropic, 'messages'>

  it('rejects a request from another origin', async () => {
    const app = createApp(ENV, { client: unused })
    const res = await send(app, post('/api/ai/enrich', { items: ITEMS, options: OPTIONS }, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
  })

  it('rejects a lookalike of a local origin', async () => {
    const app = createApp(ENV, { client: unused })
    const res = await send(app, post('/api/ai/enrich', { items: ITEMS, options: OPTIONS }, { origin: 'http://localhost.evil.example' }))
    expect(res.status).toBe(403)
  })

  it('rejects a body that avoids the preflight by not being JSON', async () => {
    const app = createApp(ENV, { client: unused })
    const res = await send(app, post('/api/ai/enrich', { items: ITEMS, options: OPTIONS }, { 'content-type': 'text/plain' }))
    expect(res.status).toBe(415)
  })

  it('never approves a CORS preflight', async () => {
    const app = createApp(ENV, { client: unused })
    const res = await app.request('/api/ai/enrich', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects an oversized body', async () => {
    const app = createApp(ENV, { client: unused })
    const res = await send(app, post('/api/ai/feedback', 'x'.repeat(70 * 1024)))
    expect(res.status).toBe(413)
  })
})

describe('POST /api/ai/enrich', () => {
  const body = { items: ITEMS, options: OPTIONS }

  it('explains that AI is off when there is no key', async () => {
    const res = await send(createApp({}), post('/api/ai/enrich', body))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_configured' })
  })

  it.each([
    ['too many items', { items: Array(6).fill(ITEMS[0]), options: OPTIONS }],
    ['no items', { items: [], options: OPTIONS }],
    ['blank text', { items: [{ id: 'a1', text: '   ' }], options: OPTIONS }],
    ['no options', { items: ITEMS, options: { kinds: [], tones: [], contexts: [] } }],
  ])('rejects %s without calling the API', async (_name, invalid) => {
    const { client, bodies } = sdkWith(() => modelReply({ results: [] }))
    const res = await send(createApp(ENV, { client }), post('/api/ai/enrich', invalid))
    expect(res.status).toBe(400)
    expect(bodies).toHaveLength(0)
  })

  it('sends only the entry text and asks for the configured model', async () => {
    const { client, bodies } = sdkWith(() => modelReply({ results: [NOTE] }))
    const app = createApp({ ...ENV, ANTHROPIC_FAST_MODEL: 'claude-sonnet-5-5' }, { client })
    await send(app, post('/api/ai/enrich', body))

    const [sent] = bodies
    expect(sent!.model).toBe('claude-sonnet-5-5')
    expect(sent!.messages).toEqual([{ role: 'user', content: `<entries>\n${JSON.stringify(ITEMS)}\n</entries>` }])
    expect(sent!.system[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('defaults to the fast model', async () => {
    const { client, bodies } = sdkWith(() => modelReply({ results: [NOTE] }))
    await send(createApp(ENV, { client }), post('/api/ai/enrich', body))
    expect(bodies[0]!.model).toBe('claude-haiku-5-5')
  })

  it('gives the model no way to return an own example', async () => {
    const { client, bodies } = sdkWith(() => modelReply({ results: [NOTE] }))
    await send(createApp(ENV, { client }), post('/api/ai/enrich', body))

    const schema = bodies[0]!.output_config.format.schema
    const fields = Object.keys(schema.properties.results.items.properties)
    expect(fields).toContain('meanings')
    expect(fields.some((field) => /own/i.test(field))).toBe(false)
    expect(schema.properties.results.items.additionalProperties).toBe(false)
    expect(schema.properties.results.items.properties.tone.enum).toEqual(OPTIONS.tones)
    expect(schema.properties.results.items.properties.priority.enum).toEqual([1, 2, 3, 4, 5])
    expect(schema.$schema).toBeUndefined()
  })

  it('rejects a value outside the deck options even if the model returns one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = sdkWith(() => modelReply({ results: [{ ...NOTE, tone: 'Made up' }] }))
    const res = await send(createApp(ENV, { client }), post('/api/ai/enrich', body))
    expect(await res.json()).toEqual({ error: 'invalid' })
  })

  it('returns the note and counts cached tokens', async () => {
    const { client } = sdkWith(() => modelReply({ results: [NOTE] }))
    const res = await send(createApp(ENV, { client }), post('/api/ai/enrich', body))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.results[0]).toEqual(NOTE)
    expect(json.usage).toEqual({ inputTokens: 150, outputTokens: 50 })
  })

  it('drops results for entries it was not asked about', async () => {
    const stray = { ...NOTE, id: 'someone-else' }
    const { client } = sdkWith(() => modelReply({ results: [NOTE, stray] }))
    const json = await (await send(createApp(ENV, { client }), post('/api/ai/enrich', body))).json()
    expect(json.results.map((r: { id: string }) => r.id)).toEqual(['a1'])
  })

  describe('failures', () => {
    const silenced = () => vi.spyOn(console, 'error').mockImplementation(() => {})

    it.each([
      ['a refusal', () => modelReply({}, 'refusal'), 502, 'refused'],
      ['running out of tokens', () => modelReply({ results: [] }, 'max_tokens'), 502, 'incomplete'],
      ['no matching results', () => modelReply({ results: [] }), 502, 'invalid'],
      ['a bad key', () => Response.json({ type: 'error', error: { type: 'authentication_error', message: 'sk-secret is bad' } }, { status: 401 }), 401, 'auth'],
      ['a rate limit', () => Response.json({ type: 'error', error: { type: 'rate_limit_error', message: 'slow' } }, { status: 429 }), 429, 'rate_limited'],
      ['an outage', () => Response.json({ type: 'error', error: { type: 'api_error', message: 'down' } }, { status: 500 }), 503, 'unavailable'],
    ] as const)('reports %s by code only', async (_name, reply, status, code) => {
      const log = silenced()
      const { client } = sdkWith(reply)
      const res = await send(createApp(ENV, { client }), post('/api/ai/enrich', body))
      const text = await res.text()
      expect(res.status).toBe(status)
      expect(JSON.parse(text)).toEqual({ error: code })
      expect(text).not.toContain('sk-secret')
      expect(JSON.stringify(log.mock.calls)).not.toContain('Borrow')
    })

    it('reports output that is not valid JSON', async () => {
      silenced()
      const { client } = sdkWith(() =>
        Response.json({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-5-5',
          content: [{ type: 'text', text: 'not json' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      )
      const res = await send(createApp(ENV, { client }), post('/api/ai/enrich', body))
      expect(await res.json()).toEqual({ error: 'invalid' })
    })
  })
})

describe('POST /api/ai/feedback', () => {
  const FEEDBACK = {
    verdict: 'understandable',
    usesTarget: true,
    grammar: 'Falta el artículo.',
    naturalness: 'Suena un poco raro.',
    toneFit: 'Encaja.',
    betterVersion: 'Can I borrow your charger?',
  }
  const body = {
    target: { text: 'Borrow', meanings: ['To take for a time'], tone: 'Casual', context: 'Workplace' },
    sentence: 'Can I borrow charger?',
  }

  it('returns structured feedback', async () => {
    const { client, bodies } = sdkWith(() => modelReply(FEEDBACK))
    const res = await send(createApp(ENV, { client }), post('/api/ai/feedback', body))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.feedback).toEqual(FEEDBACK)
    expect(bodies[0]!.messages[0].content).toContain('Can I borrow charger?')
  })

  it('rejects a blank sentence', async () => {
    const { client } = sdkWith(() => modelReply(FEEDBACK))
    const res = await send(createApp(ENV, { client }), post('/api/ai/feedback', { ...body, sentence: ' ' }))
    expect(res.status).toBe(400)
  })
})

describe('choosing a model per task', () => {
  const FEEDBACK_BODY = {
    target: { text: 'Borrow', meanings: [], tone: '', context: '' },
    sentence: 'Can I borrow charger?',
  }
  const TUTOR_BODY = { scenario: 'standup', targets: [], history: [] }
  const REPLY = { reply: 'Hi', correction: null, usedTargets: [], newExpression: null }
  const FEEDBACK = { verdict: 'natural', usesTarget: true, grammar: '', naturalness: '', toneFit: '', betterVersion: '' }

  it('uses the tutor model for the tutor and the fast one for the rest', async () => {
    const { client, bodies } = sdkWith((body) =>
      modelReply(JSON.stringify(body.messages).includes('charger') ? FEEDBACK : REPLY),
    )
    const app = createApp({ ...ENV, ANTHROPIC_FAST_MODEL: 'fast', ANTHROPIC_TUTOR_MODEL: 'strong' }, { client })
    await send(app, post('/api/ai/feedback', FEEDBACK_BODY))
    await send(app, post('/api/ai/tutor', TUTOR_BODY))
    expect(bodies.map((body) => body.model)).toEqual(['fast', 'strong'])
  })

  it('falls back to the fast model when no tutor model is set', async () => {
    const { client, bodies } = sdkWith(() => modelReply(REPLY))
    await send(createApp({ ...ENV, ANTHROPIC_FAST_MODEL: 'fast' }, { client }), post('/api/ai/tutor', TUTOR_BODY))
    expect(bodies[0]!.model).toBe('fast')
  })

  it('saves the tutor model with the user\'s settings, and an empty one clears it', async () => {
    const app = createApp({})
    const save = async (tutorModel?: string) => {
      const request = post('/api/ai/settings', { provider: 'openrouter', model: 'fast', apiKey: 'sk-or-1234567890', ...(tutorModel === undefined ? {} : { tutorModel }) })
      const { path, ...init } = request
      return (await app.request(path, { ...init, method: 'PUT' })).json()
    }
    expect((await save('strong')).tutorModel).toBe('strong')
    expect((await save('')).tutorModel).toBeUndefined()
  })
})
