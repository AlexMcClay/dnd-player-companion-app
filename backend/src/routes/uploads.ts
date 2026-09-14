import { Router } from 'express'
import type { PresignResponse } from '@codex/shared'
import { buildObjectKey, presignPut, publicUrlFor } from '../lib/s3.js'
import { requireDm } from '../middleware/identity.js'

export const uploadsRouter = Router()

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])

// POST /api/uploads/presign — the browser PUTs the file straight to S3/MinIO,
// so image bytes never pass through this server.
uploadsRouter.post('/presign', requireDm, async (req, res, next) => {
  try {
    const { filename, contentType, entityType } = req.body ?? {}
    if (typeof filename !== 'string' || !filename) {
      res.status(400).json({ error: 'filename is required' })
      return
    }
    if (typeof contentType !== 'string' || !ALLOWED.has(contentType)) {
      res.status(400).json({ error: `contentType must be one of ${[...ALLOWED].join(', ')}` })
      return
    }

    const key = buildObjectKey(typeof entityType === 'string' ? entityType : 'misc', filename)
    const body: PresignResponse = {
      key,
      uploadUrl: await presignPut(key, contentType),
      publicUrl: publicUrlFor(key)!,
    }
    res.json(body)
  } catch (err) {
    next(err)
  }
})
