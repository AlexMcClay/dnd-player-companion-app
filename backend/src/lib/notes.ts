import { Prisma } from '@prisma/client'
import { knowledgeFilter } from './knowledge.js'

/**
 * The one place the app decides which notes a viewer may read. Two independent
 * gates, both of which must pass.
 *
 * Nothing else should compare against `visibility` or `authorId` when deciding
 * what to return — the same rule `lib/knowledge.ts` holds for entities.
 */
export function noteVisibility(isDm: boolean, playerId: string | null): Prisma.NoteWhereInput {
  // The DM sees every note, private ones included — a deliberate choice for this
  // table, stated plainly in the README.
  //
  // Short-circuiting here rather than threading isDm through the filters below
  // is not just tidiness: `knowledgeFilter(true)` is `{}`, and an empty relation
  // filter (`{ subject: {} }`) matches *nothing* on a nullable relation, which
  // silently hid every entry note from the DM.
  if (isDm) return {}

  return {
    AND: [
      // 1. The note itself: shared, or your own.
      {
        OR: [
          { visibility: 'shared' },
          ...(playerId ? [{ authorId: playerId } as Prisma.NoteWhereInput] : []),
        ],
      },
      // 2. What it is pinned to. A note on a sealed NPC would otherwise
      //    announce that the NPC exists.
      { OR: [{ subjectId: null }, { subject: knowledgeFilter(false) }] },
    ],
  }
}

/** Who may change a note once written: its author, or the DM. */
export function canModify(
  note: { authorId: string },
  isDm: boolean,
  playerId: string | null,
): boolean {
  return isDm || (playerId !== null && note.authorId === playerId)
}
