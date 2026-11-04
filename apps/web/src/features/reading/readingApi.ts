import type { AiUsage } from '@/features/enrichment/enrichmentApi'

export interface Article {
  /** Missing for pasted text, which has no address to go back to. */
  url?: string
  title: string
  siteName?: string
  paragraphs: string[]
}

export interface LoadedArticle extends Article {
  url: string
}

export interface LevelEstimate {
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  reason: string
}

export class ReadingError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

const READING_CODES = new Set(['invalid_url', 'blocked_url', 'fetch_failed', 'not_html', 'too_large', 'no_content', 'network'])
const AI_CODES = new Set(['not_configured', 'auth', 'no_credit', 'unsupported_model', 'rate_limited', 'unavailable', 'network', 'refused', 'incomplete', 'invalid', 'failed'])

async function post<T>(path: string, body: unknown, known: Set<string>, unknownCode: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ReadingError('network')
  }
  // When the API server is down, the Vite proxy answers with an empty or non-JSON error.
  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!json) throw new ReadingError('network')
  if (!response.ok) throw new ReadingError(json.error && known.has(json.error) ? json.error : unknownCode)
  return json
}

export const requestArticle = (url: string) =>
  post<LoadedArticle>('/api/reading/extract', { url }, READING_CODES, 'fetch_failed')

export const requestLevel = (text: string) =>
  post<{ estimate: LevelEstimate; usage: AiUsage }>('/api/ai/level', { text }, AI_CODES, 'failed')
