import {
  CONTEXTS,
  ENTRY_KINDS,
  IMPORTANCE_LEVELS,
  LEARNING_STATUSES,
  TONES,
  type DeckSchema,
} from './types'

export const ENGLISH_DECK_ID = 'deck-english'
export const VUE_DECK_ID = 'deck-vue3'

/** Column headers match the original spreadsheet exactly, including "Setence/Word". */
export const ENGLISH_SCHEMA: DeckSchema = {
  languageFeatures: true,
  fields: [
    { column: 'Priority', key: 'priority', type: 'number', target: 'priority' },
    { column: 'Use', key: 'kind', type: 'select', target: 'kind', options: [...ENTRY_KINDS] },
    { column: 'Setence/Word', key: 'text', type: 'text', target: 'text' },
    { column: 'Meaning/Idea', key: 'meanings', type: 'list', target: 'meanings' },
    { column: 'Emotional Tone', key: 'tone', type: 'select', target: 'tone', options: [...TONES] },
    { column: 'Context', key: 'context', type: 'select', target: 'context', options: [...CONTEXTS] },
    { column: 'Real Context', key: 'realExamples', type: 'list', target: 'realExamples' },
    { column: 'Own Example', key: 'ownExamples', type: 'list', target: 'ownExamples' },
    { column: 'Variations / Related Expressions', key: 'variations', type: 'list', target: 'variations' },
    { column: 'Collocations (Important)', key: 'collocations', type: 'list', target: 'collocations' },
    { column: 'Review Status', key: 'status', type: 'select', target: 'status', options: [...LEARNING_STATUSES] },
    { column: 'Trigger', key: 'trigger', type: 'text', target: 'trigger' },
    { column: 'Source URL', key: 'source', type: 'url', target: 'source' },
  ],
}

export const VUE_SCHEMA: DeckSchema = {
  languageFeatures: false,
  fields: [
    { column: 'Prioridad', key: 'priority', type: 'number', target: 'priority' },
    { column: 'Category', key: 'category', type: 'text' },
    { column: 'Concept / Feature', key: 'text', type: 'text', target: 'text' },
    { column: 'What It Does', key: 'whatItDoes', type: 'multiline' },
    { column: 'Syntax / Structure', key: 'syntax', type: 'multiline' },
    { column: 'Equivalent in React', key: 'reactEquivalent', type: 'multiline' },
    { column: 'Common Use Case', key: 'useCase', type: 'text' },
    { column: 'Important Notes', key: 'importantNotes', type: 'multiline' },
    { column: 'Mini Example', key: 'miniExample', type: 'multiline' },
    { column: 'Review Status', key: 'status', type: 'select', target: 'status', options: [...LEARNING_STATUSES] },
    // Not in the original sheet, which mixed these labels into "Review Status".
    // splitStatus() still reads them from there, so the original file keeps importing.
    { column: 'Importance', key: 'importance', type: 'select', target: 'importance', options: [...IMPORTANCE_LEVELS] },
    { column: 'Source URL', key: 'source', type: 'url', target: 'source' },
  ],
}

export const DECK_PRESETS = [
  { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, seedKey: 'english' },
  { id: VUE_DECK_ID, name: 'Vue 3 / Tech', schema: VUE_SCHEMA, seedKey: 'vue3' },
] as const
