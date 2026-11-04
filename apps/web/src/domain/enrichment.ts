import { cellOf, cellToPatch, fieldOf } from './rows'
import { formatArrowList, isUrl, parseArrowList } from './text'
import type { CoreField, Deck, Entry, EnrichmentDraft, FieldDef } from './types'

/** Requests stay small so that one bad entry can only hold up a few others. */
export const ENRICH_BATCH_SIZE = 5

/** The fields AI can suggest. Own examples are deliberately not among them. */
const DRAFT_FIELDS = ['priority', 'kind', 'meanings', 'tone', 'context', 'realExamples', 'variations', 'collocations'] as const
type DraftField = (typeof DRAFT_FIELDS)[number]

const isDraftField = (target: CoreField | undefined): target is DraftField =>
  (DRAFT_FIELDS as readonly (CoreField | undefined)[]).includes(target)

/** A URL names no vocabulary and the model can't open it, so the user has to choose the word. */
export function needsManualText(entry: Entry): boolean {
  return entry.enrichment === 'empty' && isUrl(entry.text)
}

/** Whether the queue should send this entry to AI on its own. */
export function canAutoEnrich(entry: Entry, deck: Deck | undefined): boolean {
  return (
    Boolean(deck?.schema.languageFeatures) &&
    entry.enrichment === 'empty' &&
    !entry.aiError &&
    !needsManualText(entry)
  )
}

const optionsOf = (deck: Deck, target: CoreField) => fieldOf(deck, target)?.options ?? []

/** Only what the model needs: the text, a kind hint and the deck's option lists. */
export function enrichmentRequest(entries: readonly Entry[], deck: Deck) {
  return {
    items: entries.map(({ id, text, kind }) => ({
      id,
      text,
      ...(kind && kind !== 'N/A' ? { kindHint: kind } : {}),
    })),
    options: {
      kinds: optionsOf(deck, 'kind'),
      tones: optionsOf(deck, 'tone'),
      contexts: optionsOf(deck, 'context'),
    },
  }
}

export function draftCell(draft: EnrichmentDraft, field: FieldDef): string {
  const { target } = field
  if (!isDraftField(target)) return ''
  if (target === 'priority') return String(draft.priority)
  const value = draft[target]
  return Array.isArray(value) ? formatArrowList(value) : value
}

/** The fields shown side by side, in the deck's column order. */
export function reviewFields(deck: Deck): FieldDef[] {
  return deck.schema.fields.filter((field) => isDraftField(field.target))
}

/**
 * Whether the user already chose this value, in which case the draft must not replace it.
 * The kind never counts, because Quick Add only guesses it and the model saw that as a hint.
 */
function isUserValue(entry: Entry, field: FieldDef): boolean {
  if (field.target === 'kind') return false
  if (field.target === 'priority') return entry.priority > 0
  return Boolean(cellOf(entry, field).trim())
}

/** Starting values for the review form. */
export function initialCells(entry: Entry, deck: Deck, draft: EnrichmentDraft): Record<string, string> {
  return Object.fromEntries(
    reviewFields(deck).map((field) => [
      field.key,
      isUserValue(entry, field) ? cellOf(entry, field) : draftCell(draft, field),
    ]),
  )
}

export interface ReviewedValues {
  cells: Record<string, string>
  ownExamples: string
  ipa: string
  notes: string
}

/** Everything saved when the user confirms a draft. The draft itself is discarded. */
export function confirmPatch(entry: Entry, deck: Deck, values: ReviewedValues): Partial<Entry> {
  let patch: Partial<Entry> = {}
  for (const field of reviewFields(deck)) {
    patch = { ...patch, ...cellToPatch(entry, field, values.cells[field.key] ?? '') }
  }
  return {
    ...patch,
    ownExamples: parseArrowList(values.ownExamples),
    ipa: values.ipa.trim() || undefined,
    notes: values.notes.trim() || undefined,
    enrichment: 'confirmed',
    aiDraft: undefined,
    aiError: undefined,
  }
}

/** Adds a sentence the user wrote to the text of their examples cell. */
export function appendOwnExample(cell: string, sentence: string): string {
  const addition = formatArrowList([sentence.trim()])
  return cell.trim() ? `${cell.trimEnd()}\n${addition}` : addition
}

/** The part of the entry the feedback is judged against. Unconfirmed entries use their draft. */
export function feedbackTarget(entry: Entry) {
  const meanings = entry.meanings.length ? entry.meanings : (entry.aiDraft?.meanings ?? [])
  return {
    text: entry.text,
    meanings: meanings.slice(0, 6),
    tone: entry.tone || entry.aiDraft?.tone || '',
    context: entry.context || entry.aiDraft?.context || '',
  }
}

export const sameSentence = (a: string, b: string) => a.trim() === b.trim()
