import type { EnrichmentDraft, SentenceFeedback } from '@/domain/types'

export interface AiUsage {
  inputTokens: number
  outputTokens: number
}

const KNOWN_CODES = new Set([
  'not_configured', 'auth', 'no_credit', 'unsupported_model', 'rate_limited', 'unavailable', 'network',
  'refused', 'incomplete', 'invalid', 'failed', 'bad_request', 'invalid_url', 'key_required',
])

/** A failure whose code always has a translated message under `enrich.errors`. */
export class AiRequestError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = KNOWN_CODES.has(code) ? code : 'failed'
  }
}

export interface EnrichRequest {
  items: { id: string; text: string; kindHint?: string }[]
  options: { kinds: string[]; tones: string[]; contexts: string[] }
}

export interface EnrichResponse {
  results: (EnrichmentDraft & { id: string })[]
  usage: AiUsage
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      ...(method === 'GET'
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
    })
  } catch {
    throw new AiRequestError('network')
  }
  // When the API server is down, the Vite proxy answers with an empty or non-JSON error.
  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!json) throw new AiRequestError('network')
  if (!response.ok) throw new AiRequestError(json.error ?? 'failed')
  return json
}

const post = <T>(path: string, body: unknown) => send<T>('POST', path, body)

export const requestEnrichment = (request: EnrichRequest) => post<EnrichResponse>('/api/ai/enrich', request)

export const requestFeedback = (request: {
  target: { text: string; meanings: string[]; tone: string; context: string }
  sentence: string
}) => post<{ feedback: SentenceFeedback; usage: AiUsage }>('/api/ai/feedback', request)

export async function fetchAiConfigured(): Promise<boolean> {
  try {
    const response = await fetch('/api/health')
    const health = (await response.json()) as { aiConfigured?: boolean }
    return health.aiConfigured === true
  } catch {
    return false
  }
}

export type AiProviderId = 'anthropic' | 'openrouter' | 'custom'

/** The user's AI choice, as the server reports it. It never includes the key itself. */
export interface AiSettingsView {
  source: 'user' | 'server' | 'none'
  provider?: AiProviderId
  model?: string
  tutorModel?: string
  baseUrl?: string
  hasKey: boolean
  keyHint?: string
}

export interface AiModelOption {
  id: string
  name: string
  free: boolean
}

export const fetchAiSettings = () => send<AiSettingsView>('GET', '/api/ai/settings')

export const saveAiSettings = (settings: { provider: AiProviderId; model: string; tutorModel?: string; baseUrl?: string; apiKey?: string }) =>
  send<AiSettingsView>('PUT', '/api/ai/settings', settings)

export const resetAiSettings = () => send<AiSettingsView>('DELETE', '/api/ai/settings')

export const fetchAiModels = (provider: AiProviderId, baseUrl?: string) =>
  post<{ models: AiModelOption[] }>('/api/ai/models', { provider, baseUrl })
