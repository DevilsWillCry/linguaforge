import { cellOf } from './rows'
import { parseArrowList } from './text'
import type { CoreField, Deck, Entry, FieldDef } from './types'

/** Columns that track or locate an entry, which don't belong on the back of a card. */
const HIDDEN_ON_CARD: readonly CoreField[] = [
  'text', 'priority', 'status', 'importance', 'trigger', 'source',
]

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Anki's text import is line and tab based, so neither may appear inside a value. */
const toCardHtml = (text: string) =>
  escapeHtml(text).replace(/\t/g, ' ').replace(/\r?\n/g, '<br>')

function renderField(entry: Entry, field: FieldDef): string {
  const cell = cellOf(entry, field)
  if (!cell.trim()) return ''
  const items = field.type === 'list' ? parseArrowList(cell) : [cell]
  return `<b>${escapeHtml(field.column)}</b><br>${items.map(toCardHtml).join('<br>')}`
}

/**
 * Builds a file for Anki's "Import File". The # lines tell Anki how to read it.
 * Unconfirmed entries are skipped: their cards would have no back, or unreviewed AI text.
 */
export function toAnkiText(entries: readonly Entry[], deck: Deck): string {
  const fields = deck.schema.fields.filter((f) => !(f.target && HIDDEN_ON_CARD.includes(f.target)))
  const lines = entries
    .filter((entry) => entry.enrichment === 'confirmed')
    .map((entry) => {
      const back = fields.map((field) => renderField(entry, field)).filter(Boolean).join('<br><br>')
      const tags = entry.tags.map((tag) => tag.trim().replace(/\s+/g, '_')).join(' ')
      return [toCardHtml(entry.text), back, tags].join('\t')
    })

  const safeDeckName = deck.name.replace(/[\t\r\n]/g, ' ')
  return [
    '#separator:tab',
    '#html:true',
    `#deck:LinguaForge::${safeDeckName}`,
    '#tags column:3',
    ...lines,
  ].join('\n')
}
