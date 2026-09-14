import { Prisma } from '@prisma/client'
import { Router } from 'express'
import {
  NOTE_PLACEMENTS,
  NOTE_VISIBILITIES,
  type NoteInput,
  type NotePlacement,
  type NoteVisibility,
} from '@codex/shared'
import { knowledgeFilter } from '../lib/knowledge.js'
import { canModify, noteVisibility } from '../lib/notes.js'
import { prisma } from '../lib/prisma.js'
import { serializeNote } from '../lib/serialize.js'
import { requireActor } from '../middleware/identity.js'

export const notesRouter = Router()

const INCLUDE_AUTHOR = { author: true } as const

function isPlacement(value: unknown): value is NotePlacement {
  return typeof value === 'string' && (NOTE_PLACEMENTS as readonly string[]).includes(value)
}

function isVisibility(value: unknown): value is NoteVisibility {
  return typeof value === 'string' && (NOTE_VISIBILITIES as readonly string[]).includes(value)
}

/**
 * Note the absence of authorId: it is taken from the request, never the body.
 * Accepting it would let anyone post as anyone, invisibly.
 */
function parseInput(body: unknown, partial: boolean): NoteInput | string {
  if (typeof body !== 'object' || body === null) return 'Body must be an object'
  const b = body as Record<string, unknown>
  const out: Partial<NoteInput> = {}

  if (b.placement !== undefined) {
    if (!isPlacement(b.placement)) return `placement must be one of ${NOTE_PLACEMENTS.join(', ')}`
    out.placement = b.placement
  } else if (!partial) {
    return 'placement is required'
  }

  if (b.subjectId !== undefined) {
    if (b.subjectId !== null && typeof b.subjectId !== 'string') {
      return 'subjectId must be a uuid or null'
    }
    out.subjectId = b.subjectId as string | null
  }

  if (b.visibility !== undefined) {
    if (!isVisibility(b.visibility)) {
      return `visibility must be one of ${NOTE_VISIBILITIES.join(', ')}`
    }
    out.visibility = b.visibility
  }

  if (b.title !== undefined) {
    if (b.title !== null && typeof b.title !== 'string') return 'title must be a string'
    const trimmed = typeof b.title === 'string' ? b.title.trim() : null
    out.title = trimmed || null
  }

  if (b.bodyMd !== undefined) {
    if (typeof b.bodyMd !== 'string' || b.bodyMd.trim().length === 0) {
      return 'bodyMd cannot be empty'
    }
    out.bodyMd = b.bodyMd.trim()
  } else if (!partial) {
    return 'bodyMd is required'
  }

  return out as NoteInput
}

/** Mirrors the CHECK constraints, so a bad request reads as 400 not 500. */
function checkShape(placement: NotePlacement, subjectId: string | null, visibility: NoteVisibility) {
  if (placement === 'entry' && !subjectId) return 'An entry note needs a subject'
  if (placement !== 'entry' && subjectId) return 'Only entry notes may have a subject'
  if (placement === 'party' && visibility === 'private') {
    return 'Party board notes are always shared'
  }
  return null
}

// GET /api/notes?subject=&placement=&author=
notesRouter.get('/', async (req, res, next) => {
  try {
    const { subject, placement, author } = req.query
    const where: Prisma.NoteWhereInput = { ...noteVisibility(req.isDm, req.playerId) }

    if (typeof subject === 'string' && subject) where.subjectId = subject
    if (isPlacement(placement)) where.placement = placement
    if (typeof author === 'string' && author) {
      // `me` saves the client having to know its own id here.
      where.authorId = author === 'me' ? (req.playerId ?? '') : author
    }

    const rows = await prisma.note.findMany({
      where,
      include: INCLUDE_AUTHOR,
      orderBy: { createdAt: 'desc' },
    })
    res.json(rows.map(serializeNote))
  } catch (err) {
    next(err)
  }
})

// GET /api/notes/:id
notesRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await prisma.note.findFirst({
      where: { id: req.params.id, ...noteVisibility(req.isDm, req.playerId) },
      include: INCLUDE_AUTHOR,
    })
    // 404 rather than 403: a 403 would confirm the note exists.
    if (!row) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    res.json(serializeNote(row))
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

// POST /api/notes
notesRouter.post('/', requireActor, async (req, res, next) => {
  try {
    // requireActor lets the DM through with no character. Writing needs an
    // author, so say so rather than failing on a null foreign key.
    if (!req.playerId) {
      res.status(400).json({ error: 'Pick a character to write as' })
      return
    }

    const parsed = parseInput(req.body, false)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }

    const subjectId = parsed.subjectId ?? null
    const visibility = parsed.visibility ?? 'shared'

    const shapeError = checkShape(parsed.placement, subjectId, visibility)
    if (shapeError) {
      res.status(400).json({ error: shapeError })
      return
    }

    if (subjectId) {
      // Must not be able to pin a note to something they cannot see, which
      // would confirm that a sealed entry exists.
      const subject = await prisma.entity.findFirst({
        where: { id: subjectId, ...knowledgeFilter(req.isDm) },
        select: { id: true },
      })
      if (!subject) {
        res.status(404).json({ error: 'No such entry' })
        return
      }
    }

    const row = await prisma.note.create({
      data: {
        authorId: req.playerId,
        subjectId,
        placement: parsed.placement,
        visibility,
        title: parsed.title ?? null,
        bodyMd: parsed.bodyMd,
      },
      include: INCLUDE_AUTHOR,
    })
    res.status(201).json(serializeNote(row))
  } catch (err) {
    next(err)
  }
})

// PUT /api/notes/:id — the author only. The DM may delete, but not rewrite.
notesRouter.put('/:id', requireActor, async (req, res, next) => {
  try {
    const parsed = parseInput(req.body, true)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }

    const existing = await prisma.note.findFirst({
      where: { id: req.params.id, ...noteVisibility(req.isDm, req.playerId) },
    })
    if (!existing) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (existing.authorId !== req.playerId) {
      res.status(401).json({ error: 'Only the author can edit a note' })
      return
    }

    const visibility = parsed.visibility ?? (existing.visibility as NoteVisibility)
    const shapeError = checkShape(
      existing.placement as NotePlacement,
      existing.subjectId,
      visibility,
    )
    if (shapeError) {
      res.status(400).json({ error: shapeError })
      return
    }

    const row = await prisma.note.update({
      where: { id: req.params.id },
      // placement and subject are fixed at creation: moving a note between the
      // vault and an entry is a different note.
      data: { visibility, title: parsed.title, bodyMd: parsed.bodyMd },
      include: INCLUDE_AUTHOR,
    })
    res.json(serializeNote(row))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/notes/:id — the author, or the DM tidying up.
notesRouter.delete('/:id', requireActor, async (req, res, next) => {
  try {
    const existing = await prisma.note.findFirst({
      where: { id: req.params.id, ...noteVisibility(req.isDm, req.playerId) },
      select: { id: true, authorId: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (!canModify(existing, req.isDm, req.playerId)) {
      res.status(401).json({ error: 'Only the author or the DM can delete a note' })
      return
    }

    await prisma.note.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
