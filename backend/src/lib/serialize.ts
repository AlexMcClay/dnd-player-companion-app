import type { Entity as PrismaEntity } from '@prisma/client'
import type { Entity, EntityData, Knowledge } from '@codex/shared'
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
    ownerId: row.ownerId,
    quantity: row.quantity,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
