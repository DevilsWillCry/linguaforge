import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'
import { z } from 'zod'

export const extractRequestSchema = z.object({ url: z.string().trim().min(1).max(2000) })

export interface Article {
  url: string
  title: string
  siteName?: string
  paragraphs: string[]
}

const BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre'
/** Shorter pages are usually a login wall or an error, not something to read. */
const MIN_ARTICLE_CHARS = 200

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim()

/**
 * Reduces a page to plain text. Only text leaves the server, so nothing from the page can run
 * in the app, and jsdom's defaults mean its scripts don't run here and nothing else is loaded.
 */
export function extractArticle(html: Buffer, url: string, contentType: string): Article | null {
  if (contentType.includes('text/plain')) {
    const paragraphs = html.toString('utf8').split(/\n\s*\n/).map(cleanText).filter(Boolean)
    const total = paragraphs.join('').length
    return total >= MIN_ARTICLE_CHARS ? { url, title: new URL(url).hostname, paragraphs } : null
  }

  const page = new JSDOM(html, { url, contentType: 'text/html', virtualConsole: new VirtualConsole() })
  const parsed = new Readability(page.window.document).parse()
  if (!parsed?.content) return null

  const content = new JSDOM(parsed.content, { contentType: 'text/html', virtualConsole: new VirtualConsole() }).window.document
  const paragraphs = [...content.querySelectorAll(BLOCKS)]
    // A paragraph inside a list item or a quote would otherwise be read twice.
    .filter((element) => !element.parentElement?.closest(BLOCKS))
    .map((element) => cleanText(element.textContent ?? ''))
    .filter(Boolean)

  if (paragraphs.join('').length < MIN_ARTICLE_CHARS) return null
  return {
    url,
    title: cleanText(parsed.title ?? '') || new URL(url).hostname,
    ...(parsed.siteName ? { siteName: cleanText(parsed.siteName) } : {}),
    paragraphs,
  }
}
