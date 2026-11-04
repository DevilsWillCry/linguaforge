import { describe, expect, it } from 'vitest'
import { checkAnswer, makeCloze, redactTarget, suggestedRating } from './answers'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA } from './deckPresets'
import { LEECH_LAPSES, applyReview, buildQueue, isLeech, nextStatus, undoPatch } from './review'
import { createEntry } from './rows'
import { buildCard, chooseMode, modesFor } from './reviewCards'
import type { Deck, Entry } from './types'

const NOW = new Date('2026-11-04T12:00:00Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: NOW.toISOString() }
const card = (text = 'Figure out', overrides: Partial<Entry> = {}) =>
  createEntry(deck, text, NOW, { enrichment: 'confirmed', meanings: ['To solve'], ...overrides })
const answer = (rating: 1 | 2 | 3 | 4, mode: 'cloze' | 'production' | 'useIt' = 'cloze') =>
  ({ mode, rating, id: 'log', languageDeck: true }) as const
const withSrs = (entry: Entry, stability: number, modes: Entry['stats']['correctByMode'], used = false): Entry => ({
  ...entry,
  srs: { ...entry.srs, stability },
  stats: { correctByMode: modes, ...(used ? { lastUsedInOutputAt: NOW.toISOString() } : {}) },
})

describe('applyReview', () => {
  it('schedules further ahead for a better answer', () => {
    const due = (rating: 1 | 3 | 4) => applyReview(card(), answer(rating), NOW).patch.srs.due
    expect(due(1) < due(3)).toBe(true)
    expect(due(3) < due(4)).toBe(true)
    expect(due(1) > NOW.toISOString()).toBe(true)
  })

  it('counts Hard and better as correct, in the mode used', () => {
    expect(applyReview(card(), answer(1), NOW).patch.stats.correctByMode.cloze).toBeUndefined()
    expect(applyReview(card(), answer(2), NOW).patch.stats.correctByMode.cloze).toBe(1)
  })

  it('remembers the mode, and the use in output only when there was one', () => {
    const plain = applyReview(card(), answer(3), NOW).patch.stats
    expect(plain.lastMode).toBe('cloze')
    expect(plain.lastUsedInOutputAt).toBeUndefined()
    const used = applyReview(card(), { ...answer(3, 'useIt'), usedInOutput: true }, NOW).patch.stats
    expect(used.lastUsedInOutputAt).toBe(NOW.toISOString())
  })

  it('counts a lapse when a learned card is forgotten', () => {
    const review = { ...card().srs, state: 2, stability: 20, difficulty: 5, reps: 5, lastReview: '2026-10-01T00:00:00.000Z' }
    expect(applyReview(card('x', { srs: review }), answer(1), NOW).patch.srs.lapses).toBe(1)
  })

  it('can be undone exactly', () => {
    const original = card('x', { status: 'Learning', stats: { correctByMode: { production: 2 } } })
    const { patch, log } = applyReview(original, answer(3), NOW)
    const restored = { ...original, ...patch, ...undoPatch(log) }
    expect(restored.srs).toEqual(original.srs)
    expect(restored.stats).toEqual(original.stats)
    expect(restored.status).toBe('Learning')
  })
})

describe('nextStatus', () => {
  it('moves New to Learning on the first correct review, not on a wrong one', () => {
    expect(applyReview(card(), answer(3), NOW).patch.status).toBe('Learning')
    expect(applyReview(card(), answer(1), NOW).patch.status).toBe('New')
  })

  it('needs both the stability and two modes for Familiar', () => {
    const entry = card('x', { status: 'Learning' })
    expect(nextStatus(withSrs(entry, 7, { cloze: 3 }), true)).toBe('Learning')
    expect(nextStatus(withSrs(entry, 6.9, { cloze: 1, production: 1 }), true)).toBe('Learning')
    expect(nextStatus(withSrs(entry, 7, { cloze: 1, production: 1 }), true)).toBe('Familiar')
  })

  it('needs both the stability and real output for Natural', () => {
    const entry = card('x', { status: 'Familiar' })
    const modes = { cloze: 1, production: 1 }
    expect(nextStatus(withSrs(entry, 30, modes), true)).toBe('Familiar')
    expect(nextStatus(withSrs(entry, 29, modes, true), true)).toBe('Familiar')
    expect(nextStatus(withSrs(entry, 30, modes, true), true)).toBe('Natural')
  })

  it('never moves backwards on its own', () => {
    expect(nextStatus(withSrs(card('x', { status: 'Natural' }), 1, {}), true)).toBe('Natural')
    expect(nextStatus(withSrs(card('x', { status: 'Familiar' }), 1, { cloze: 1 }), true)).toBe('Familiar')
  })

  it('leaves a status chosen by hand, and N/A, alone', () => {
    const ready = { cloze: 1, production: 1 }
    expect(nextStatus(withSrs(card('x', { status: 'New', statusManual: true }), 50, ready), true)).toBe('New')
    expect(nextStatus(withSrs(card('x', { status: 'N/A' }), 50, ready), true)).toBe('N/A')
  })

  it('lets other decks reach Familiar with one mode, but not Natural', () => {
    expect(nextStatus(withSrs(card('x', { status: 'Learning' }), 40, { production: 2 }), false)).toBe('Familiar')
  })
})

describe('isLeech', () => {
  it('flags a card at the threshold', () => {
    expect(isLeech({ srs: { ...card().srs, lapses: LEECH_LAPSES - 1 } })).toBe(false)
    expect(isLeech({ srs: { ...card().srs, lapses: LEECH_LAPSES } })).toBe(true)
  })
})

describe('buildQueue', () => {
  const due = (text: string, overrides: Partial<Entry> = {}) => card(text, { id: text, ...overrides })

  it('takes only confirmed cards that are due', () => {
    const later = { ...card().srs, due: '2026-12-01T00:00:00.000Z' }
    const entries = [due('a'), due('draft', { enrichment: 'draft' }), due('empty', { enrichment: 'empty' }), due('later', { srs: later })]
    expect(buildQueue(entries, 10, NOW).map((e) => e.id)).toEqual(['a'])
  })

  it('keeps the highest priorities when capped', () => {
    const entries = [due('low', { priority: 1 }), due('high', { priority: 5 }), due('mid', { priority: 3 })]
    expect(buildQueue(entries, 2, NOW).map((e) => e.id).sort()).toEqual(['high', 'mid'])
    expect(buildQueue(entries, 0, NOW)).toEqual([])
  })

  it('separates similar items when it can', () => {
    const same = { kind: 'Word', context: 'Workplace', priority: 5 }
    const other = { kind: 'Idiom', context: 'Gaming', priority: 1 }
    const ids = buildQueue([due('a', same), due('b', same), due('c', other)], 10, NOW).map((e) => e.id)
    expect(ids).toEqual(['a', 'c', 'b'])
  })
})

describe('checkAnswer', () => {
  it.each([
    ['Figure out', 'figure out', 'correct'],
    ["There's no way...", "there's no way", 'correct'],
    ["I'm down", 'I’m down', 'correct'],
    ['Figure out', 'figured out', 'close'],
    ['Incidentally', 'incidentaly', 'close'],
    ['Figure out', 'find out', 'wrong'],
    ['Figure out', '', 'wrong'],
    ['Figure out', '   ', 'wrong'],
    ['May', 'Say', 'wrong'],
  ] as const)('%s vs "%s" is %s', (expected, typed, result) => {
    expect(checkAnswer(expected, typed)).toBe(result)
  })

  it('suggests a grade', () => {
    expect([suggestedRating('wrong'), suggestedRating('close'), suggestedRating('correct')]).toEqual([1, 2, 3])
  })
})

describe('makeCloze', () => {
  it('hides an inflected use and keeps it as the answer', () => {
    const cloze = makeCloze("I think I've figured out how it works.", 'Figure out')
    expect(cloze?.answer).toBe('figured out')
    expect(cloze?.parts.map((p) => p.hidden)).toEqual([false, true, false])
    expect(cloze?.parts.map((p) => p.text).join('')).toBe("I think I've figured out how it works.")
  })

  it('hides every use, so none gives the answer away', () => {
    expect(makeCloze('Borrow it, then borrow more.', 'Borrow')?.parts.filter((p) => p.hidden)).toHaveLength(2)
  })

  it('ignores the dots in a pattern', () => {
    expect(makeCloze("There's no way she did it", "There's no way...")?.answer).toBe("There's no way")
  })

  it('does not match inside a longer word or a split phrase', () => {
    expect(makeCloze('Maybe tomorrow', 'May')).toBeNull()
    expect(makeCloze('We need to figure this bug out', 'Figure out')).toBeNull()
  })
})

describe('redactTarget', () => {
  it('removes the target from a prompt', () => {
    expect(redactTarget('To borrow something', 'Borrow')).toBe('To _____ something')
    expect(redactTarget('Nothing to hide', 'Borrow')).toBe('Nothing to hide')
  })
})

describe('review cards', () => {
  const vueDeck: Deck = { ...deck, id: 'vue', schema: { languageFeatures: false, fields: [] } }
  const full = card('Figure out', {
    meanings: ['To figure out a problem — resolver'],
    realExamples: ['I figured out the bug.', 'We need to figure this bug out.'],
  })

  it('offers only the modes the entry has material for', () => {
    expect(modesFor(full, deck, { canSpeak: true })).toEqual(['cloze', 'production', 'listening', 'useIt'])
    expect(modesFor(full, deck, { canSpeak: false })).toEqual(['cloze', 'production', 'useIt'])
    expect(modesFor(card('Such', { meanings: [] }), deck, { canSpeak: false })).toEqual([])
    expect(modesFor(card('x', { meanings: [] }), deck, { canSpeak: true })).toEqual(['listening'])
  })

  it('has only production in other decks, and needs a description', () => {
    const concept = card('ref()', { meanings: [], custom: { whatItDoes: 'Estado reactivo' } })
    expect(modesFor(concept, vueDeck, { canSpeak: true })).toEqual(['production'])
    expect(modesFor(card('x', { meanings: [] }), vueDeck, { canSpeak: true })).toEqual([])
  })

  it('rotates to the next mode and wraps around', () => {
    const all = ['cloze', 'production', 'listening', 'useIt'] as const
    expect(chooseMode(all, undefined)).toBe('cloze')
    expect(chooseMode(all, 'cloze')).toBe('production')
    expect(chooseMode(all, 'useIt')).toBe('cloze')
    expect(chooseMode(['cloze', 'useIt'], 'cloze')).toBe('useIt')
    expect(chooseMode(['production'], 'production')).toBe('production')
    expect(chooseMode([], 'cloze')).toBeUndefined()
  })

  it('never shows the answer in the question', () => {
    const cloze = buildCard(full, 'cloze')
    if (cloze.mode !== 'cloze') throw new Error('wrong mode')
    const visible = cloze.parts.filter((part) => !part.hidden).map((part) => part.text).join(' ') + cloze.hint.join(' ')
    expect(visible.toLowerCase()).not.toContain('figure')

    const production = buildCard(full, 'production')
    if (production.mode !== 'production') throw new Error('wrong mode')
    expect(production.clues[0]).toBe('To _____ a problem — resolver')
  })

  it('reads a sentence containing the item, or else the item itself', () => {
    const listening = buildCard(full, 'listening')
    expect(listening).toMatchObject({ mode: 'listening', speech: 'I figured out the bug.' })
    expect(buildCard(card('Such', { meanings: [] }), 'listening')).toMatchObject({ speech: 'Such' })
  })

  it('does not ask for a long dialogue by ear', () => {
    const dialogue = card('Borrow', { ownExamples: ['A: Can I borrow it?\nB: Sure.'] })
    expect(buildCard(dialogue, 'listening')).toMatchObject({ speech: 'Borrow' })
  })

  it('uses a different sentence as the review count grows', () => {
    const two = { ...full, realExamples: ['I borrow it.', 'They borrow them.'], text: 'Borrow' }
    const first = buildCard(two, 'cloze')
    const second = buildCard({ ...two, srs: { ...two.srs, reps: 1 } }, 'cloze')
    expect(first).not.toEqual(second)
  })
})
