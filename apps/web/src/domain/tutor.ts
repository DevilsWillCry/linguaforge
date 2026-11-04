import { urgency } from './review'
import type { Entry, TutorConversation } from './types'

export const TARGET_COUNT = 5

/** Today's practice items: what's due first, then whatever is least settled in memory. */
export function pickTargets(entries: readonly Entry[], now: Date = new Date(), count = TARGET_COUNT): Entry[] {
  const nowIso = now.toISOString()
  const usable = entries.filter((entry) => entry.enrichment === 'confirmed' && entry.meanings.length > 0)
  const due = usable.filter((entry) => entry.srs.due <= nowIso).sort((a, b) => urgency(b, now) - urgency(a, now) || a.id.localeCompare(b.id))
  const later = usable
    .filter((entry) => entry.srs.due > nowIso)
    .sort((a, b) => a.srs.stability - b.srs.stability || a.id.localeCompare(b.id))
  return [...due, ...later].slice(0, count)
}

export const targetPayload = (entries: readonly Entry[]) =>
  entries.map((entry) => ({ text: entry.text, meaning: (entry.meanings[0] ?? '').slice(0, 300) }))

/** The server accepts this many past lines, which is plenty of context for a roleplay. */
const HISTORY_LIMIT = 40
const MAX_LINE_CHARS = 2000

export const historyPayload = (conversation: TutorConversation) =>
  conversation.messages.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content: content.slice(0, MAX_LINE_CHARS) }))

export const usedTargetsOf = (conversation: TutorConversation | null) =>
  new Set(conversation?.messages.flatMap((message) => message.usedTargets ?? []) ?? [])

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
