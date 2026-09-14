/**
 * `[[Wiki-link]]` resolution, shared by the markdown renderer and by plain-text
 * fields. Keeping it in one place is what stops the two drifting into disagreeing
 * about what counts as a link.
 */

export const WIKI_LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

/**
 * Names are matched case-insensitively, and forgivingly about a leading "the":
 * people write `[[Drowned Quarter]]` for an entry called "The Drowned Quarter"
 * and are right to expect it to work. Nothing else is guessed — a near-miss
 * should stay visibly dead rather than link somewhere surprising.
 */
export function resolveWikiName(
  name: string,
  index: Map<string, string>,
): string | undefined {
  const key = name.trim().toLowerCase()
  if (!key) return undefined

  return (
    index.get(key) ??
    index.get(`the ${key}`) ??
    (key.startsWith('the ') ? index.get(key.slice(4)) : undefined)
  )
}

export interface WikiSegment {
  /** Text to show. For a link, the label. */
  text: string
  /** Entity id when the name resolved, otherwise undefined. */
  id?: string
  /** True when this segment came from [[...]] rather than surrounding prose. */
  isLink: boolean
}

/** Splits plain text into prose and link segments. Used where markdown is overkill. */
export function splitWikiText(text: string, index: Map<string, string>): WikiSegment[] {
  const segments: WikiSegment[] = []
  let cursor = 0

  // matchAll needs a fresh lastIndex; the shared regex is global.
  for (const match of text.matchAll(new RegExp(WIKI_LINK.source, 'g'))) {
    const start = match.index ?? 0
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), isLink: false })
    }

    const name = (match[1] ?? '').trim()
    const label = (match[2] ?? name).trim()
    segments.push({ text: label, id: resolveWikiName(name, index), isLink: true })

    cursor = start + match[0].length
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), isLink: false })
  return segments
}
