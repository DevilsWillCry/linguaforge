import { describe, expect, it } from 'vitest'
import { CONTEXTS, ENTRY_KINDS, IMPORTANCE_LEVELS, TONES } from '@/domain/types'
import { ENGLISH_SCHEMA, VUE_SCHEMA } from '@/domain/deckPresets'
import {
  BADGE_COLORS,
  CONTEXT_ICONS,
  FIELD_ICONS,
  IMPORTANCE_VISUALS,
  KIND_VISUALS,
  TONE_COLORS,
  colorFor,
  kindVisual,
  toneColor,
} from './fieldVisuals'

describe('preset options', () => {
  it.each([
    ['kind', ENTRY_KINDS, KIND_VISUALS],
    ['tone', TONES, TONE_COLORS],
    ['context', CONTEXTS, CONTEXT_ICONS],
    ['importance', IMPORTANCE_LEVELS, IMPORTANCE_VISUALS],
  ] as const)('every %s has a chosen visual', (_name, options, visuals) => {
    for (const option of options) expect(visuals).toHaveProperty([option])
  })

  it('every column in both decks has an icon', () => {
    for (const { key } of [...ENGLISH_SCHEMA.fields, ...VUE_SCHEMA.fields]) {
      expect(FIELD_ICONS).toHaveProperty([key])
    }
  })
})

describe('options added in Settings', () => {
  it('always get the same color', () => {
    expect(colorFor('Podcasts')).toBe(colorFor('Podcasts'))
  })

  it('get a color from the palette', () => {
    for (const value of ['Podcasts', 'Música', '日本語', '🎮', 'x']) {
      expect(BADGE_COLORS).toContain(colorFor(value))
    }
  })

  it('spread across the palette rather than sharing one color', () => {
    const values = ['Podcasts', 'Meetings', 'Travel', 'Movies', 'Sports', 'Family', 'Music', 'News']
    expect(new Set(values.map(colorFor)).size).toBeGreaterThan(3)
  })

  it('fall back without breaking', () => {
    expect(BADGE_COLORS).toContain(toneColor('Wistful'))
    expect(kindVisual('Proverb').icon).toBeDefined()
  })
})
