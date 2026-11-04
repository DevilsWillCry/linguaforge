import { ENRICH_BATCH_SIZE, canAutoEnrich, enrichmentRequest } from '@/domain/enrichment'
import type { Deck, Enrichment, Entry } from '@/domain/types'
import { AiRequestError, type AiUsage, type EnrichRequest, type EnrichResponse } from './enrichmentApi'

export interface QueueDeps {
  listDecks(): Promise<Deck[]>
  listUnconfirmed(): Promise<Entry[]>
  moveEnrichment(ids: string[], from: Enrichment, change: Partial<Entry>): Promise<void>
  enrich(request: EnrichRequest): Promise<EnrichResponse>
  budgetLeft(): boolean
  spend(usage: AiUsage): void
}

export type QueueResult =
  | { stopped: 'done'; drafted: number }
  | { stopped: 'budget'; drafted: number }
  | { stopped: 'paused'; drafted: number; code: string }

/** Problems with this content rather than with the service, so other entries can still succeed. */
const ENTRY_PROBLEMS = new Set(['refused', 'incomplete', 'invalid', 'bad_request'])

class PauseQueue extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/**
 * Sends waiting entries to AI until none are left, the budget runs out or the service fails.
 * An entry that fails gets an `aiError` and is skipped until the user retries, so a word the
 * model always rejects can't keep spending credit. A service failure pauses the whole queue.
 */
export async function runEnrichmentQueue(deps: QueueDeps): Promise<QueueResult> {
  let drafted = 0

  async function process(entries: Entry[], deck: Deck): Promise<void> {
    const ids = entries.map((entry) => entry.id)
    try {
      const { results, usage } = await deps.enrich(enrichmentRequest(entries, deck))
      deps.spend(usage)
      for (const { id, ...aiDraft } of results) {
        await deps.moveEnrichment([id], 'pending', { enrichment: 'draft', aiDraft, aiError: undefined })
        drafted += 1
      }
      const answered = new Set(results.map((result) => result.id))
      const missing = ids.filter((id) => !answered.has(id))
      await deps.moveEnrichment(missing, 'pending', { enrichment: 'empty', aiError: 'invalid' })
    } catch (error) {
      const code = error instanceof AiRequestError ? error.code : 'failed'
      if (!ENTRY_PROBLEMS.has(code)) {
        await deps.moveEnrichment(ids, 'pending', { enrichment: 'empty' })
        throw new PauseQueue(code)
      }
      if (entries.length === 1) {
        await deps.moveEnrichment(ids, 'pending', { enrichment: 'empty', aiError: code })
        return
      }
      // One entry may have spoiled the batch, so each gets its own chance.
      for (const entry of entries) await process([entry], deck)
    }
  }

  try {
    for (;;) {
      const [decks, entries] = await Promise.all([deps.listDecks(), deps.listUnconfirmed()])
      const deck = decks.find((candidate) =>
        entries.some((entry) => entry.deckId === candidate.id && canAutoEnrich(entry, candidate)),
      )
      if (!deck) return { stopped: 'done', drafted }
      if (!deps.budgetLeft()) return { stopped: 'budget', drafted }

      const batch = entries
        .filter((entry) => entry.deckId === deck.id && canAutoEnrich(entry, deck))
        .slice(0, ENRICH_BATCH_SIZE)
      await deps.moveEnrichment(batch.map((entry) => entry.id), 'empty', { enrichment: 'pending' })
      await process(batch, deck)
    }
  } catch (error) {
    if (error instanceof PauseQueue) return { stopped: 'paused', drafted, code: error.code }
    throw error
  }
}
