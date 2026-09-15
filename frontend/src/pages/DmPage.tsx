/**
 * The DM's own screen: take a backup, put one back, and get the instructions
 * for having an AI write entries from session notes.
 *
 * Not a tab. Everything here is for one person, and a sixth tab would reshape
 * the bar for four players who can never use it — so it is reached from the DM
 * panel in the header instead.
 */
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import {
  LuCheck,
  LuClipboardCopy,
  LuDownload,
  LuSparkles,
  LuTriangleAlert,
  LuUpload,
} from 'react-icons/lu'
import {
  ARCHIVE_FORMAT,
  type Archive,
  type ArchivePreview,
  type ArchiveResolution,
  type ImportResult,
} from '@codex/shared'
import { api } from '../api/client'
import ImportPreview from '../components/ImportPreview'
import { Empty, PageHead, Section } from '../components/bits'
import { Cta, ctaClass, cx, textareaClass } from '../components/ui'
import { buildAiGuide } from '../lib/aiGuide'
import { downloadBlob } from '../lib/download'
import { useIsDm } from '../lib/identity'
import { useAllEntities } from '../lib/useAllEntities'

export default function DmPage() {
  const isDm = useIsDm()
  if (!isDm) return <Empty>DM mode required</Empty>
  return <Tools />
}

function Tools() {
  return (
    <div className="flex flex-col gap-7 px-3 pb-8">
      <PageHead>
        <h1 className="type-title m-0">DM tools</h1>
        <p className="type-meta m-0">Backups, and getting new entries in without a seed.</p>
      </PageHead>
      <BackupSection />
      <ImportSection />
      <GuideSection />
    </div>
  )
}

/* ── export ───────────────────────────────────────────────────────── */

function BackupSection() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const blob = await api.exportBackup()
      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `codex-backup-${date}.json`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build a backup')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section className="flex flex-col gap-2.5">
      <span className="type-lab">Backup</span>
      <p className="type-body m-0">
        Every entry, every stack, every note and the D&amp;D Beyond mirrors, as one file. Pictures
        are not in it — those live in storage and are not deleted by anything here.
      </p>
      <Cta tone="ghost" disabled={busy} onClick={() => void download()}>
        <LuDownload aria-hidden />
        {busy ? 'Building…' : 'Download backup'}
      </Cta>
      {error && <ErrorLine>{error}</ErrorLine>}
    </Section>
  )
}

/* ── import ───────────────────────────────────────────────────────── */

function ImportSection() {
  const queryClient = useQueryClient()
  const [filename, setFilename] = useState<string | null>(null)
  const [archive, setArchive] = useState<Archive | null>(null)
  const [preview, setPreview] = useState<ArchivePreview | null>(null)
  const [resolutions, setResolutions] = useState<Record<string, ArchiveResolution>>({})
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setArchive(null)
    setPreview(null)
    setResolutions({})
    setResult(null)
    setError(null)
  }

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset immediately, or a failed second pick leaves the first file's plan
    // on screen looking like it belongs to the new one.
    event.target.value = ''
    if (!file) return
    reset()
    setFilename(file.name)
    setBusy(true)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if ((parsed as { format?: unknown } | null)?.format !== ARCHIVE_FORMAT) {
        throw new Error('That file is not a codex backup or import batch')
      }
      const loaded = parsed as Archive
      setArchive(loaded)
      setPreview(await api.previewImport(loaded))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file')
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!archive) return
    setBusy(true)
    setError(null)
    try {
      const applied = await api.applyImport({ archive, resolutions })
      setResult(applied)
      setPreview(null)
      // Knowledge states, holdings and names can all have moved, so nothing
      // cached is trustworthy — the same sweep the DM's other writes do.
      await queryClient.invalidateQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      // The plan is stale once the server has refused it, so ask for a new one.
      try {
        setPreview(await api.previewImport(archive))
        setResolutions({})
      } catch {
        setPreview(null)
      }
    } finally {
      setBusy(false)
    }
  }

  const blocked = (preview?.errors.length ?? 0) > 0
  const nothing =
    preview !== null &&
    preview.entities.create === 0 &&
    preview.holdings.create === 0 &&
    preview.notes.create === 0 &&
    preview.ddb.create === 0 &&
    Object.values(resolutions).every((choice) => choice === 'skip')

  return (
    <Section className="flex flex-col gap-2.5">
      <span className="type-lab">Import</span>
      <p className="type-body m-0">
        Adds what is new and asks before touching anything that already exists. It never deletes.
      </p>

      <label className={cx(ctaClass('ghost'), busy ? 'cursor-wait' : 'cursor-pointer')}>
        <LuUpload aria-hidden />
        {busy && !preview ? 'Reading…' : filename ? 'Choose a different file' : 'Choose a file'}
        <input type="file" accept=".json,application/json" hidden disabled={busy} onChange={pick} />
      </label>

      {filename && !result && <span className="type-meta text-ink-faint">{filename}</span>}
      {error && <ErrorLine>{error}</ErrorLine>}

      <AnimatePresence initial={false}>
        {preview && (
          <motion.div
            className="flex flex-col gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <ImportPreview
              preview={preview}
              resolutions={resolutions}
              onChange={setResolutions}
            />
            <Cta disabled={busy || blocked || nothing} onClick={() => void apply()}>
              <LuCheck aria-hidden />
              {busy ? 'Importing…' : nothing ? 'Nothing to do' : 'Import'}
            </Cta>
          </motion.div>
        )}
      </AnimatePresence>

      {result && <ResultLine result={result} />}
    </Section>
  )
}

