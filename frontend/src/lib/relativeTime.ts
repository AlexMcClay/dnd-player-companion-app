const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * "3 days ago" for anything recent, a plain date beyond a fortnight. Notes are
 * read at the table, where "yesterday" carries more than a timestamp does.
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso)
  const elapsed = Date.now() - then.getTime()

  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) {
    const mins = Math.floor(elapsed / MINUTE)
    return `${mins} min${mins === 1 ? '' : 's'} ago`
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  if (elapsed < 14 * DAY) {
    const days = Math.floor(elapsed / DAY)
    return days === 1 ? 'yesterday' : `${days} days ago`
  }

  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
