import type { Entity as PrismaEntity, Holding as PrismaHolding } from '@prisma/client'
import type { Entity, EntityData, Holding, Knowledge } from '@codex/shared'
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
