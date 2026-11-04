import { parseYouTubeId } from './subtitles'
import { foldText } from './text'
import type { Entry, EntrySource } from './types'

/** The YouTube video a source points to. The link wins, because editing it can leave an old id. */
export function videoIdOfSource(source: EntrySource): string | null {
  return (source.url && parseYouTubeId(source.url)) || source.videoId || null
}

/** A link's tidy form if it's an ordinary web address, or null. Rules out "javascript:". */
export function cleanWebLink(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

/** Where a source opens inside the app, if it has anywhere to open. */
export function sourceDestination(source: EntrySource): { path: '/video'; query: { v: string } } | { path: '/reading'; query: { url: string } } | null {
  const videoId = videoIdOfSource(source)
  if (videoId) return { path: '/video', query: { v: videoId } }
  const url = cleanWebLink(source.url)
  return url ? { path: '/reading', query: { url } } : null
}

export type SourceKind = 'video' | 'page' | 'unlinked'

export interface LibrarySource {
  /** Stable across renders: the video id or link, or the title until it has one. */
  key: string
  title: string
  kind: SourceKind
  source: EntrySource
  entryIds: string[]
}

/** Groups entries by where they came from. Entries sharing a title or link are one source. */
export function librarySources(entries: readonly Entry[]): LibrarySource[] {
  const groups = new Map<string, LibrarySource>()
  for (const entry of entries) {
    const { title, url } = entry.source
    const videoId = videoIdOfSource(entry.source)
    const link = cleanWebLink(url)
    const kind: SourceKind = videoId ? 'video' : link ? 'page' : 'unlinked'
    if (kind === 'unlinked' && !title?.trim()) continue
    const key = videoId ?? link ?? foldText(title!.trim())
    const group = groups.get(key)
    if (group) group.entryIds.push(entry.id)
    else groups.set(key, { key, title: title?.trim() || link || videoId!, kind, source: entry.source, entryIds: [entry.id] })
  }
  const RANK: Record<SourceKind, number> = { unlinked: 0, page: 1, video: 1 }
  return [...groups.values()].sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.title.localeCompare(b.title))
}

/** These open a normal search in the user's browser. Nothing is fetched by the app. */
export const youTubeSearchUrl = (title: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`
export const webSearchUrl = (title: string) => `https://www.google.com/search?q=${encodeURIComponent(title)}`

/** The source with its link. The title stays, so exports keep both as "Title https://…". */
export function linkedSource(source: EntrySource, link: string): EntrySource {
  const videoId = parseYouTubeId(link)
  if (videoId) return { ...source, url: `https://www.youtube.com/watch?v=${videoId}`, videoId }
  const { videoId: _old, startSec: _start, endSec: _end, ...rest } = source
  return { ...rest, url: link }
}
