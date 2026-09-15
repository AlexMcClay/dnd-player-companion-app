/**
 * Name matching shared by the D&D Beyond item resolver and the item picker.
 *
 * Two different jobs, so two different normalisations — collapsing them into one
 * would quietly break whichever caller did not win.
 */

/**
 * Index key. Drops a parenthetical qualifier, so "Oil (flask)" keys as "oil"
 * and a D&D Beyond item called plain "Oil" finds it.
 *
 * Deliberately lossy: never use it on text you intend to search, because the
 * dropped parenthetical is real words someone might type.
 */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Search text. Keeps every word and only flattens punctuation, so the "50 feet"
 * in "Rope, hempen (50 feet)" stays findable.
 */
export function flatten(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Every word of the needle appears somewhere in the haystack, in any order.
 *
 * A plain substring test is too strict for names written back-to-front: the
 * books call it "Rope, hempen" and "Potion of Healing", so "hempen rope" and
 * "potion healing" both fail `includes` while being exactly what someone types.
 */
export function tokenMatch(haystack: string, needle: string): boolean {
  const tokens = flatten(needle).split(' ').filter(Boolean)
  if (tokens.length === 0) return true
  const hay = flatten(haystack)
  return tokens.every((token) => hay.includes(token))
}
