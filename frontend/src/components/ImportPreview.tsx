/**
 * What an import would do, and the DM's say over the parts that would overwrite
 * something.
 *
 * New entries need no decision — nothing is at risk — so they are a count. Every
 * row that would land on an existing one is listed with the fields that differ,
 * because "replace 659 entries" is not a thing anyone can consent to without
 * being told what changes.
 */
import { motion } from 'framer-motion'
import { LuCirclePlus, LuInfo, LuTriangleAlert } from 'react-icons/lu'
import type {
  ArchiveConflict,
  ArchiveKindPlan,
  ArchivePreview,
  ArchiveResolution,
} from '@codex/shared'
import { Pill, PillButton } from './ui'

export interface ImportPreviewProps {
  preview: ArchivePreview
  resolutions: Record<string, ArchiveResolution>
  onChange: (next: Record<string, ArchiveResolution>) => void
}

const KINDS: Array<{ key: keyof ArchivePreview & string; label: string; unit: string }> = [
  { key: 'entities', label: 'Entries', unit: 'entry' },
  { key: 'holdings', label: 'Items held', unit: 'stack' },
  { key: 'notes', label: 'Notes', unit: 'note' },
  { key: 'ddb', label: 'D&D Beyond', unit: 'sheet' },
]

export default function ImportPreview({ preview, resolutions, onChange }: ImportPreviewProps) {
  const set = (keys: string[], choice: ArchiveResolution) => {
    const next = { ...resolutions }
    for (const key of keys) next[key] = choice
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3.5">
      {preview.errors.length > 0 && (
        <div className="flex flex-col gap-1.25 border border-danger-line p-2.75">
          <span className="type-lab flex items-center gap-1.75 text-danger">
            <LuTriangleAlert aria-hidden />
            {preview.errors.length} {preview.errors.length === 1 ? 'problem' : 'problems'} — nothing
            can be imported until these are fixed
          </span>
          {preview.errors.slice(0, 40).map((issue, index) => (
            <span key={index} className="type-meta text-danger">
              <code className="text-ink-faint">{issue.path}</code> {issue.message}
            </span>
          ))}
          {preview.errors.length > 40 && (
            <span className="type-meta text-ink-faint">
              …and {preview.errors.length - 40} more
            </span>
          )}
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="flex flex-col gap-1.25">
          {preview.warnings.slice(0, 12).map((issue, index) => (
            <span key={index} className="type-meta flex items-start gap-1.75 text-ink-dim">
              <LuInfo className="mt-0.5 shrink-0" aria-hidden />
              {issue.message}
            </span>
          ))}
        </div>
      )}

      {KINDS.map(({ key, label, unit }) => {
        const plan = preview[key] as ArchiveKindPlan
        if (plan.create === 0 && plan.conflicts.length === 0) return null
        return <KindBlock key={key} label={label} unit={unit} plan={plan} resolutions={resolutions} set={set} />
      })}
    </div>
  )
}

function KindBlock({
  label,
  unit,
  plan,
  resolutions,
  set,
}: {
  label: string
  unit: string
  plan: ArchiveKindPlan
  resolutions: Record<string, ArchiveResolution>
  set: (keys: string[], choice: ArchiveResolution) => void
}) {
  const keys = plan.conflicts.map((conflict) => conflict.key)
  // A row that is byte-for-byte what is already there is not a decision worth
  // making. Restoring a backup is almost entirely these.
  const identical = plan.conflicts.filter((conflict) => conflict.changed.length === 0).length
  const differing = plan.conflicts.filter((conflict) => conflict.changed.length > 0)

  return (
    <section className="flex flex-col gap-2 border border-line p-2.75">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="type-lab">{label}</span>
        <div className="flex items-center gap-1.5">
          {plan.create > 0 && (
            <Pill tone="gold">
              <LuCirclePlus aria-hidden />
              {plan.create} new
            </Pill>
          )}
          {plan.conflicts.length > 0 && (
            <Pill tone="neutral">
              {plan.conflicts.length} already here
              {identical > 0 && differing.length > 0 && ` · ${differing.length} differ`}
            </Pill>
          )}
        </div>
      </div>

      {plan.conflicts.length > 0 && (
        <>
          <div className="flex items-center gap-1.5">
            <PillButton tone="neutral" onClick={() => set(keys, 'skip')}>
              Keep mine
            </PillButton>
            <PillButton tone="neutral" onClick={() => set(keys, 'replace')}>
              Use the file
            </PillButton>
            <span className="type-meta text-ink-faint">for all {plan.conflicts.length}</span>
          </div>

          <div className="flex flex-col">
            {differing.map((conflict) => (
              <ConflictRow
                key={conflict.key}
                conflict={conflict}
                choice={resolutions[conflict.key] ?? 'skip'}
                onChoose={(choice) => set([conflict.key], choice)}
              />
            ))}
          </div>

          {identical > 0 && (
            <span className="type-meta text-ink-faint">
              {identical} {identical === 1 ? `${unit} is` : `${unit}s are`} already identical —
              importing {identical === 1 ? 'it' : 'them'} changes nothing either way.
            </span>
          )}
        </>
      )}
    </section>
  )
}

function ConflictRow({
  conflict,
  choice,
  onChoose,
}: {
  conflict: ArchiveConflict
  choice: ArchiveResolution
  onChoose: (choice: ArchiveResolution) => void
}) {
  return (
    <motion.div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-soft py-2 last:border-b-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-name truncate text-[15px]">{conflict.label}</span>
        <div className="flex flex-wrap items-center gap-1">
          {conflict.changed.map((field) => (
            <span key={field} className="type-meta text-ink-faint">
              {field}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <PillButton
          tone={choice === 'skip' ? 'solid' : 'neutral'}
          aria-pressed={choice === 'skip'}
          onClick={() => onChoose('skip')}
        >
          Keep
        </PillButton>
        <PillButton
          tone={choice === 'replace' ? 'solid' : 'neutral'}
          aria-pressed={choice === 'replace'}
          onClick={() => onChoose('replace')}
        >
          Replace
        </PillButton>
      </div>
    </motion.div>
  )
}
