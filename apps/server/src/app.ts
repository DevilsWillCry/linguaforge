import { randomBytes } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import { resolveUserId } from './auth.js'
import { statusFor, toAiFailure, type AiErrorCode, type AiProvider } from './ai/client.js'
import { enrichEntries, enrichRequestSchema } from './ai/enrichment.js'
import { feedbackRequestSchema, reviewSentence } from './ai/feedback.js'
import { estimateLevel, levelRequestSchema } from './ai/level.js'
import { listModels } from './ai/models.js'
import { DEFAULT_ANTHROPIC_MODEL, anthropicProvider, createProvider } from './ai/providers.js'
import { outputRequestSchema, reviewOutput, runTutorTurn, tutorRequestSchema } from './ai/tutor.js'
import {
  aiSettingsInputSchema,
  cleanBaseUrl,
  createMemoryStore,
  createSecretBox,
  keyHintOf,
  publicSettings,
  type AiSettingsStore,
  type SecretBox,
  type StoredAiSettings,
} from './ai/settings.js'

import { extractArticle, extractRequestSchema } from './reading/extract.js'
import { progressSchema, reminderInputSchema, unusedReminderService, type ReminderService } from './push/reminders.js'
import { PageError, fetchPublicPage, type FetchedPage } from './reading/fetchPage.js'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

interface AppOptions {
  /** Replaces the SDK client used with the server's own key, in tests. */
  client?: Pick<Anthropic, 'messages'>
  /** Replaces network access for user-configured providers, in tests. */
  fetch?: typeof fetch
  /** Where each user's AI settings are kept. Tests get a fresh one in memory. */
  store?: AiSettingsStore
  box?: SecretBox
  /** Replaces web access when reading pages, in tests. */
  fetchPage?: (url: string) => Promise<FetchedPage>
  reminders?: ReminderService
}

/**
 * Only features that need a secret live on this server (AI, transcripts, TTS).
 * Takes `env` as an argument so tests never depend on the real environment.
 */
