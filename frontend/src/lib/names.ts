/**
 * What to call a character in a heading.
 *
 * "About Krag" reads better than "About Krag Bronzebeard", and section labels
 * are short by design. Falls back to the whole name for anyone mononymous.
 */
export function firstNameOf(name: string): string {
  return name.split(' ')[0] || name
}
