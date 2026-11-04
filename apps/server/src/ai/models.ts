import { z } from 'zod'
import { AiFailure } from './client.js'
import { DEFAULT_ANTHROPIC_MODEL, OPENROUTER_BASE_URL, type ProviderId } from './providers.js'

export interface ModelOption {
  id: string
  name: string
  free: boolean
}

const ANTHROPIC_MODELS: ModelOption[] = [
  { id: DEFAULT_ANTHROPIC_MODEL, name: 'Claude Haiku 5.5', free: false },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', free: false },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', free: false },
]

const modelList = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      pricing: z.object({ prompt: z.string(), completion: z.string() }).optional(),
      supported_parameters: z.array(z.string()).nullish(),
    }),
  ),
})

const isFree = (pricing: { prompt: string; completion: string } | undefined) =>
  pricing !== undefined && Number(pricing.prompt) === 0 && Number(pricing.completion) === 0

/** The models a provider offers. Only OpenRouter reports prices and structured output support. */
export async function listModels(
  provider: ProviderId,
  { baseUrl, apiKey, fetchImpl = fetch }: { baseUrl?: string; apiKey?: string; fetchImpl?: typeof fetch },
): Promise<ModelOption[]> {
  if (provider === 'anthropic') return ANTHROPIC_MODELS

  const isOpenRouter = provider === 'openrouter'
  let body: unknown
  try {
    const response = await fetchImpl(`${isOpenRouter ? OPENROUTER_BASE_URL : baseUrl}/models`, {
      headers: apiKey && !isOpenRouter ? { authorization: `Bearer ${apiKey}` } : {},
      // A user-supplied address must not be able to redirect this server somewhere else.
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new AiFailure('unavailable')
    body = await response.json()
  } catch {
    throw new AiFailure('unavailable')
  }

  const parsed = modelList.safeParse(body)
  if (!parsed.success) throw new AiFailure('invalid')

  return parsed.data.data
    // The queue needs JSON it can rely on, so OpenRouter models without it aren't offered.
    .filter((model) => !isOpenRouter || model.supported_parameters?.includes('structured_outputs'))
    .map((model) => ({ id: model.id, name: model.name ?? model.id, free: isFree(model.pricing) }))
    .sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name))
}
