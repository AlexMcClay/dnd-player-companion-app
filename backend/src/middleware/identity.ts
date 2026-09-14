import type { NextFunction, Request, Response } from 'express'
import { env } from '../env.js'
import { prisma } from '../lib/prisma.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      isDm: boolean
      /** Character the viewer claims to be. Unverified — see requireActor. */
      playerId: string | null
    }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Runs on every request, so read routes can widen what they return without a
 * second code path.
 *
 * `playerId` is taken at face value here and only checked against the database
 * on writes. There is no password behind it: anyone can claim to be any
 * character, exactly as anyone holding the passphrase is the DM. That is the
 * accepted trust model for one table of friends — see the README.
 */
export function attachIdentity(req: Request, _res: Response, next: NextFunction): void {
  const key = req.header('x-dm-key')
  req.isDm = typeof key === 'string' && key.length > 0 && key === env.dmKey

  const playerId = req.header('x-player-id')
  req.playerId = typeof playerId === 'string' && UUID.test(playerId) ? playerId : null

  next()
}

/** Guards anything only the DM may do: authoring entities, uploading images. */
export function requireDm(req: Request, res: Response, next: NextFunction): void {
  if (!req.isDm) {
    res.status(401).json({ error: 'DM key required' })
    return
  }
  next()
}

/**
 * Guards writes any member of the table may make, such as moving items around.
 * The DM passes outright; a player must resolve to a live player entity, so a
 * made-up uuid is rejected rather than silently creating orphaned rows.
 */
export async function requireActor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.isDm) {
    next()
    return
  }

  if (!req.playerId) {
    res.status(401).json({ error: 'Pick a character first' })
    return
  }

  const player = await prisma.entity.findFirst({
    where: { id: req.playerId, type: 'player' },
    select: { id: true },
  })

  if (!player) {
    res.status(401).json({ error: 'Unknown character' })
    return
  }

  next()
}
