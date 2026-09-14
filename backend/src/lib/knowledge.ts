import { Prisma } from '@prisma/client'
import { PLAYER_VISIBLE_KNOWLEDGE } from '@codex/shared'

/**
 * The one place the app decides what a viewer is allowed to see: players get
 * rumoured and known, the DM gets everything.
 *
 * Two shapes of the same rule, because the full-text search runs as raw SQL and
 * cannot use a Prisma filter. Both read PLAYER_VISIBLE_KNOWLEDGE, so the list
 * itself is still defined exactly once — in @codex/shared.
 *
 * Nothing else in the codebase should compare against `knowledge` directly.
 */

export function knowledgeFilter(isDm: boolean): Prisma.EntityWhereInput {
  return isDm ? {} : { knowledge: { in: PLAYER_VISIBLE_KNOWLEDGE } }
}

/**
 * `column` is always a literal written here in the backend, never user input,
 * which is what makes Prisma.raw safe.
 */
export function knowledgeSql(isDm: boolean, column = 'knowledge'): Prisma.Sql {
  if (isDm) return Prisma.sql`TRUE`
  return Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(PLAYER_VISIBLE_KNOWLEDGE)})`
}
