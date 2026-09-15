/**
 * Backup and restore, for the DM only.
 *
 * Three steps rather than one upload: the file is planned against the database
 * and the plan is shown, the DM says what to do about anything that already
 * exists, and only then is anything written. An import can add and it can
 * overwrite what it is told to overwrite — it never deletes.
 */
import express, { Router } from 'express'
import { type ArchiveResolution } from '@codex/shared'
import { normalizeArchive, planArchive } from '../lib/archive.js'
import { applyPlan, exportArchive, loadSnapshot } from '../lib/archiveDb.js'
import { prisma } from '../lib/prisma.js'
import { requireDm } from '../middleware/identity.js'

export const backupRouter = Router()

backupRouter.use(requireDm)
// A backup of a campaign with the SRD loaded is a few hundred kilobytes today,
// but it only grows. This router is mounted ahead of the app-wide 1 MB parser
// so a restore is not refused by a limit that exists to keep note-sized
// requests note-sized.
backupRouter.use(express.json({ limit: '20mb' }))

function parseResolutions(value: unknown): Record<string, ArchiveResolution> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, ArchiveResolution> = {}
  for (const [key, choice] of Object.entries(value as Record<string, unknown>)) {
    if (choice === 'skip' || choice === 'replace') out[key] = choice
  }
  return out
}

/** Every conflict the plan found, as the keys a resolution map is built from. */
function conflictKeys(preview: ReturnType<typeof planArchive>['preview']): Set<string> {
  return new Set(
    [preview.entities, preview.holdings, preview.notes, preview.ddb].flatMap((kind) =>
      kind.conflicts.map((conflict) => conflict.key),
    ),
  )
}

// GET /api/backup/export
backupRouter.get('/export', async (_req, res, next) => {
  try {
    const archive = await exportArchive()
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="codex-backup-${date}.json"`)
    res.send(JSON.stringify(archive, null, 2))
  } catch (err) {
    next(err)
  }
})

// POST /api/backup/preview — what an import would do, without doing any of it.
backupRouter.post('/preview', async (req, res, next) => {
  try {
    const normalized = normalizeArchive((req.body as { archive?: unknown } | null)?.archive)
    if ('fatal' in normalized) {
      res.status(400).json({ error: normalized.fatal })
      return
    }

    const db = await loadSnapshot(prisma)
    const plan = planArchive(normalized.archive, db, {})
    plan.preview.warnings.unshift(...normalized.warnings)
    res.json(plan.preview)
  } catch (err) {
    next(err)
  }
})

// POST /api/backup/import
backupRouter.post('/import', async (req, res, next) => {
  try {
    const body = req.body as { archive?: unknown; resolutions?: unknown } | null
    const normalized = normalizeArchive(body?.archive)
    if ('fatal' in normalized) {
      res.status(400).json({ error: normalized.fatal })
      return
    }
    const resolutions = parseResolutions(body?.resolutions)

    const db = await loadSnapshot(prisma)
    const plan = planArchive(normalized.archive, db, resolutions)

    if (plan.preview.errors.length > 0) {
      res.status(400).json({
        error: `${plan.preview.errors.length} problem${plan.preview.errors.length === 1 ? '' : 's'} in that file`,
        errors: plan.preview.errors,
      })
      return
    }

    // The DM approved a specific set of overwrites. If the database has moved
    // since — someone edited an entry, a sync ran — those choices no longer
    // describe what would happen, so ask again rather than guess.
    const keys = conflictKeys(plan.preview)
    const chosen = Object.keys(resolutions)
    const stale = chosen.filter((key) => !keys.has(key))
    if (stale.length > 0) {
      res.status(409).json({ error: 'The database changed since that preview — preview again' })
      return
    }

    res.json(await applyPlan(plan))
  } catch (err) {
    next(err)
  }
})
