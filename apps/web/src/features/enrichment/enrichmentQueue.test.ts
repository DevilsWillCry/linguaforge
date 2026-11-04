import { beforeEach, describe, expect, it } from 'vitest'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_DECK_ID, VUE_SCHEMA } from '@/domain/deckPresets'
import { createEntry } from '@/domain/rows'
import type { Deck, Enrichment, Entry } from '@/domain/types'
import { AiRequestError, type EnrichRequest, type EnrichResponse } from './enrichmentApi'
import { runEnrichmentQueue, type QueueDeps } from './enrichmentQueue'

const NOW = new Date('2026-11-04T12:00:00Z')
const english: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: NOW.toISOString() }
const vue: Deck = { id: VUE_DECK_ID, name: 'Vue', schema: VUE_SCHEMA, createdAt: NOW.toISOString() }

const draftFor = (id: string) => ({
  id,
  kind: 'Word',
  meanings: ['m'],
  tone: 'Casual',
  context: 'Workplace',
  realExamples: [],
  variations: [],
  collocations: [],
  ipa: '',
  notes: '',
  priority: 3,
})

let entries: Entry[]
let calls: EnrichRequest[]
let tokens: number

function deps(
  enrich: (request: EnrichRequest) => Promise<EnrichResponse> | EnrichResponse = (request) => ({
    results: request.items.map((item) => draftFor(item.id)),
    usage: { inputTokens: 10, outputTokens: 5 },
  }),
  budgetLeft = () => true,
): QueueDeps {
  return {
    listDecks: async () => [english, vue],
    listUnconfirmed: async () => entries.filter((entry) => entry.enrichment !== 'confirmed'),
    moveEnrichment: async (ids: string[], from: Enrichment, change: Partial<Entry>) => {
      entries = entries.map((entry) =>
        ids.includes(entry.id) && entry.enrichment === from ? { ...entry, ...change } : entry,
      )
    },
    enrich: async (request) => {
      calls.push(request)
      return enrich(request)
    },
    budgetLeft,
    spend: ({ inputTokens, outputTokens }) => {
      tokens += inputTokens + outputTokens
    },
  }
}

const words = (n: number) => Array.from({ length: n }, (_, i) => createEntry(english, `word${i}`, NOW, { id: `e${i}` }))
const stateOf = (id: string) => entries.find((entry) => entry.id === id)!

beforeEach(() => {
  entries = []
  calls = []
  tokens = 0
})

describe('runEnrichmentQueue', () => {
  it('drafts everything in batches of five and tracks the tokens', async () => {
    entries = words(7)
    const result = await runEnrichmentQueue(deps())
    expect(result).toEqual({ stopped: 'done', drafted: 7 })
    expect(calls.map((call) => call.items.length)).toEqual([5, 2])
    expect(entries.every((entry) => entry.enrichment === 'draft' && entry.aiDraft)).toBe(true)
    expect(tokens).toBe(30)
  })

  it('never sends other decks to AI', async () => {
    entries = [createEntry(vue, 'ref()', NOW)]
    expect(await runEnrichmentQueue(deps())).toEqual({ stopped: 'done', drafted: 0 })
    expect(calls).toHaveLength(0)
  })

  it('does not overwrite an entry the user confirmed while waiting', async () => {
    entries = words(1)
    await runEnrichmentQueue(
      deps((request) => {
        // The user types into the entry while the request is running.
        entries = entries.map((entry) => ({ ...entry, enrichment: 'confirmed' as const, meanings: ['Mine'] }))
        return { results: request.items.map((item) => draftFor(item.id)), usage: { inputTokens: 0, outputTokens: 0 } }
      }),
    )
    expect(stateOf('e0').enrichment).toBe('confirmed')
    expect(stateOf('e0').meanings).toEqual(['Mine'])
    expect(stateOf('e0').aiDraft).toBeUndefined()
  })

  it('isolates the entry that spoils a batch, and the others still get drafts', async () => {
    entries = words(3)
    const result = await runEnrichmentQueue(
      deps((request) => {
        if (request.items.some((item) => item.text === 'word1')) throw new AiRequestError('refused')
        return { results: request.items.map((item) => draftFor(item.id)), usage: { inputTokens: 1, outputTokens: 1 } }
      }),
    )
    expect(result).toEqual({ stopped: 'done', drafted: 2 })
    expect(stateOf('e1')).toMatchObject({ enrichment: 'empty', aiError: 'refused' })
    expect(stateOf('e0').enrichment).toBe('draft')
    expect(stateOf('e2').enrichment).toBe('draft')
  })

  it('does not ask again for an entry that failed', async () => {
    entries = words(1)
    await runEnrichmentQueue(deps(() => { throw new AiRequestError('invalid') }))
    expect(calls).toHaveLength(1)
    await runEnrichmentQueue(deps(() => { throw new AiRequestError('invalid') }))
    expect(calls).toHaveLength(1)
  })

  it('marks an entry the model left out of its answer', async () => {
    entries = words(2)
    const result = await runEnrichmentQueue(
      deps(() => ({ results: [draftFor('e0')], usage: { inputTokens: 1, outputTokens: 1 } })),
    )
    expect(result.drafted).toBe(1)
    expect(stateOf('e1')).toMatchObject({ enrichment: 'empty', aiError: 'invalid' })
  })

  it.each(['network', 'auth', 'rate_limited', 'unavailable', 'failed'])(
    'pauses on %s and releases the entries with no error, so they run again later',
    async (code) => {
      entries = words(7)
      const result = await runEnrichmentQueue(deps(() => { throw new AiRequestError(code) }))
      expect(result).toEqual({ stopped: 'paused', drafted: 0, code })
      expect(calls).toHaveLength(1)
      expect(entries.every((entry) => entry.enrichment === 'empty' && !entry.aiError)).toBe(true)
    },
  )

  it('stops at the budget without sending anything', async () => {
    entries = words(2)
    expect(await runEnrichmentQueue(deps(undefined, () => false))).toEqual({ stopped: 'budget', drafted: 0 })
    expect(calls).toHaveLength(0)
    expect(stateOf('e0').enrichment).toBe('empty')
  })

  it('stops partway once the budget runs out', async () => {
    entries = words(7)
    const result = await runEnrichmentQueue(deps(undefined, () => calls.length < 1))
    expect(result).toEqual({ stopped: 'budget', drafted: 5 })
  })

  it('does not report the budget when nothing is waiting', async () => {
    expect(await runEnrichmentQueue(deps(undefined, () => false))).toEqual({ stopped: 'done', drafted: 0 })
  })
})
