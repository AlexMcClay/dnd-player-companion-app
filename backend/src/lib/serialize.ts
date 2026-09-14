import type {
  Entity as PrismaEntity,
  Holding as PrismaHolding,
  Note as PrismaNote,
} from '@prisma/client'
import type {
  Entity,
  EntityData,
  Holding,
  Knowledge,
  Note,
  NotePlacement,
  NoteVisibility,
} from '@codex/shared'
import { publicUrlFor } from './s3.js'

/**
 * `search` is a tsvector and must never leave the API. Everything else is
 * mapped explicitly so adding a column does not silently leak it.
 */
export function serializeEntity(row: PrismaEntity): Entity {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    summary: row.summary,
    bodyMd: row.bodyMd,
    data: (row.data ?? {}) as EntityData,
    imageKey: row.imageKey,
    imageUrl: publicUrlFor(row.imageKey),
    tags: row.tags,
    knowledge: row.knowledge as Knowledge,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * The author is trimmed to a face and a name on purpose. Expanding the whole
 * entity would ship a copy of the character sheet — body text included — with
 * every note on a board.
 */
export function serializeNote(row: PrismaNote & { author: PrismaEntity }): Note {
  return {
    id: row.id,
    authorId: row.authorId,
    author: {
      id: row.author.id,
      name: row.author.name,
      imageUrl: publicUrlFor(row.author.imageKey),
    },
    subjectId: row.subjectId,
    placement: row.placement as NotePlacement,
    visibility: row.visibility as NoteVisibility,
    title: row.title,
    bodyMd: row.bodyMd,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function serializeHolding(row: PrismaHolding & { item: PrismaEntity }): Holding {
  return {
    id: row.id,
    itemId: row.itemId,
    ownerId: row.ownerId,
    quantity: row.quantity,
    note: row.note,
    item: serializeEntity(row.item),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
