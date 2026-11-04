import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { z } from 'zod'
import { AiFailure, parseJsonOutput, type AiProvider, type JsonRequest } from './client.js'

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-5-5'
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

/** Free models can be slow, but a request that hangs must not hold up the queue for long. */
const TIMEOUT_MS = 120_000

export type ProviderId = 'anthropic' | 'openrouter' | 'custom'

export interface ProviderConfig {
  provider: ProviderId
  model: string
  baseUrl?: string
  apiKey?: string
}

/** Written by hand because the SDK's zodOutputFormat moves `enum` into a description. */
function jsonSchemaOf(schema: z.ZodType) {
  const { $schema: _dialect, ...json } = z.toJSONSchema(schema)
  return json
}

export function anthropicProvider(client: Pick<Anthropic, 'messages'>, model: string): AiProvider {
  return {
    async generate<S extends z.ZodType>({ system, user, schema, maxTokens }: JsonRequest<S>) {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        // The constant prompt is reused between calls, which makes later requests cheaper.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: jsonSchemaOf(schema) } },
        messages: [{ role: 'user', content: user }],
      })
      // A refusal arrives as HTTP 200, so the reason has to be checked before the content.
      if (response.stop_reason === 'refusal') throw new AiFailure('refused')
      if (response.stop_reason === 'max_tokens') throw new AiFailure('incomplete')

      const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
      const { usage } = response
      return {
        parsed: parseJsonOutput(text, schema),
        usage: {
          // Cached tokens are billed apart from input_tokens but still count as spending.
          inputTokens:
            usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
          outputTokens: usage.output_tokens,
        },
      }
    },
  }
}

/** Any service with the OpenAI chat API, such as OpenRouter, Ollama or LM Studio. */
export function openAiCompatibleProvider(
  client: Pick<OpenAI, 'chat'>,
  model: string,
  { openRouter = false }: { openRouter?: boolean } = {},
): AiProvider {
  return {
    async generate<S extends z.ZodType>({ system, user, schema, maxTokens }: JsonRequest<S>) {
      const json = jsonSchemaOf(schema)
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          // Not every model enforces response_format, so the schema is also spelled out.
          {
            role: 'system',
            content: `${system}\n\nReply with only a JSON object, without code fences, that matches this JSON Schema:\n${JSON.stringify(json)}`,
          },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'output', strict: true, schema: json } },
        // Makes OpenRouter skip providers of this model that would ignore response_format.
        ...(openRouter ? { provider: { require_parameters: true } } : {}),
      } as OpenAI.ChatCompletionCreateParamsNonStreaming)

      // OpenRouter can report an upstream failure as HTTP 200 with no choices.
      const [choice] = response.choices ?? []
      if (!choice) throw new AiFailure('unavailable')
      if (choice.finish_reason === 'content_filter') throw new AiFailure('refused')
      if (choice.finish_reason === 'length') throw new AiFailure('incomplete')

      return {
        parsed: parseJsonOutput(choice.message.content ?? '', schema),
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      }
    },
  }
}

export function createProvider(config: ProviderConfig, fetchImpl?: typeof fetch): AiProvider {
  if (config.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: config.apiKey, timeout: TIMEOUT_MS, ...(fetchImpl ? { fetch: fetchImpl } : {}) })
    return anthropicProvider(client, config.model)
  }

  const isOpenRouter = config.provider === 'openrouter'
  const base = fetchImpl ?? fetch
  const client = new OpenAI({
    // Local servers such as Ollama need no key, but the SDK requires a value.
    apiKey: config.apiKey || 'none',
    baseURL: isOpenRouter ? OPENROUTER_BASE_URL : config.baseUrl,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
    // A user-supplied address must not be able to redirect this server somewhere else.
    fetch: isOpenRouter ? base : (url, init) => base(url, { ...init, redirect: 'error' }),
    ...(isOpenRouter ? { defaultHeaders: { 'X-Title': 'LinguaForge' } } : {}),
  })
  return openAiCompatibleProvider(client, config.model, { openRouter: isOpenRouter })
}
