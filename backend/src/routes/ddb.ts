import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { env } from '../env.js'
import {
  describeClasses,
  DdbError,
  fetchCharacter,
  fetchPartyInventory,
  isValidCharacterId,
  totalLevel,
} from '../lib/ddb.js'
import { prisma } from '../lib/prisma.js'
import { serializeDdbParty, serializeDdbSnapshot } from '../lib/serialize.js'
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

/**
 * Which campaign the party inventory belongs to.
 *
 * A configured id wins; otherwise it is read off whichever character is linked,
 * since D&D Beyond puts the campaign in every character payload. That keeps the
 * common case configuration-free.
 *
 * The name only comes back when it was derived — D&D Beyond does not put it in
 * the party response. It is worth having, because it is the visible difference
 * between a campaign that exists and a mistyped id: see the note on the sync
 * route about empty results.
 */
async function resolveCampaign(): Promise<{ id: string; name: string | null }> {
  if (isValidCharacterId(env.ddbCampaignId)) return { id: env.ddbCampaignId, name: null }

  const players = await prisma.entity.findMany({
    where: { type: 'player' },
    select: { data: true },
  })

  for (const player of players) {
    const id = (player.data as { ddbCharacterId?: unknown } | null)?.ddbCharacterId
    if (!isValidCharacterId(id)) continue

    const character = await fetchCharacter(id)
    if (character.campaign) return character.campaign
  }

  throw new DdbError(
    400,
    'No campaign to sync. Link a D&D Beyond character to someone first, or set DDB_CAMPAIGN_ID.',
  )
}

// GET /api/ddb/party — the shared purse and items, or null if never synced.
//
// Registered before /:playerId, or Express matches "party" as a player id and
// these two routes become unreachable.
ddbRouter.get('/party', async (_req, res, next) => {
  try {
    const row = await prisma.ddbPartySnapshot.findFirst({ orderBy: { syncedAt: 'desc' } })
    res.json(row ? serializeDdbParty(row) : null)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/ddb/party/sync — any member of the table, like the app's own stash.
 *
 * Note that D&D Beyond answers 200 with `success: true` and an entirely empty
 * party for a campaign that does not exist, rather than a 404. A mistyped
 * DDB_CAMPAIGN_ID therefore looks exactly like a party that owns nothing. The
 * snapshot is keyed by campaign id, so the real one is never overwritten — but
 * the panel warns when a sync comes back empty, because that is the only signal
 * there is.
 */
ddbRouter.post('/party/sync', requireActor, async (req, res, next) => {
  try {
    const campaign = await resolveCampaign()
    const party = await fetchPartyInventory(campaign.id)

    const existing = await prisma.ddbPartySnapshot.findUnique({
      where: { campaignId: campaign.id },
    })

    const fields = {
      // Keep a name we already knew if this sync could not supply one.
      campaignName: campaign.name ?? existing?.campaignName ?? null,
      currencies: party.currencies as unknown as Prisma.InputJsonValue,
      items: party.items as unknown as Prisma.InputJsonValue,
      syncedAt: new Date(),
    }

    const row = await prisma.ddbPartySnapshot.upsert({
      where: { campaignId: campaign.id },
      create: { campaignId: campaign.id, ...fields },
      update: fields,
    })

    res.json(serializeDdbParty(row))
  } catch (err) {
    if (err instanceof DdbError) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

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
