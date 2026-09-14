import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { describeClasses, DdbError, fetchCharacter, isValidCharacterId, totalLevel } from '../lib/ddb.js'
import { prisma } from '../lib/prisma.js'
import { serializeDdbSnapshot } from '../lib/serialize.js'
import { requireActor } from '../middleware/identity.js'

export const ddbRouter = Router()

/**
 * Syncing is the DM's, or the player's own — the same rule as editing your own
 * character's description, kept deliberately identical rather than invented
 * again.
 */
async function canSync(
  playerId: string,
  isDm: boolean,
  actingAs: string | null,
): Promise<'ok' | 'not-a-player' | 'forbidden'> {
  const player = await prisma.entity.findUnique({
    where: { id: playerId },
    select: { id: true, type: true },
  })
  if (!player || player.type !== 'player') return 'not-a-player'
  if (isDm || player.id === actingAs) return 'ok'
  return 'forbidden'
}

// GET /api/ddb/:playerId — the mirror, or null if never synced.
ddbRouter.get('/:playerId', async (req, res, next) => {
  try {
    const row = await prisma.ddbSnapshot.findUnique({ where: { playerId: req.params.playerId } })
    res.json(row ? serializeDdbSnapshot(row) : null)
  } catch {
    // An unparseable id is simply a character with no snapshot.
    res.json(null)
  }
})

// POST /api/ddb/:playerId/sync
ddbRouter.post('/:playerId/sync', requireActor, async (req, res, next) => {
  try {
    const playerId = req.params.playerId
    if (!playerId) {
      res.status(404).json({ error: 'No such character' })
      return
    }

    const permission = await canSync(playerId, req.isDm, req.playerId)

    if (permission === 'not-a-player') {
      res.status(404).json({ error: 'No such character' })
      return
    }
    if (permission === 'forbidden') {
      res.status(401).json({ error: 'You can only sync your own character' })
      return
    }

    const player = await prisma.entity.findUniqueOrThrow({ where: { id: playerId } })
    const data = (player.data ?? {}) as Record<string, unknown>
    const characterId = data.ddbCharacterId

    if (!isValidCharacterId(characterId)) {
      res.status(400).json({
        error:
          'No D&D Beyond character linked. Set the character id on this character first — it is the number in its D&D Beyond URL.',
      })
      return
    }

    const character = await fetchCharacter(characterId)
    const { className, subclass } = describeClasses(character.classes)

    const snapshot = await prisma.$transaction(async (tx) => {
      // The sheet fields follow D&D Beyond. `data` is merged rather than
      // replaced so `player`, `handle` and ddbCharacterId survive.
      //
      // `name` is deliberately absent: renaming the entity would break every
      // [[wiki-link]] pointing at this character.
      await tx.entity.update({
        where: { id: playerId },
        data: {
          data: {
            ...data,
            ...(character.race ? { race: character.race } : {}),
            ...(className ? { className } : {}),
            ...(subclass ? { subclass } : {}),
            ...(character.classes.length ? { level: totalLevel(character.classes) } : {}),
            ...(character.avatarUrl ? { avatarUrl: character.avatarUrl } : {}),
          } as Prisma.InputJsonValue,
        },
      })

      const fields = {
        ddbCharacterId: characterId,
        name: character.name,
        race: character.race,
        classes: character.classes as unknown as Prisma.InputJsonValue,
        avatarUrl: character.avatarUrl,
        currencies: character.currencies as unknown as Prisma.InputJsonValue,
        items: character.items as unknown as Prisma.InputJsonValue,
        syncedAt: new Date(),
      }

      // Replaced whole, never merged — that is what keeps this inventory and
      // the app's holdings from ever needing reconciliation.
      return tx.ddbSnapshot.upsert({
        where: { playerId },
        create: { playerId, ...fields },
        update: fields,
      })
    })

    res.json(serializeDdbSnapshot(snapshot))
  } catch (err) {
    if (err instanceof DdbError) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})
