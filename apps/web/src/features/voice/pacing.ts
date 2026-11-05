/** Spoken English runs at about this pace. Measured on the model's own output: 7.1 s for 108 characters. */
const SECONDS_PER_CHAR = 0.066

/** How long to keep someone waiting for smooth speech before accepting a pause in it. */
export const MAX_HOLD_MS = 8000

interface Pace {
  /** Audio generated and not yet played. */
  bufferedSeconds: number
  /** Text the model hasn't reached yet. */
  remainingChars: number
  /** Seconds of work per second of audio so far. Above 1 means slower than speech. */
  generationRate: number
}

/**
 * The model can generate more slowly than people speak, and only whole sentences at a
 * time. Starting at once would leave long silences in the middle of a reply, so audio
 * waits until what's ready lasts as long as generating the rest should take.
 */
export function readyToPlay({ bufferedSeconds, remainingChars, generationRate }: Pace): boolean {
  if (remainingChars <= 0) return true
  return bufferedSeconds >= remainingChars * SECONDS_PER_CHAR * generationRate
}
