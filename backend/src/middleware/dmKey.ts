import type { NextFunction, Request, Response } from 'express'
import { env } from '../env.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      isDm: boolean
    }
  }
}

/**
 * Runs on every request. Sets `req.isDm` from the x-dm-key header so read
 * routes can widen what they return without a second code path.
 */
export function attachDm(req: Request, _res: Response, next: NextFunction): void {
  const key = req.header('x-dm-key')
  req.isDm = typeof key === 'string' && key.length > 0 && key === env.dmKey
  next()
}

/** Guards every write. Not real auth — a shared passphrase for one table's DM. */
export function requireDm(req: Request, res: Response, next: NextFunction): void {
  if (!req.isDm) {
    res.status(401).json({ error: 'DM key required' })
    return
  }
  next()
}
