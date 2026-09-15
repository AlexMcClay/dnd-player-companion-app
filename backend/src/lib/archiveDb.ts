/**
 * The database half of backup and restore: reading everything out, and writing
 * an already-decided plan back in.
 *
 * Every decision lives in `archive.ts`; this file only talks to Postgres. That
 * split is what lets the preview the DM approves and the import that follows be
 * the same computation rather than two that have to be kept in step.
 */
import { Prisma } from '@prisma/client'
import {
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  type Archive,
  type ArchiveDdbSnapshot,
  type ArchiveEntity,
  type ArchiveHolding,
  type ArchiveNote,
  type DdbClass,
  type DdbCurrencies,
  type DdbItem,
  type EntityData,
  type ImportResult,
  type Knowledge,
  type NotePlacement,
  type NoteVisibility,
} from '@codex/shared'
import { entityKey, type ArchivePlan, type DbSnapshot, type EntityRef } from './archive.js'
import { prisma } from './prisma.js'

type Client = Omit<typeof prisma, '$connect' | '$disconnect' | '$transaction' | '$on' | '$use' | '$extends'>

export async function loadSnapshot(client: Client): Promise<DbSnapshot> {
  const [entities, holdings, notes, ddb, party] = await Promise.all([
    client.entity.findMany({ orderBy: { name: 'asc' } }),
    client.holding.findMany({ orderBy: { createdAt: 'asc' } }),
    client.note.findMany({ orderBy: { createdAt: 'asc' } }),
    client.ddbSnapshot.findMany(),
    client.ddbPartySnapshot.findMany(),
  ])
  return { entities, holdings, notes, ddb, party }
}

/**
 * The whole database as one file.
 *
 * Ids are written as well as names: names are what an AI can reference and what
 * survives being re-typed, but ids are what make restoring into *this* database
 * land on exactly the rows it came from. `imageUrl` is deliberately absent — it
 * is derived from `imageKey` at serialisation time and would be a second,
 * staler copy of the truth.
 */
export async function exportArchive(): Promise<Archive> {
  const db = await loadSnapshot(prisma)
  const nameById = new Map(db.entities.map((e) => [e.id, e.name]))

  const entities: ArchiveEntity[] = db.entities.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    summary: row.summary,
    bodyMd: row.bodyMd,
    data: (row.data ?? {}) as EntityData,
    imageKey: row.imageKey,
    tags: row.tags,
    knowledge: row.knowledge as Knowledge,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))

  const holdings: ArchiveHolding[] = db.holdings.flatMap((row) => {
    const item = nameById.get(row.itemId)
    // A holding whose item vanished cannot be expressed by name, and cascade
    // deletes mean it should not exist. Dropping it beats writing a broken file.
    if (!item) return []
    return [
      {
        id: row.id,
        item,
        owner: row.ownerId ? (nameById.get(row.ownerId) ?? null) : null,
        quantity: row.quantity,
        note: row.note,
      },
    ]
  })

  const notes: ArchiveNote[] = db.notes.flatMap((row) => {
    const author = nameById.get(row.authorId)
    if (!author) return []
    return [
      {
        id: row.id,
        author,
        subject: row.subjectId ? (nameById.get(row.subjectId) ?? null) : null,
        placement: row.placement as NotePlacement,
        visibility: row.visibility as NoteVisibility,
        title: row.title,
        bodyMd: row.bodyMd,
        createdAt: row.createdAt.toISOString(),
      },
    ]
  })

  const snapshots: ArchiveDdbSnapshot[] = db.ddb.flatMap((row) => {
    const player = nameById.get(row.playerId)
    if (!player) return []
    return [
      {
        player,
        ddbCharacterId: row.ddbCharacterId,
        name: row.name,
        race: row.race,
        classes: (row.classes ?? []) as unknown as DdbClass[],
        avatarUrl: row.avatarUrl,
        currencies: (row.currencies ?? {}) as DdbCurrencies,
        items: (row.items ?? []) as unknown as DdbItem[],
        syncedAt: row.syncedAt.toISOString(),
      },
    ]
  })

  const partyRow = db.party[0]

  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    entities,
    holdings,
    notes,
    ddb: {
      snapshots,
      party: partyRow
        ? {
            campaignId: partyRow.campaignId,
            campaignName: partyRow.campaignName,
            currencies: (partyRow.currencies ?? {}) as DdbCurrencies,
            items: (partyRow.items ?? []) as unknown as DdbItem[],
            syncedAt: partyRow.syncedAt.toISOString(),
          }
        : null,
    },
  }
}

/**
 * Runs a plan, all of it or none of it.
 *
 * The long timeout is deliberate: restoring a full backup is ~660 inserts plus
 * one update per row the DM chose to replace, and the default five seconds is
 * sized for a request handler rather than for this.
 */
