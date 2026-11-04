/** An arrow only starts a new item at the beginning of a line. */
const LINE_START_ARROW = /(?:^|\n)[ \t]*→/

/**
 * Splits a spreadsheet cell into items, with one item per line-starting "→".
 *
 * It splits on arrows rather than newlines because one item can span several lines,
 * like a dialogue: "→ A: Want ice cream?\n   B: I can't". Those lines stay together,
 * with their indentation removed. An arrow in the middle of a line, as in
 * "parent → child", is ordinary text. A cell with no arrows is a single item.
 */
export function parseArrowList(cell: string | null | undefined): string[] {
  if (!cell?.trim()) return []
  return cell
    .split(LINE_START_ARROW)
    .map((item) =>
      item
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean)
}

/** The inverse of parseArrowList. */
export function formatArrowList(items: readonly string[]): string {
  return items.map((item) => `→ ${item}`).join('\n')
}

/**
 * The key used to spot exact duplicates. Ignores case, extra whitespace, curly
 * apostrophes and trailing punctuation, so "By the way..." equals "by the way".
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.…!?,;:]+$/, '')
    .trim()
    .toLowerCase()
}

/** For comparing human text in search, where "lógica" should match "logica". */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * The sheet's "Source URL" column mostly holds titles, so this separates the two.
 * A cell can hold both, as "Title https://…", which is how formatSource writes them.
 */
export function parseSource(cell: string | null | undefined): { title?: string; url?: string } {
  const value = cell?.trim()
  if (!value) return {}
  const match = /^(.*?)\s*(https?:\/\/\S+)$/is.exec(value)
  if (!match) return { title: value }
  const [, title, url] = match
  return { ...(title ? { title } : {}), url: url as string }
}

/** The inverse of parseSource. */
export function formatSource(source: { title?: string; url?: string }): string {
  return [source.title, source.url].filter(Boolean).join(' ')
}

/** Returns the URL only if it's safe to use as a link, which rules out "javascript:". */
export function safeHttpUrl(value: string | undefined): string | undefined {
  return value && /^https?:\/\//i.test(value) ? value : undefined
}

export function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim())
}
