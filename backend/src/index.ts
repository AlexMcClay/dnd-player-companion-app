import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { env } from './env.js'
import { attachIdentity } from './middleware/identity.js'
import { backupRouter } from './routes/backup.js'
import { ddbRouter } from './routes/ddb.js'
import { entitiesRouter } from './routes/entities.js'
import { holdingsRouter } from './routes/holdings.js'
import { notesRouter } from './routes/notes.js'
import { uploadsRouter } from './routes/uploads.js'

const app = express()

app.use(cors())
// Identity is read from headers alone, so it can be settled before any body is.
app.use(attachIdentity)

// Ahead of the app-wide limit on purpose: a backup is the one request that is
// legitimately large, and it brings its own parser. Everything below stays
// capped at a size no note or entry has any business exceeding.
app.use('/api/backup', backupRouter)

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => {
  res.json({ ok: true, dm: req.isDm, playerId: req.playerId })
})

// Lets the UI confirm a typed passphrase before storing it.
app.post('/api/dm/verify', (req, res) => {
  res.status(req.isDm ? 200 : 401).json({ ok: req.isDm })
})

app.use('/api/entities', entitiesRouter)
app.use('/api/holdings', holdingsRouter)
app.use('/api/notes', notesRouter)
app.use('/api/ddb', ddbRouter)
app.use('/api/uploads', uploadsRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // A body over the parser's limit is the caller's problem, not ours, and
  // "Internal error" is a bad thing to tell someone restoring a large backup.
  if ((err as { type?: string } | null)?.type === 'entity.too.large') {
    res.status(413).json({ error: 'That is too large to send in one request' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal error' })
})

app.listen(env.port, () => {
  console.log(`api listening on http://localhost:${env.port}`)
  // Worth printing: if this says localhost, images will break on every device
  // except this one.
  console.log(
    `images served from ${env.s3.publicUrl}` +
      (env.s3.hostAutoDetected ? ' (auto-detected; set S3_PUBLIC_HOST to pin it)' : ''),
  )
})
