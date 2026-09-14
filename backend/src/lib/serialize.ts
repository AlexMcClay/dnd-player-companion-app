import type {
  Entity as PrismaEntity,
  Holding as PrismaHolding,
  Note as PrismaNote,
} from '@prisma/client'
import type {
  Entity,
  EntityData,
  EntitySummary,
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
 *
 * Note `bodyMd` is absent here, not merely unused: lists must not carry rules
 * text, which is more than half their weight once the SRD is loaded.
 */
export function serializeEntitySummary(row: Omit<PrismaEntity, 'bodyMd'>): EntitySummary {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    summary: row.summary,
    data: (row.data ?? {}) as EntityData,
    imageKey: row.imageKey,
    imageUrl: publicUrlFor(row.imageKey),
    tags: row.tags,
    knowledge: row.knowledge as Knowledge,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** The whole entry, for fetching one. */
export function serializeEntity(row: PrismaEntity): Entity {
  return { ...serializeEntitySummary(row), bodyMd: row.bodyMd }
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

export function serializeHolding(
  row: PrismaHolding & { item: Omit<PrismaEntity, 'bodyMd'> },
): Holding {
  return {
    id: row.id,
    itemId: row.itemId,
    ownerId: row.ownerId,
    quantity: row.quantity,
    note: row.note,
    item: serializeEntitySummary(row.item),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
