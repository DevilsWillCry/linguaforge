import { describe, expect, it } from 'vitest'
import { readyToPlay } from './pacing'

describe('readyToPlay', () => {
  it('starts as soon as nothing is left to generate', () => {
    expect(readyToPlay({ bufferedSeconds: 1, remainingChars: 0, generationRate: 3 })).toBe(true)
  })

  it('waits when the rest would take longer to generate than what is ready lasts', () => {
    // A short greeting, then a long sentence that takes about 9 s on a slow computer.
    expect(readyToPlay({ bufferedSeconds: 1.7, remainingChars: 80, generationRate: 1.8 })).toBe(false)
  })

  it('starts when what is ready covers generating the rest', () => {
    expect(readyToPlay({ bufferedSeconds: 6, remainingChars: 40, generationRate: 1.8 })).toBe(true)
  })

  it('starts sooner on a computer that generates quickly', () => {
    const pace = { bufferedSeconds: 2, remainingChars: 80 }
    expect(readyToPlay({ ...pace, generationRate: 2 })).toBe(false)
    expect(readyToPlay({ ...pace, generationRate: 0.3 })).toBe(true)
  })
})
