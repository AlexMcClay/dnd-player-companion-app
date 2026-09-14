import { Prisma } from '@prisma/client'
import { Router } from 'express'
import {
  KNOWLEDGE_STATES,
  PLAYER_VISIBLE_KNOWLEDGE,
  type EntityInput,
  type Knowledge,
} from '@codex/shared'
import { prisma } from '../lib/prisma.js'
import { serializeEntity } from '../lib/serialize.js'
import { requireDm } from '../middleware/dmKey.js'

export const entitiesRouter = Router()

/**
 * The one place knowledge is enforced. Every read goes through it: players see
 * rumoured and known, the DM sees everything. Nothing else in the codebase
 * should compare against `knowledge` when deciding what to return.
 */
function knowledgeFilter(isDm: boolean): Prisma.EntityWhereInput {
  return isDm ? {} : { knowledge: { in: PLAYER_VISIBLE_KNOWLEDGE } }
}

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
  if (b.ownerId !== undefined) {
    if (b.ownerId !== null && typeof b.ownerId !== 'string') return 'ownerId must be a uuid or null'
    out.ownerId = b.ownerId as string | null
  }
  if (b.quantity !== undefined) {
    if (!Number.isInteger(b.quantity)) return 'quantity must be an integer'
    out.quantity = b.quantity as number
  }

  return out as EntityInput
}

/**
 * Full-text search. `search` is a generated tsvector so Prisma cannot touch it;
 * this returns ranked ids that the caller folds into a normal findMany.
 * The ILIKE arm keeps partial words ("thrush") working, which tsquery alone does not.
 */
async function searchIds(q: string, isDm: boolean): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM entities
    WHERE (search @@ plainto_tsquery('english', ${q}) OR name ILIKE ${'%' + q + '%'})
      AND (${isDm} OR knowledge <> 'unknown')
    ORDER BY ts_rank(search, plainto_tsquery('english', ${q})) DESC, name ASC
    LIMIT 200
  `
  return rows.map((r) => r.id)
}

// GET /api/entities?type=&q=&tag=&owner=
entitiesRouter.get('/', async (req, res, next) => {
  try {
    const { type, q, tag, owner } = req.query
    const where: Prisma.EntityWhereInput = { ...knowledgeFilter(req.isDm) }

    if (typeof type === 'string' && type) where.type = type
    if (typeof tag === 'string' && tag) where.tags = { has: tag }
    if (typeof owner === 'string' && owner) {
      where.ownerId = owner === 'none' ? null : owner
    }

    let rankedIds: string[] | null = null
    if (typeof q === 'string' && q.trim()) {
      rankedIds = await searchIds(q.trim(), req.isDm)
      if (rankedIds.length === 0) {
        res.json([])
        return
      }
      where.id = { in: rankedIds }
    }

    const rows = await prisma.entity.findMany({ where, orderBy: { name: 'asc' } })
    const entities = rows.map(serializeEntity)

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
        ownerId: parsed.ownerId ?? null,
        quantity: parsed.quantity ?? 1,
      },
    })
    res.status(201).json(serializeEntity(row))
  } catch (err) {
    next(err)
  }
})

// PUT /api/entities/:id
entitiesRouter.put('/:id', requireDm, async (req, res, next) => {
  try {
    const parsed = parseInput(req.body, true)
    if (typeof parsed === 'string') {
      res.status(400).json(badRequest(parsed))
      return
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