export async function applyPlan(plan: ArchivePlan): Promise<ImportResult> {
  return prisma.$transaction(
    async (tx) => {
      /* Entities that already exist, updated in place so every holding, note
         and snapshot hanging off them stays attached. */
      for (const replace of plan.entityReplaces) {
        const { data, ...rest } = replace.fields
        await tx.entity.update({
          where: { id: replace.id },
          data: {
            ...rest,
            ...(data !== undefined ? { data: data as Prisma.InputJsonValue } : {}),
          },
        })
      }

      /* New entities. Split by whether the archive carried an id, so each
         insert has one column set — a backup restores with its ids intact, an
         AI batch lets Postgres generate them. */
      const withId = plan.entityCreates.filter((e) => e.id !== null)
      const withoutId = plan.entityCreates.filter((e) => e.id === null)

      const row = (create: (typeof plan.entityCreates)[number]) => ({
        type: create.type,
        name: create.name,
        summary: create.summary,
        bodyMd: create.bodyMd,
        data: create.data as Prisma.InputJsonValue,
        imageKey: create.imageKey,
        tags: create.tags,
        knowledge: create.knowledge,
        ...(create.createdAt ? { createdAt: create.createdAt } : {}),
        ...(create.updatedAt ? { updatedAt: create.updatedAt } : {}),
      })

      if (withId.length > 0) {
        await tx.entity.createMany({
          data: withId.map((create) => ({ id: create.id as string, ...row(create) })),
        })
      }
      if (withoutId.length > 0) {
        await tx.entity.createMany({ data: withoutId.map(row) })
      }

      /* Rows created a moment ago have ids now; everything that pointed at one
         by name has been waiting for them. */
      const created = plan.entityCreates.length
        ? await tx.entity.findMany({
            where: {
              OR: plan.entityCreates.map((create) => ({ type: create.type, name: create.name })),
            },
            select: { id: true, type: true, name: true },
          })
        : []
      const idByKey = new Map(created.map((e) => [entityKey(e.type, e.name), e.id]))

      const idOf = (ref: EntityRef): string => {
        if ('id' in ref) return ref.id
        const id = idByKey.get(ref.newKey)
        // Unreachable: the planner only emits a newKey for an entity it also
        // queued for creation, and this runs after that insert.
        if (!id) throw new Error(`Import lost track of "${ref.newKey}"`)
        return id
      }

      for (const replace of plan.holdingReplaces) {
        await tx.holding.update({ where: { id: replace.id }, data: replace.fields })
      }
      if (plan.holdingCreates.length > 0) {
        await tx.holding.createMany({
          data: plan.holdingCreates.map((create) => ({
            ...(create.id ? { id: create.id } : {}),
            itemId: idOf(create.item),
            ownerId: create.owner === null ? null : idOf(create.owner),
            quantity: create.quantity,
            note: create.note,
          })),
        })
      }

      for (const replace of plan.noteReplaces) {
        await tx.note.update({ where: { id: replace.id }, data: replace.fields })
      }
      if (plan.noteCreates.length > 0) {
        await tx.note.createMany({
          data: plan.noteCreates.map((create) => ({
            ...(create.id ? { id: create.id } : {}),
            authorId: idOf(create.author),
            subjectId: create.subject === null ? null : idOf(create.subject),
            placement: create.placement,
            visibility: create.visibility,
            title: create.title,
            bodyMd: create.bodyMd,
            ...(create.createdAt ? { createdAt: create.createdAt } : {}),
          })),
        })
      }

      // Replaced whole, never merged — the same rule the D&D Beyond sync holds.
      for (const upsert of plan.ddbUpserts) {
        const playerId = idOf(upsert.player)
        const fields = {
          ddbCharacterId: upsert.ddbCharacterId,
          name: upsert.name,
          race: upsert.race,
          classes: upsert.classes as Prisma.InputJsonValue,
          avatarUrl: upsert.avatarUrl,
          currencies: upsert.currencies as Prisma.InputJsonValue,
          items: upsert.items as Prisma.InputJsonValue,
          syncedAt: upsert.syncedAt,
        }
        await tx.ddbSnapshot.upsert({
          where: { playerId },
          create: { playerId, ...fields },
          update: fields,
        })
      }

      if (plan.partyUpsert) {
        const party = plan.partyUpsert
        const fields = {
          campaignName: party.campaignName,
          currencies: (party.currencies ?? {}) as Prisma.InputJsonValue,
          items: (party.items ?? []) as unknown as Prisma.InputJsonValue,
          syncedAt: new Date(party.syncedAt),
        }
        await tx.ddbPartySnapshot.upsert({
          where: { campaignId: party.campaignId },
          create: { campaignId: party.campaignId, ...fields },
          update: fields,
        })
      }

      return {
        entities: {
          created: plan.entityCreates.length,
          replaced: plan.entityReplaces.length,
          skipped: plan.skipped.entities.skipped,
        },
        holdings: {
          created: plan.holdingCreates.length,
          replaced: plan.holdingReplaces.length,
          skipped: plan.skipped.holdings.skipped,
        },
        notes: {
          created: plan.noteCreates.length,
          replaced: plan.noteReplaces.length,
          skipped: plan.skipped.notes.skipped,
        },
        ddb: {
          created: plan.ddbCreates,
          replaced: plan.ddbUpserts.length + (plan.partyUpsert ? 1 : 0) - plan.ddbCreates,
          skipped: plan.skipped.ddb.skipped,
        },
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  )
}
