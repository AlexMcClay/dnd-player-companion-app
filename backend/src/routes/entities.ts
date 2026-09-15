import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { KNOWLEDGE_STATES, type EntityInput, type Knowledge } from '@codex/shared'
import { knowledgeFilter, knowledgeSql } from '../lib/knowledge.js'
import { prisma } from '../lib/prisma.js'
import { serializeEntity, serializeEntitySummary } from '../lib/serialize.js'
import { requireActor, requireDm } from '../middleware/identity.js'

export const entitiesRouter = Router()

function isKnowledge(value: unknown): value is Knowledge {
  return typeof value === 'string' && (KNOWLEDGE_STATES as readonly string[]).includes(value)
}

function badRequest(message: string) {
  return { error: message }
}

/** Validates and narrows an untrusted body. `partial` allows PUT to omit fields. */
function parseInput(body: unknown, partial: boolean): EntityInput | string {
  if (typeof body !== 'object' || body === null) return 'Body must be an object'
  const b = body as Record<string, unknown>
  const out: Partial<EntityInput> = {}

  if (b.type !== undefined) {
    if (typeof b.type !== 'string' || !/^[a-z0-9_-]{1,32}$/i.test(b.type)) {
      return 'type must be a short slug (letters, digits, _ or -)'
    }
    out.type = b.type
  } else if (!partial) {
    return 'type is required'
  }

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || b.name.trim().length === 0) return 'name is required'
    out.name = b.name.trim()
  } else if (!partial) {
    return 'name is required'
  }

  if (b.summary !== undefined) {
    if (b.summary !== null && typeof b.summary !== 'string') return 'summary must be a string'
    out.summary = b.summary as string | null
  }
  if (b.bodyMd !== undefined) {
    if (b.bodyMd !== null && typeof b.bodyMd !== 'string') return 'bodyMd must be a string'
    out.bodyMd = b.bodyMd as string | null
  }
  if (b.data !== undefined) {
    if (typeof b.data !== 'object' || b.data === null || Array.isArray(b.data)) {
      return 'data must be an object'
    }
    out.data = b.data as Record<string, unknown>
  }
  if (b.imageKey !== undefined) {
    if (b.imageKey !== null && typeof b.imageKey !== 'string') return 'imageKey must be a string'
    out.imageKey = b.imageKey as string | null
  }
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags) || b.tags.some((t) => typeof t !== 'string')) {
      return 'tags must be an array of strings'
    }
    out.tags = (b.tags as string[]).map((t) => t.trim()).filter(Boolean)
  }
  if (b.knowledge !== undefined) {
    if (!isKnowledge(b.knowledge)) return `knowledge must be one of ${KNOWLEDGE_STATES.join(', ')}`
    out.knowledge = b.knowledge
  }
  return out as EntityInput
}

/**
 * Full-text search. `search` is a generated tsvector so Prisma cannot touch it;
 * this returns ranked ids that the caller folds into a normal findMany.
 *
 * The ILIKE arm covers partial words, which tsquery cannot: "harbour" has to
 * find the Harbourmaster, because that is what someone types into a search box.
 * It spans the same three columns the tsvector is built from, so the two arms
 * agree about what "searchable" means.
 *
 * Tags are searched too, flattened to a string so a partial tag matches the way
 * a partial word does. They are not in the tsvector — that is a generated column
 * and changing it means a migration — so a tag-only hit ranks below a text hit
 * and falls back to alphabetical. That ordering is the right way round anyway.
 *
 * A sequential scan is fine at the size a campaign reaches.
 */
/*
 * `type` narrows inside this query rather than only in the caller's filter,
 * because the LIMIT applies to *this* result: searching every kind and
 * narrowing afterwards spends the budget on kinds the caller never asked for,
 * and can return nothing when matches exist.
 */