export function createApp(env: NodeJS.ProcessEnv = process.env, options: AppOptions = {}) {
  const app = new Hono()
  const hosted = Boolean(env.LF_HOSTED)
  const store = options.store ?? createMemoryStore()
  const box = options.box ?? createSecretBox(randomBytes(32))

  // The key in .env is the owner's, so a hosted server must never spend it on other users.
  const serverClient =
    options.client ?? (env.ANTHROPIC_API_KEY && !hosted ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : undefined)
  const serverModel = env.ANTHROPIC_FAST_MODEL || DEFAULT_ANTHROPIC_MODEL
  const serverTutorModel = env.ANTHROPIC_TUTOR_MODEL || serverModel

  /** The user's own AI if they set one up, otherwise the key in .env on a local server. */
  async function providerFor(userId: string, purpose: 'fast' | 'tutor' = 'fast'): Promise<AiProvider | null> {
    const saved = await store.get(userId)
    if (!saved) {
      return serverClient ? anthropicProvider(serverClient, purpose === 'tutor' ? serverTutorModel : serverModel) : null
    }

    let apiKey: string | undefined
    if (saved.encryptedKey) {
      apiKey = box.open(saved.encryptedKey, userId) ?? undefined
      // Happens if the secrets key changed. The user has to enter their key again.
      if (!apiKey) return null
    }
    const model = purpose === 'tutor' && saved.tutorModel ? saved.tutorModel : saved.model
    return createProvider({ provider: saved.provider, model, baseUrl: saved.baseUrl, apiKey }, options.fetch)
  }

  // Reports whether AI is available. Never include a key in a response.
  app.get('/api/health', async (c) => {
    const userId = resolveUserId(c.req.raw, env)
    return c.json({ ok: true, aiConfigured: userId ? Boolean(await providerFor(userId)) : false })
  })

  // Binding to loopback doesn't stop a website the user visits from calling this port,
  // which would spend their API credit. Other sites can't pass the Origin check, and
  // requiring JSON forces a CORS preflight, which this server never approves. The Host
  // check stops a site whose domain was pointed at 127.0.0.1 from reading the settings.
  const protect = (routes: Hono<{ Variables: { userId: string } }>) => {
    routes.use('*', async (c, next) => {
      const host = c.req.header('host')
      const origin = c.req.header('origin')
      if (host && !isLocalUrl(`http://${host}`)) return c.json({ error: 'forbidden' }, 403)
      if (origin && !isLocalUrl(origin)) return c.json({ error: 'forbidden' }, 403)
      if (c.req.method !== 'GET' && !c.req.header('content-type')?.toLowerCase().startsWith('application/json')) {
        return c.json({ error: 'bad_request' }, 415)
      }
      const userId = resolveUserId(c.req.raw, env)
      if (!userId) return c.json({ error: 'unauthenticated' }, 401)
      c.set('userId', userId)
      return next()
    })
    routes.use('*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: 'bad_request' }, 413) }))
    return routes
  }
  const guard = protect(new Hono<{ Variables: { userId: string } }>())
  const reading = protect(new Hono<{ Variables: { userId: string } }>())
  const reminders = protect(new Hono<{ Variables: { userId: string } }>())
  const reminderService = options.reminders ?? unusedReminderService()

  const fail = (code: AiErrorCode) => Response.json({ error: code }, { status: statusFor(code) })

  /** Logs only the failure code, so learners' sentences never end up in a log. */
  async function run(userId: string, call: (provider: AiProvider) => Promise<unknown>, purpose: 'fast' | 'tutor' = 'fast'): Promise<Response> {
    const provider = await providerFor(userId, purpose)
    if (!provider) return fail('not_configured')
    try {
      return Response.json(await call(provider))
    } catch (error) {
      const { code } = toAiFailure(error)
      const status = error instanceof Anthropic.APIError ? ` (HTTP ${error.status})` : ''
      console.error(`AI request failed: ${code}${status}`)
      return fail(code)
    }
  }

  const readJson = (c: Context) => c.req.raw.json().catch(() => undefined)
  const badRequest = (c: Context, error = 'bad_request') => c.json({ error }, 400)

  guard.post('/enrich', async (c) => {
    const body = enrichRequestSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    return run(c.get('userId'), (provider) => enrichEntries(provider, body.data))
  })

  guard.post('/feedback', async (c) => {
    const body = feedbackRequestSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    return run(c.get('userId'), (provider) => reviewSentence(provider, body.data))
  })

  guard.post('/level', async (c) => {
    const body = levelRequestSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    return run(c.get('userId'), (provider) => estimateLevel(provider, body.data.text))
  })

  guard.post('/tutor', async (c) => {
    const body = tutorRequestSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    return run(c.get('userId'), (provider) => runTutorTurn(provider, body.data), 'tutor')
  })

  guard.post('/output', async (c) => {
    const body = outputRequestSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    return run(c.get('userId'), (provider) => reviewOutput(provider, body.data), 'tutor')
  })

  guard.get('/settings', async (c) => {
    const settings = await store.get(c.get('userId'))
    return c.json(publicSettings(settings, Boolean(serverClient)))
  })

  guard.put('/settings', async (c) => {
    const userId = c.get('userId')
    const body = aiSettingsInputSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    const { provider, model, tutorModel, apiKey } = body.data

    let baseUrl: string | undefined
    if (provider === 'custom') {
      baseUrl = cleanBaseUrl(body.data.baseUrl, { hosted }) ?? undefined
      if (!baseUrl) return badRequest(c, 'invalid_url')
    }

    // A saved key only stays with the service it was entered for. Otherwise, changing
    // the address and leaving the key field blank would send the key to the new address.
    const previous = await store.get(userId)
    const sameService = previous?.provider === provider && previous?.baseUrl === baseUrl
    const kept = !apiKey && sameService ? previous : undefined
    if (!apiKey && !kept?.encryptedKey && provider !== 'custom') return badRequest(c, 'key_required')

    const settings: StoredAiSettings = {
      provider,
      model,
      ...(tutorModel ? { tutorModel } : {}),
      ...(baseUrl ? { baseUrl } : {}),
      ...(apiKey
        ? { encryptedKey: box.seal(apiKey, userId), keyHint: keyHintOf(apiKey) }
        : kept?.encryptedKey
          ? { encryptedKey: kept.encryptedKey, ...(kept.keyHint ? { keyHint: kept.keyHint } : {}) }
          : {}),
    }
    await store.save(userId, settings)
    return c.json(publicSettings(settings, Boolean(serverClient)))
  })

  guard.delete('/settings', async (c) => {
    await store.remove(c.get('userId'))
    return c.json(publicSettings(null, Boolean(serverClient)))
  })

  guard.post('/models', async (c) => {
    const body = z
      .object({ provider: aiSettingsInputSchema.shape.provider, baseUrl: z.string().max(500).optional() })
      .safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    const { provider } = body.data

    const baseUrl = provider === 'custom' ? (cleanBaseUrl(body.data.baseUrl, { hosted }) ?? undefined) : undefined
    if (provider === 'custom' && !baseUrl) return badRequest(c, 'invalid_url')

    // Same rule as saving: a key is only sent to the address it was saved with.
    const saved = await store.get(c.get('userId'))
    const apiKey =
      provider === 'custom' && saved?.provider === 'custom' && saved.baseUrl === baseUrl && saved.encryptedKey
        ? (box.open(saved.encryptedKey, c.get('userId')) ?? undefined)
        : undefined

    try {
      return c.json({
        models: await listModels(provider, {
          ...(baseUrl ? { baseUrl } : {}),
          ...(apiKey ? { apiKey } : {}),
          ...(options.fetch ? { fetchImpl: options.fetch } : {}),
        }),
      })
    } catch (error) {
      return fail(toAiFailure(error).code)
    }
  })

  reading.post('/extract', async (c) => {
    const body = extractRequestSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c, 'invalid_url')
    try {
      const page = await (options.fetchPage ?? fetchPublicPage)(body.data.url)
      const article = extractArticle(page.body, page.url, page.contentType)
      return article ? c.json(article) : c.json({ error: 'no_content' }, 422)
    } catch (error) {
      // The address isn't logged either, because what someone reads is private.
      const code = error instanceof PageError ? error.code : 'fetch_failed'
      return c.json({ error: code }, code === 'invalid_url' || code === 'blocked_url' ? 400 : 502)
    }
  })

  reminders.get('/', async (c) => {
    const saved = await reminderService.store.get(c.get('userId'))
    return c.json({ publicKey: reminderService.publicKey, enabled: Boolean(saved), time: saved?.time ?? null })
  })

  reminders.put('/', async (c) => {
    const body = reminderInputSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    const previous = await reminderService.store.get(c.get('userId'))
    // Changing the time keeps today's "already sent", so it can't remind twice in one day.
    await reminderService.store.save(c.get('userId'), {
      ...body.data,
      ...(previous?.lastSentDay ? { lastSentDay: previous.lastSentDay } : {}),
    })
    return c.json({ enabled: true, time: body.data.time })
  })

  reminders.delete('/', async (c) => {
    await reminderService.store.remove(c.get('userId'))
    return c.json({ enabled: false })
  })

  /** Today has real output, so there's nothing left to remind about. */
  reminders.post('/progress', async (c) => {
    const body = progressSchema.safeParse(await readJson(c))
    if (!body.success) return badRequest(c)
    const saved = await reminderService.store.get(c.get('userId'))
    if (saved) await reminderService.store.save(c.get('userId'), { ...saved, outputDay: body.data.outputDay })
    return c.json({ ok: true })
  })

  reminders.post('/test', async (c) => {
    const saved = await reminderService.store.get(c.get('userId'))
    if (!saved) return c.json({ error: 'not_enabled' }, 409)
    const result = await reminderService.deliver(c.get('userId'), saved)
    return result === 'sent' ? c.json({ ok: true }) : c.json({ error: result }, 502)
  })

  app.route('/api/ai', guard)
  app.route('/api/reminders', reminders)
  app.route('/api/reading', reading)
  return app
}
