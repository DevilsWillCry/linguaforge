import { entryRepository } from '@/data/repositories'
import { quickAddEntry } from '@/domain/rows'
import { normalizeText } from '@/domain/text'
import type { Deck, Entry, EntrySource } from '@/domain/types'

/** A word or phrase picked from a video or a page, with the sentence it appeared in. */
export interface Capture {
  text: string
  sentence: string
  entry?: Entry
}

export interface SavedCapture {
  created: boolean
  name: string
}

/** Adds a capture to the Library, or adds its sentence to the entry that already exists. */
export async function saveCapture(
  capture: Capture,
  text: string,
  deck: Deck,
  source: EntrySource,
  trigger: string,
): Promise<SavedCapture> {
  const value = text.trim()
  const existing = capture.entry ?? (await entryRepository.findByText(deck.id, normalizeText(value)))
  const sentence = capture.sentence.trim()
  if (existing) {
    const realExamples = !sentence || existing.realExamples.includes(sentence) ? existing.realExamples : [...existing.realExamples, sentence]
    await entryRepository.patch(existing.id, {
      realExamples,
      // The first source found stays, so its button keeps opening what the user saved.
      ...(existing.source.videoId || existing.source.url ? {} : { source }),
    })
    return { created: false, name: existing.text }
  }
  const entry = quickAddEntry(value, deck, new Date(), { source, trigger })
  await entryRepository.add({ ...entry, realExamples: sentence ? [sentence] : [] })
  return { created: true, name: value }
}
