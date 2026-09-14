import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { STASH, type HoldingInput } from '@codex/shared'
import { knowledgeFilter } from '../lib/knowledge.js'
import { prisma } from '../lib/prisma.js'
import { serializeHolding } from '../lib/serialize.js'
import { requireActor } from '../middleware/identity.js'

export const holdingsRouter = Router()

// The item's rules text is never rendered from a holding row, and the SRD makes
// it the bulk of the payload.
const INCLUDE_ITEM = { item: { omit: { bodyMd: true } } } as const

/**
 * A holding is only as visible as the item behind it — otherwise the stash
 * would announce the existence of something the DM has sealed.
 */
function visibleTo(isDm: boolean): Prisma.HoldingWhereInput {
  return { item: knowledgeFilter(isDm) }
}

function parseInput(body: unknown, partial: boolean): HoldingInput | string {
  if (typeof body !== 'object' || body === null) return 'Body must be an object'
  const b = body as Record<string, unknown>
  const out: Partial<HoldingInput> = {}

  if (b.itemId !== undefined) {
    if (typeof b.itemId !== 'string') return 'itemId must be a uuid'
    out.itemId = b.itemId
  } else if (!partial) {
    return 'itemId is required'
  }

  if (b.ownerId !== undefined) {
    if (b.ownerId !== null && typeof b.ownerId !== 'string') return 'ownerId must be a uuid or null'
    out.ownerId = b.ownerId as string | null
  }

  if (b.quantity !== undefined) {
    if (!Number.isInteger(b.quantity) || (b.quantity as number) < 0) {
      return 'quantity must be a whole number of 0 or more'
    }
    out.quantity = b.quantity as number
  }

  if (b.note !== undefined) {
    if (b.note !== null && typeof b.note !== 'string') return 'note must be a string'
    out.note = b.note as string | null
  }

  return out as HoldingInput
}

// GET /api/holdings?owner=<playerId|none>
holdingsRouter.get('/', async (req, res, next) => {
  try {
    const { owner, item } = req.query
    const where: Prisma.HoldingWhereInput = { ...visibleTo(req.isDm) }

    if (typeof owner === 'string' && owner) {
      where.ownerId = owner === STASH ? null : owner
    }
    if (typeof item === 'string' && item) {
      where.itemId = item
    }

    const rows = await prisma.holding.findMany({
      where,
      include: INCLUDE_ITEM,
      orderBy: { item: { name: 'asc' } },
    })
    res.json(rows.map(serializeHolding))
  } catch (err) {
    next(err)
  }
})

// POST /api/holdings — any member of the table, not just the DM.
holdingsRouter.post('/', requireActor, async (req, res, next) => {
  try {
    const parsed = parseInput(req.body, false)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }

    // A player must not be able to conjure a holding of something they cannot
    // see, which would confirm that a sealed item exists.
    const item = await prisma.entity.findFirst({
      where: { id: parsed.itemId, type: 'item', ...knowledgeFilter(req.isDm) },
      select: { id: true },
    })
    if (!item) {
      res.status(404).json({ error: 'No such item' })
      return
    }

    const ownerId = parsed.ownerId ?? null
    const quantity = parsed.quantity ?? 1

    // Adding six firesalt to a stash that already has six should read as
    // twelve, not as two rows saying six. Stacks with a note stay separate,
    // since the note is what makes that stack distinct.
    const twin = parsed.note
      ? null
      : await prisma.holding.findFirst({ where: { itemId: parsed.itemId, ownerId, note: null } })

    const row = twin
      ? await prisma.holding.update({
          where: { id: twin.id },
          data: { quantity: twin.quantity + quantity },
          include: INCLUDE_ITEM,
        })
      : await prisma.holding.create({
          data: { itemId: parsed.itemId, ownerId, quantity, note: parsed.note ?? null },
          include: INCLUDE_ITEM,
        })

    res.status(twin ? 200 : 201).json(serializeHolding(row))
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      res.status(400).json({ error: 'No such owner' })
      return
    }
    next(err)
  }
})

// PUT /api/holdings/:id — moving between stash and character is an ownerId change.
holdingsRouter.put('/:id', requireActor, async (req, res, next) => {
  try {
    const parsed = parseInput(req.body, true)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }

    const existing = await prisma.holding.findFirst({
      where: { id: req.params.id, ...visibleTo(req.isDm) },
    })
    if (!existing) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    // Handing a stack to someone who already carries that item merges the two,
    // for the same reason adding does.
    const movingTo = parsed.ownerId !== undefined ? parsed.ownerId : existing.ownerId
    const twin =
      movingTo !== existing.ownerId && existing.note === null
        ? await prisma.holding.findFirst({
            where: {
              itemId: existing.itemId,
              ownerId: movingTo,
              note: null,
              id: { not: existing.id },
            },
          })
        : null

    if (twin) {
      const [merged] = await prisma.$transaction([
        prisma.holding.update({
          where: { id: twin.id },
          data: { quantity: twin.quantity + (parsed.quantity ?? existing.quantity) },
          include: INCLUDE_ITEM,
        }),
        prisma.holding.delete({ where: { id: existing.id } }),
      ])
      res.json(serializeHolding(merged))
      return
    }

    const row = await prisma.holding.update({
      where: { id: req.params.id },
      data: parsed,
      include: INCLUDE_ITEM,
    })
    res.json(serializeHolding(row))
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      res.status(400).json({ error: 'No such owner' })
      return
    }
    next(err)
  }
})

// DELETE /api/holdings/:id
holdingsRouter.delete('/:id', requireActor, async (req, res, next) => {
  try {
    const existing = await prisma.holding.findFirst({
      where: { id: req.params.id, ...visibleTo(req.isDm) },
      select: { id: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    await prisma.holding.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
