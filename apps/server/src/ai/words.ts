/** Compares target names loosely, since a model may change their case or final punctuation. */
export const normalizeWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.…!?,;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
