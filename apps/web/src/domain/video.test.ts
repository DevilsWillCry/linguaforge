import { describe, expect, it } from 'vitest'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA } from './deckPresets'
import { createEntry } from './rows'
import { cueIndexAt, formatTime, parseSubtitles, parseYouTubeId } from './subtitles'
import { buildPhraseIndex, clozeTargets, diffWords, segmentLine } from './transcriptWords'
import type { Deck } from './types'

const NOW = new Date('2026-11-04T12:00:00Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: NOW.toISOString() }
const entry = (text: string) => createEntry(deck, text, NOW)

describe('parseSubtitles', () => {
  it('reads SRT', () => {
    const srt = '1\n00:00:01,500 --> 00:00:03,000\nHello <i>there</i>\nfriend\n\n2\n00:00:03,000 --> 00:00:04,250\nAT&amp;T calls\n'
    expect(parseSubtitles(srt)).toEqual([
      { startSec: 1.5, endSec: 3, text: 'Hello there friend' },
      { startSec: 3, endSec: 4.25, text: 'AT&T calls' },
    ])
  })

  it('reads WebVTT with a header, cue settings and Windows line ends', () => {
    const vtt = 'WEBVTT\r\n\r\nNOTE a comment\r\n\r\n00:05.000 --> 00:07.000 align:start\r\n<c.yellow>Hi</c>\r\n'
    expect(parseSubtitles(vtt)).toEqual([{ startSec: 5, endSec: 7, text: 'Hi' }])
  })

  it('handles times past one hour', () => {
    expect(parseSubtitles('01:02:03.000 --> 01:02:04.000\nLate')[0]?.startSec).toBe(3723)
  })

  it('reads text copied from YouTube, on separate lines or together', () => {
    expect(parseSubtitles('0:05\nFirst line\n0:09\nSecond\nmore\n1:02:00\nLast')).toEqual([
      { startSec: 5, endSec: 9, text: 'First line' },
      { startSec: 9, endSec: 3720, text: 'Second more' },
      { startSec: 3720, endSec: 3724, text: 'Last' },
    ])
    expect(parseSubtitles('0:05 First\n0:09 Second')[1]).toEqual({ startSec: 9, endSec: 13, text: 'Second' })
  })

  it('removes the repeats of rolling automatic captions', () => {
    const vtt = [
      '00:01.000 --> 00:02.000', 'we need to', '',
      '00:02.000 --> 00:03.000', 'we need to', '',
      '00:03.000 --> 00:04.000', 'we need to figure it out', '',
    ].join('\n')
    expect(parseSubtitles(vtt).map((cue) => cue.text)).toEqual(['we need to', 'figure it out'])
  })

  it('keeps a line that has no blank line before the next timing', () => {
    expect(parseSubtitles('00:01.000 --> 00:02.000\nOne\n00:02.000 --> 00:03.000\nTwo').map((c) => c.text)).toEqual(['One', 'Two'])
  })

  it.each(['', 'just some text', 'WEBVTT\n\n'])('finds nothing in %j', (content) => {
    expect(parseSubtitles(content)).toEqual([])
  })
})

describe('cueIndexAt', () => {
  const cues = [
    { startSec: 1, endSec: 2, text: 'a' },
    { startSec: 5, endSec: 6, text: 'b' },
  ]
  it('finds the line for a time', () => {
    expect([0, 1, 1.5, 3, 5, 100].map((time) => cueIndexAt(cues, time))).toEqual([-1, 0, 0, 0, 1, 1])
    expect(cueIndexAt([], 3)).toBe(-1)
  })
})

describe('formatTime', () => {
  it('formats short and long times', () => {
    expect([formatTime(5), formatTime(65.9), formatTime(3725)]).toEqual(['0:05', '1:05', '1:02:05'])
  })
})

describe('parseYouTubeId', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'dQw4w9WgXcQ',
  ])('reads %s', (input) => {
    expect(parseYouTubeId(input)).toBe('dQw4w9WgXcQ')
  })

  it.each(['', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', 'not a link', 'https://youtube.evil.com/watch?v=dQw4w9WgXcQ'])(
    'rejects %j',
    (input) => {
      expect(parseYouTubeId(input)).toBeNull()
    },
  )
})

describe('segmentLine', () => {
  const index = buildPhraseIndex([entry('Figure out'), entry('Figure'), entry('Borrow')])

  it('keeps the whole text, and marks Library items with inflection', () => {
    const line = "We figured out, then I'd borrowed it."
    const segments = segmentLine(line, index)
    expect(segments.map((s) => s.text).join('')).toBe(line)
    expect(segments.filter((s) => s.entry).map((s) => [s.text, s.entry!.text])).toEqual([
      ['figured out', 'Figure out'],
      ['borrowed', 'Borrow'],
    ])
  })

  it('prefers the longest phrase', () => {
    expect(segmentLine('a figure of speech', index).find((s) => s.entry)?.entry?.text).toBe('Figure')
  })

  it('marks words and leaves punctuation out', () => {
    expect(segmentLine('Hi, you', index)).toEqual([
      { text: 'Hi', isWord: true },
      { text: ', ', isWord: false },
      { text: 'you', isWord: true },
    ])
  })
})

describe('clozeTargets', () => {
  const index = buildPhraseIndex([entry('Borrow')])
  it('hides Library items first', () => {
    const segments = segmentLine('Please borrow extraordinary things', index)
    expect([...clozeTargets(segments)].map((i) => segments[i]!.text)).toEqual(['borrow'])
  })
  it('otherwise hides the longest word', () => {
    const segments = segmentLine('Please say extraordinary things', index)
    expect([...clozeTargets(segments)].map((i) => segments[i]!.text)).toEqual(['extraordinary'])
  })
  it('hides nothing in a line with only short words', () => {
    expect(clozeTargets(segmentLine('oh no', index)).size).toBe(0)
  })
})

describe('diffWords', () => {
  it('gives full marks to the same words, ignoring case and punctuation', () => {
    expect(diffWords('Can I borrow it?', 'can i borrow it').score).toBe(100)
  })
  it('shows missing and extra words', () => {
    const { words, score } = diffWords('can i borrow your pen', 'can you borrow pen')
    expect(words).toEqual([
      { word: 'can', kind: 'same' },
      { word: 'i', kind: 'missing' },
      { word: 'you', kind: 'extra' },
      { word: 'borrow', kind: 'same' },
      { word: 'your', kind: 'missing' },
      { word: 'pen', kind: 'same' },
    ])
    expect(score).toBe(60)
  })
  it('scores an empty answer as zero', () => {
    expect(diffWords('hello there', '').score).toBe(0)
    expect(diffWords('', '').score).toBe(0)
  })
})
