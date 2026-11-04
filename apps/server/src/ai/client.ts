import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { z } from 'zod'

export type AiErrorCode =
  | 'not_configured'
  | 'auth'
  | 'no_credit'
  | 'unsupported_model'
  | 'rate_limited'
  | 'unavailable'
  | 'refused'
  | 'incomplete'
  | 'invalid'
  | 'failed'

/** Tokens spent by one call, which the browser adds to the daily budget. */
export interface AiUsage {
  inputTokens: number
  outputTokens: number
}

/** A failure with a stable code. The browser turns the code into a translated message. */
export class AiFailure extends Error {
  constructor(readonly code: AiErrorCode) {
    super(code)
  }
}

const STATUS_BY_CODE: Record<AiErrorCode, 401 | 402 | 429 | 502 | 503> = {
  not_configured: 503,
  auth: 401,
  no_credit: 402,
  unsupported_model: 502,
  rate_limited: 429,
  unavailable: 503,
  refused: 502,
  incomplete: 502,
  invalid: 502,
  failed: 502,
}
export const statusFor = (code: AiErrorCode) => STATUS_BY_CODE[code]

/** One call to a model that must answer with JSON matching `schema`. */
export interface JsonRequest<S extends z.ZodType> {
  system: string
  user: string
  schema: S
  maxTokens: number
}

/** What the features need from an AI service. Each provider in providers.ts implements it. */
export interface AiProvider {
  generate<S extends z.ZodType>(request: JsonRequest<S>): Promise<{ parsed: z.infer<S>; usage: AiUsage }>
}

/**
 * Builds the output format by hand rather than with the SDK's zodOutputFormat, which
 * moves `enum` into a description. Here the API itself enforces the allowed values.
 */
export function jsonFormat(schema: z.ZodType) {
  const { $schema: _dialect, ...json } = z.toJSONSchema(schema)
  return { type: 'json_schema' as const, schema: json }
}

/** Reads a model's text as JSON. Models without enforced output sometimes add code fences. */
export function parseJsonOutput<S extends z.ZodType>(text: string, schema: S): z.infer<S> {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let json: unknown
  try {
    json = JSON.parse(unfenced)
  } catch {
    throw new AiFailure('invalid')
  }
  const output = schema.safeParse(json)
  if (!output.success) throw new AiFailure('invalid')
  return output.data
}

/** The two SDKs report the same HTTP failures, so one mapping covers every provider. */
function codeForStatus(status: number | undefined): AiErrorCode {
  if (status === 401 || status === 403) return 'auth'
  if (status === 402) return 'no_credit'
  if (status === 404) return 'unsupported_model'
  if (status === 429) return 'rate_limited'
  return status !== undefined && status >= 500 ? 'unavailable' : 'failed'
}

/** Reduces any SDK error to a code, so messages from the API never reach the browser. */
export function toAiFailure(error: unknown): AiFailure {
  if (error instanceof AiFailure) return error
  if (error instanceof Anthropic.APIConnectionError || error instanceof OpenAI.APIConnectionError) {
    return new AiFailure('unavailable')
  }
  // OpenAI-compatible services answer 400 for a model id they don't have. Anthropic also
  // uses 400 for other problems, such as an empty balance, so there it stays generic.
  if (error instanceof OpenAI.APIError && error.status === 400) return new AiFailure('unsupported_model')
  if (error instanceof Anthropic.APIError || error instanceof OpenAI.APIError) {
    return new AiFailure(codeForStatus(error.status))
  }
  return new AiFailure('failed')
}
