import { describe, expect, it } from 'vitest'
import { ENGLISH_DECK_ID, ENGLISH_SCHEMA } from './deckPresets'
import { createEntry, entryToRow, rowToEntry } from './rows'
import { cleanWebLink, linkedSource, librarySources, sourceDestination, videoIdOfSource, webSearchUrl, youTubeSearchUrl } from './videoSources'
import type { Deck, EntrySource } from './types'

const ID = 'dQw4w9WgXcQ'
const OTHER = 'jNQXAC9IVRw'
const PAGE = 'https://example.com/post'
const NOW = new Date('2026-11-04T12:00:00Z')
const deck: Deck = { id: ENGLISH_DECK_ID, name: 'English', schema: ENGLISH_SCHEMA, createdAt: NOW.toISOString() }
const withSource = (source: EntrySource, text = 'x') => createEntry(deck, text, NOW, { source })

describe('videoIdOfSource', () => {
  it('reads the id or the link', () => {
    expect(videoIdOfSource({ videoId: ID })).toBe(ID)
    expect(videoIdOfSource({ url: `https://youtu.be/${ID}` })).toBe(ID)
    expect(videoIdOfSource({ title: 'Only a title' })).toBeNull()
    expect(videoIdOfSource({ url: PAGE })).toBeNull()
  })

  it('trusts the link over an id left behind by an edit', () => {
    expect(videoIdOfSource({ videoId: ID, url: `https://youtu.be/${OTHER}` })).toBe(OTHER)
  })
})

describe('cleanWebLink', () => {
  it('accepts web addresses', () => {
    expect(cleanWebLink(` ${PAGE} `)).toBe(PAGE)
  })
  it.each(['', undefined, 'not a link', 'javascript:alert(1)', 'file:///etc/passwd', 'https://a:b@example.com'])('rejects %j', (raw) => {
    expect(cleanWebLink(raw)).toBeNull()
  })
})

describe('sourceDestination', () => {
  it('sends videos and pages to the right lab', () => {
    expect(sourceDestination({ url: `https://youtu.be/${ID}` })).toEqual({ path: '/video', query: { v: ID } })
    expect(sourceDestination({ title: 'x', url: PAGE })).toEqual({ path: '/reading', query: { url: PAGE } })
  })
  it('has nowhere to send a title, or an unsafe link', () => {
    expect(sourceDestination({ title: 'x' })).toBeNull()
    expect(sourceDestination({ url: 'javascript:alert(1)' })).toBeNull()
  })
})

describe('librarySources', () => {
  it('joins entries from one source, whether by title, id or link', () => {
    const sources = librarySources([
      withSource({ title: 'A talk' }, 'a'),
      withSource({ title: ' a TALK ' }, 'b'),
      withSource({ videoId: ID, title: 'Clip' }, 'c'),
      withSource({ url: `https://youtu.be/${ID}` }, 'd'),
      withSource({ url: PAGE, title: 'Page' }, 'e'),
      withSource({ url: PAGE }, 'f'),
    ])
    expect(sources.map((s) => [s.title, s.kind, s.entryIds.length])).toEqual([
      ['A talk', 'unlinked', 2],
      ['Clip', 'video', 2],
      ['Page', 'page', 2],
    ])
  })

  it('lists what still needs a link first', () => {
    const sources = librarySources([withSource({ videoId: ID, title: 'Linked' }), withSource({ title: 'Zebra' })])
    expect(sources.map((s) => s.title)).toEqual(['Zebra', 'Linked'])
  })

  it('leaves out entries with no source', () => {
    expect(librarySources([withSource({})])).toEqual([])
  })
})

describe('search links', () => {
  it('encode the title', () => {
    expect(youTubeSearchUrl('"By the way" & #shorts')).toBe('https://www.youtube.com/results?search_query=%22By%20the%20way%22%20%26%20%23shorts')
    expect(webSearchUrl('a & b')).toBe('https://www.google.com/search?q=a%20%26%20b')
  })
})

describe('linkedSource', () => {
  it('keeps the title, and a video survives an export and import', () => {
    const linked = withSource(linkedSource({ title: 'A talk' }, `https://youtu.be/${ID}`), 'Borrow')
    expect(linked.source).toEqual({ title: 'A talk', url: `https://www.youtube.com/watch?v=${ID}`, videoId: ID })
    const row = entryToRow(linked, deck)
    expect(row['Source URL']).toBe(`A talk https://www.youtube.com/watch?v=${ID}`)
    expect(videoIdOfSource(rowToEntry(row, deck, NOW)!.source)).toBe(ID)
  })

  it('stores a page, and drops video details that no longer apply', () => {
    expect(linkedSource({ title: 'A', videoId: ID, startSec: 3, endSec: 5 }, PAGE)).toEqual({ title: 'A', url: PAGE })
  })
})