function ResultLine({ result }: { result: ImportResult }) {
  const parts = (
    [
      ['entries', result.entities],
      ['items held', result.holdings],
      ['notes', result.notes],
      ['D&D Beyond', result.ddb],
    ] as const
  )
    .filter(([, counts]) => counts.created > 0 || counts.replaced > 0)
    .map(([label, counts]) => {
      const bits = []
      if (counts.created > 0) bits.push(`${counts.created} added`)
      if (counts.replaced > 0) bits.push(`${counts.replaced} replaced`)
      return `${bits.join(', ')} ${label}`
    })

  return (
    <motion.div
      className="type-body flex items-start gap-1.75 border border-gold-dim p-2.75 text-gold"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <LuCheck className="mt-0.5 shrink-0" aria-hidden />
      {parts.length > 0 ? parts.join(' · ') : 'Nothing needed changing.'}
    </motion.div>
  )
}

/* ── the AI guide ─────────────────────────────────────────────────── */

function GuideSection() {
  const { data: entities } = useAllEntities()
  const guide = useMemo(() => buildAiGuide(entities ?? []), [entities])
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(guide)
    } catch {
      // Not available without HTTPS, which is exactly how this runs on the LAN.
      const field = document.createElement('textarea')
      field.value = guide
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.append(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const count = (entities ?? []).filter((entity) => !entity.tags.includes('srd')).length

  return (
    <Section className="flex flex-col gap-2.5">
      <span className="type-lab">Writing entries with an AI</span>
      <p className="type-body m-0">
        Paste this into a chat, then your session notes under it. What comes back is a file this
        page can import. It already lists all {count} of your campaign entries by name, so the AI
        links to them instead of writing them a second time.
      </p>
      <Cta tone="ghost" onClick={() => void copy()}>
        {copied ? <LuCheck aria-hidden /> : <LuClipboardCopy aria-hidden />}
        {copied ? 'Copied' : 'Copy instructions'}
      </Cta>
      <details className="flex flex-col gap-1.5">
        <summary className="type-meta flex cursor-pointer items-center gap-1.75 text-ink-dim">
          <LuSparkles aria-hidden />
          Read them
        </summary>
        <textarea className={cx(textareaClass, 'mt-2 min-h-70 font-mono text-[12px]')} readOnly value={guide} />
      </details>
    </Section>
  )
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="type-meta flex items-start gap-1.75 text-danger"
      initial={{ x: 0 }}
      animate={{ x: [0, -6, 6, -4, 4, 0] }}
      transition={{ duration: 0.35 }}
    >
      <LuTriangleAlert className="mt-0.5 shrink-0" aria-hidden />
      {children}
    </motion.div>
  )
}
