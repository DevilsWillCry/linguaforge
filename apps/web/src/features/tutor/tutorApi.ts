import type { OutputReviewResult, TutorTurnResult } from './types'
import { AiRequestError } from '@/features/enrichment/enrichmentApi'

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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

interface Target {
  text: string
  meaning: string
}

export const requestTutorTurn = (body: { scenario: string; targets: Target[]; history: { role: string; content: string }[] }) =>
  post<TutorTurnResult>('/api/ai/tutor', body)

export const requestOutputReview = (body: { targets: Target[]; text: string }) =>
  post<OutputReviewResult>('/api/ai/output', body)
