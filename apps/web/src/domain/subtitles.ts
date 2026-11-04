import type { Cue } from './types'

/** Used when a format gives a start time but no end, until the next line begins. */
const DEFAULT_CUE_SECONDS = 4

const TIMING = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/
/** A line that is only a time, or a time then text, as in YouTube's "Show transcript" panel. */
const PLAIN_TIME = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\s+(.*))?$/

const seconds = (h: string | undefined, m: string, s: string, ms = '0') =>
  Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, name: string) => ENTITIES[name]!)
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTimed(lines: string[]): Cue[] {
  const cues: Cue[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const match = TIMING.exec(lines[i]!)
    if (!match) continue
    const text: string[] = []
    for (i += 1; i < lines.length && lines[i]!.trim() && !TIMING.test(lines[i]!); i += 1) text.push(lines[i]!)
    // A blank line ended the block, or the next timing did, which the loop must see again.
    if (TIMING.test(lines[i] ?? '')) i -= 1
    const cleaned = cleanText(text.join(' '))
    if (cleaned) {
      cues.push({
        startSec: seconds(match[1], match[2]!, match[3]!, match[4]),
        endSec: seconds(match[5], match[6]!, match[7]!, match[8]),
        text: cleaned,
      })
    }
  }
  return cues
}

function parsePlain(lines: string[]): Cue[] {
  const starts: { startSec: number; text: string[] }[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = PLAIN_TIME.exec(trimmed)
    if (match) starts.push({ startSec: seconds(match[1], match[2]!, match[3]!), text: match[4] ? [match[4]] : [] })
    else starts.at(-1)?.text.push(trimmed)
  }
  return starts
    .map((start, index) => ({
      startSec: start.startSec,
      endSec: starts[index + 1]?.startSec ?? start.startSec + DEFAULT_CUE_SECONDS,
      text: cleanText(start.text.join(' ')),
    }))
    .filter((cue) => cue.text)
}

/** Automatic captions repeat each line as it scrolls in, which would make the transcript stutter. */
function removeRollingRepeats(cues: Cue[]): Cue[] {
  const result: Cue[] = []
  for (const cue of cues) {
    const previous = result.at(-1)
    if (!previous) {
      result.push({ ...cue })
    } else if (cue.text === previous.text) {
      previous.endSec = Math.max(previous.endSec, cue.endSec)
    } else if (cue.text.startsWith(`${previous.text} `)) {
      result.push({ ...cue, text: cue.text.slice(previous.text.length + 1) })
    } else {
      result.push({ ...cue })
    }
  }
  return result
}

/** Reads SRT, WebVTT, or text copied from YouTube's "Show transcript". Empty if it finds none. */
export function parseSubtitles(content: string): Cue[] {
  const lines = content.replace(/^﻿/, '').split(/\r?\n/)
  const parsed = lines.some((line) => TIMING.test(line)) ? parseTimed(lines) : parsePlain(lines)
  const sorted = parsed
    .filter((cue) => cue.endSec >= cue.startSec)
    .sort((a, b) => a.startSec - b.startSec)
  return removeRollingRepeats(sorted)
}

/** The line playing at this time, or the last one started during a silence. -1 before the first. */
export function cueIndexAt(cues: readonly Cue[], time: number): number {
  let [low, high, found] = [0, cues.length - 1, -1]
  while (low <= high) {
    const middle = (low + high) >> 1
    if (cues[middle]!.startSec <= time) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return found
}

export function formatTime(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds))
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** The id from any usual form of YouTube link, or from the id on its own. */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim()
  if (/^[\w-]{11}$/.test(value)) return value
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null | undefined
  if (host === 'youtu.be') id = url.pathname.split('/')[1]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(embed|shorts|live|v)\/([^/]+)/.exec(url.pathname)?.[2]
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}