async function searchIds(q: string, isDm: boolean, type: string | null): Promise<string[]> {
  const like = `%${q}%`
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM entities
    WHERE (
        search @@ plainto_tsquery('english', ${q})
        OR name ILIKE ${like}
        OR coalesce(summary, '') ILIKE ${like}
        OR coalesce(body_md, '') ILIKE ${like}
        OR array_to_string(tags, ' ') ILIKE ${like}
      )
      AND ${knowledgeSql(isDm)}
      AND ${type === null ? Prisma.sql`TRUE` : Prisma.sql`type = ${type}`}
    ORDER BY ts_rank(search, plainto_tsquery('english', ${q})) DESC, name ASC
    LIMIT 200
  `
  return rows.map((r) => r.id)
}

// GET /api/entities?type=&q=&tag=
entitiesRouter.get('/', async (req, res, next) => {
  try {
    const { type, q, tag } = req.query
    const where: Prisma.EntityWhereInput = { ...knowledgeFilter(req.isDm) }

    const onlyType = typeof type === 'string' && type ? type : null
    if (onlyType) where.type = onlyType
    if (typeof tag === 'string' && tag) where.tags = { has: tag }

    let rankedIds: string[] | null = null
    if (typeof q === 'string' && q.trim()) {
      rankedIds = await searchIds(q.trim(), req.isDm, onlyType)
      if (rankedIds.length === 0) {
        res.json([])
        return
      }
      where.id = { in: rankedIds }
    }

    // Omitted at the query, not just the serializer, so the body never leaves
    // the database either.
    const rows = await prisma.entity.findMany({
      where,
      orderBy: { name: 'asc' },
      omit: { bodyMd: true },
    })
    const entities = rows.map(serializeEntitySummary)

    if (rankedIds) {
      const order = new Map(rankedIds.map((id, i) => [id, i]))
      entities.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    }

    res.json(entities)
  } catch (err) {
    next(err)
  }
})

// GET /api/entities/:id
entitiesRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await prisma.entity.findFirst({
      where: { id: req.params.id, ...knowledgeFilter(req.isDm) },
    })
    // Unknown entities 404 for players rather than 403 — a 403 would confirm
    // that something exists at that id.
    if (!row) {
      res.status(404).json(badRequest('Not found'))
      return
    }
    res.json(serializeEntity(row))
  } catch {
    res.status(404).json(badRequest('Not found'))
  }
})

// POST /api/entities
entitiesRouter.post('/', requireDm, async (req, res, next) => {
  try {
    const parsed = parseInput(req.body, false)
    if (typeof parsed === 'string') {
      res.status(400).json(badRequest(parsed))
      return
    }
    const row = await prisma.entity.create({
      data: {
        type: parsed.type,
        name: parsed.name,
        summary: parsed.summary ?? null,
        bodyMd: parsed.bodyMd ?? null,
        data: (parsed.data ?? {}) as Prisma.InputJsonValue,
        imageKey: parsed.imageKey ?? null,
        tags: parsed.tags ?? [],
        knowledge: parsed.knowledge ?? 'unknown',
      },
    })
    res.status(201).json(serializeEntity(row))
  } catch (err) {
    next(err)
  }
})

/**
 * The only fields a player may change on their own character. Everything else —
 * their name, their level, whether they are a secret — stays the DM's.
 *
 * Checked fail-closed: a field added to EntityInput later is rejected for
 * players until it is deliberately listed here.
 */
const PLAYER_EDITABLE: ReadonlySet<string> = new Set(['bodyMd'])

// PUT /api/entities/:id — the DM, or a player editing their own character.
entitiesRouter.put('/:id', requireActor, async (req, res, next) => {
  try {
    const parsed = parseInput(req.body, true)
    if (typeof parsed === 'string') {
      res.status(400).json(badRequest(parsed))
      return
    }

    if (!req.isDm) {
      const target = await prisma.entity.findUnique({
        where: { id: req.params.id },
        select: { id: true, type: true },
      })

      const isOwnCharacter =
        target !== null && target.type === 'player' && target.id === req.playerId

      if (!isOwnCharacter) {
        res.status(401).json(badRequest('You can only edit your own character'))
        return
      }

      const disallowed = Object.keys(parsed).filter((key) => !PLAYER_EDITABLE.has(key))
      if (disallowed.length > 0) {
        res.status(401).json(badRequest(`Only the DM can change: ${disallowed.join(', ')}`))
        return
      }
    }

    const { data, ...rest } = parsed
    const row = await prisma.entity.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(data !== undefined ? { data: data as Prisma.InputJsonValue } : {}),
      },
    })
    res.json(serializeEntity(row))
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json(badRequest('Not found'))
      return
    }
    next(err)
  }
})

// DELETE /api/entities/:id
entitiesRouter.delete('/:id', requireDm, async (req, res, next) => {
  try {
    await prisma.entity.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json(badRequest('Not found'))
      return
    }
    next(err)
  }
})
