/**
 * Tries the draft prompts against the real API, for tuning them. It spends a little credit.
 *
 *   pnpm --filter @linguaforge/server enrich:try "figure out" "Shall"
 */
import { LOCAL_USER_ID } from './auth.js'
import { enrichEntries } from './ai/enrichment.js'
import { DEFAULT_ANTHROPIC_MODEL, createProvider, type ProviderConfig } from './ai/providers.js'
import { createLocalSettings } from './ai/settings.js'

const CONTEXTS = [
  'Daily Conversation', 'Workplace', 'Friendly', 'Gaming', 'Arguments',
  'School / College', 'Small Talk', 'Business', 'Coding / Tech',
]
const TONES = [
  'Casual', 'Informal', 'Formal', 'Polite', 'Neutral', 'Emotional', 'Excited',
  'Sarcastic', 'Confident', 'Awkward', 'Romantic', 'Aggressive', 'Rude', 'Funny',
  'Motivational', 'Frustrated', 'Chill', 'Internet Slang', 'Professional', 'Dramatic',
]
const KINDS = [
  'Word', 'Expression', 'Slang', 'Idiom', 'Connector',
  'Sentence Pattern', 'Phrasal Verb', 'Modal Verb', 'N/A',
]

const texts = process.argv.slice(2).slice(0, 5)
if (!texts.length) {
  console.error('Give at least one word or phrase.')
  process.exit(1)
}

// Uses the AI chosen in Settings, or else the key in .env, just as the app does.
const { store, box } = await createLocalSettings(process.env)
const saved = await store.get(LOCAL_USER_ID)
let config: ProviderConfig
if (saved) {
  const apiKey = saved.encryptedKey ? box.open(saved.encryptedKey, LOCAL_USER_ID) : undefined
  config = { provider: saved.provider, model: saved.model, baseUrl: saved.baseUrl, apiKey: apiKey ?? undefined }
} else if (process.env.ANTHROPIC_API_KEY) {
  config = {
    provider: 'anthropic',
    model: process.env.ANTHROPIC_FAST_MODEL || DEFAULT_ANTHROPIC_MODEL,
    apiKey: process.env.ANTHROPIC_API_KEY,
  }
} else {
  console.error('Set up an AI in Settings, or add ANTHROPIC_API_KEY to .env.')
  process.exit(1)
}

const { results, usage } = await enrichEntries(createProvider(config), {
  items: texts.map((text, index) => ({ id: String(index + 1), text })),
  options: { kinds: KINDS, tones: TONES, contexts: CONTEXTS },
})
console.log(JSON.stringify(results, null, 2))
console.log(`${config.provider} / ${config.model}. Tokens: ${usage.inputTokens} in, ${usage.outputTokens} out.`)
