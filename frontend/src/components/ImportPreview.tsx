/**
 * What an import would do, and the DM's say over the parts that would overwrite
 * something.
 *
 * Two questions, answered separately. *What is in this file?* — every record is
 * named, typed, and can be opened to see the values it carries, because a batch
 * written by someone's AI is otherwise a number you are asked to trust. *What
 * would it overwrite?* — every row landing on an existing one shows yours
 * beside the file's, because "replace 659 entries" is not a thing anyone can
 * consent to without being told what changes.
 *
 * New records carry no choice: they overwrite nothing, so there is nothing to
 * consent to. They are listed to be read, not decided.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LuChevronRight, LuCirclePlus, LuInfo, LuTriangleAlert } from 'react-icons/lu'
import type {
  ArchiveConflict,
  ArchiveCreate,
  ArchiveKindPlan,
  ArchivePreview,
  ArchiveResolution,
} from '@codex/shared'
import { SPRING } from '../lib/motion'
import { templateFor } from '../templates'
import { cx, Pill, PillButton } from './ui'

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

/**
 * Restoring a backup is hundreds of rows. Past this many the list stops being
 * something you read and starts being something you scroll past, so it is cut
 * and counted instead — the same bargain the error list makes.
 */
const LIST_CAP = 40

/* ── naming things ────────────────────────────────────────────────── */

/** Columns, which belong to no template and so are named here. */
const FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  summary: 'Summary',
  bodyMd: 'Body',
  imageKey: 'Image',
  knowledge: 'Knowledge',
  tags: 'Tags',
  quantity: 'Quantity',
  note: 'Note',
  visibility: 'Visibility',
  title: 'Title',
  placement: 'Placement',
  syncedAt: 'Last synced',
}

/**
 * `data.armorClass` -> `Armour class`, by asking the same template the entry
 * page renders with. An unrecognised key keeps its raw name rather than being
 * hidden or prettified: a key the app does not know is exactly what a
 * hand-written batch gets wrong, and it has to be visible to be spotted.
 */
function fieldLabel(field: string, type?: string): string {
  if (!field.startsWith('data.')) return FIELD_LABEL[field] ?? field
  const key = field.slice(5)
  const def = type ? templateFor(type).fields.find((f) => f.key === key) : undefined
  return def?.label ?? key
}

function fieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

/* ── the preview ──────────────────────────────────────────────────── */

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
          {preview.errors.slice(0, LIST_CAP).map((issue, index) => (
            <span key={index} className="type-meta text-danger">
              <code className="text-ink-faint">{issue.path}</code> {issue.message}
            </span>
          ))}
          {preview.errors.length > LIST_CAP && (
            <span className="type-meta text-ink-faint">
              …and {preview.errors.length - LIST_CAP} more
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
        if (plan.creates.length === 0 && plan.conflicts.length === 0) return null
        return (
          <KindBlock
            key={key}
            label={label}
            unit={unit}
            plan={plan}
            resolutions={resolutions}
            set={set}
          />
        )
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
  // Collapsed by default: the compact summary is what you want on the way to
  // pressing Import, and a full backup would otherwise open to 800 rows.
  const [showNew, setShowNew] = useState(false)

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
          {plan.creates.length > 0 && (
            <PillButton
              tone={showNew ? 'solid' : 'gold'}
              aria-expanded={showNew}
              onClick={() => setShowNew((open) => !open)}
            >
              <LuCirclePlus aria-hidden />
              {plan.creates.length} new
              <Caret open={showNew} />
            </PillButton>
          )}
          {plan.conflicts.length > 0 && (
            <Pill tone="neutral">
              {plan.conflicts.length} already here
              {identical > 0 && differing.length > 0 && ` · ${differing.length} differ`}
            </Pill>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showNew && (
          <motion.div
            className="flex flex-col overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
          >
            {plan.creates.slice(0, LIST_CAP).map((create) => (
              <CreateRow key={create.path} create={create} />
            ))}
            {plan.creates.length > LIST_CAP && (
              <span className="type-meta py-2 text-ink-faint">
                …and {plan.creates.length - LIST_CAP} more
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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

/* ── rows ─────────────────────────────────────────────────────────── */

const ROW = 'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-soft py-2 last:border-b-0'
const SUMMARY = 'flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden'

/** Rotates with the disclosure it belongs to, which React knows the state of. */
function Caret({ open }: { open: boolean }) {
  return <LuChevronRight className={cx('transition-transform', open && 'rotate-90')} aria-hidden />
}

/**
 * The same caret for a native <details>, whose open state React never sees —
 * so the rotation is driven by CSS off the element's own `[open]` instead.
 */
function RowCaret() {
  return (
    <LuChevronRight
      className="shrink-0 text-ink-faint transition-transform group-open:rotate-90"
      aria-hidden
    />
  )
}

/**
 * What kind of thing this is, in the app's own word for it — "Bestiary" is a
 * section heading, so `label` is used rather than `plural`.
 */
function TypeChip({ type }: { type?: string }) {
  if (!type) return null
  const template = templateFor(type)
  const Icon = template.icon
  return (
    <span className="type-meta flex shrink-0 items-center gap-1.25 text-ink-faint">
      <Icon aria-hidden />
      {template.label}
    </span>
  )
}

/** Marks a row as adding something or as landing on something already there. */
function Marker({ adding }: { adding: boolean }) {
  return (
    <span
      className={cx(
        'w-17 shrink-0 text-[9.5px] tracking-[0.13em] uppercase',
        adding ? 'text-gold' : 'text-ink-dim',
      )}
    >
      {adding ? 'New' : 'Replaces'}
    </span>
  )
}

function CreateRow({ create }: { create: ArchiveCreate }) {
  const fields = Object.keys(create.incoming)

  return (
    <details className={cx(ROW, 'group')}>
      <summary className={cx(SUMMARY, 'min-w-0 flex-1')}>
        <RowCaret />
        <Marker adding />
        <TypeChip type={create.type} />
        <span className="type-name truncate text-[15px]">{create.label}</span>
      </summary>
      <FieldList type={create.type} fields={fields} incoming={create.incoming} />
    </details>
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
    <motion.div className={ROW} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/*
        The buttons sit outside the <details>, not inside its <summary>. A click
        anywhere in a summary toggles it, so a Replace button in there would
        open and close the row every time it was pressed.
      */}
      <details className="group min-w-0 flex-1">
        <summary className={SUMMARY}>
          <RowCaret />
          <Marker adding={false} />
          <TypeChip type={conflict.type} />
          <span className="type-name truncate text-[15px]">{conflict.label}</span>
          <span className="type-meta truncate text-ink-faint">
            {conflict.changed.map((field) => fieldLabel(field, conflict.type)).join(', ')}
          </span>
        </summary>
        <FieldList
          type={conflict.type}
          fields={conflict.changed}
          existing={conflict.existing}
          incoming={conflict.incoming}
        />
      </details>

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

/**
 * The values themselves — the whole point of opening a row.
 *
 * One component for both cases: with `existing` it reads as a change, without
 * it as what would be written. The backend sends both maps in the same shape
 * and clips long strings to a glimpse, so there is nothing to format here
 * beyond naming the field.
 */
function FieldList({
  type,
  fields,
  existing,
  incoming,
}: {
  type?: string
  fields: string[]
  existing?: Record<string, unknown>
  incoming: Record<string, unknown>
}) {
  if (fields.length === 0) {
    return <div className="type-meta py-1.5 pl-8 text-ink-faint">Nothing but its name.</div>
  }

  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-1.5 pl-8 text-[13px]">
      {fields.map((field) => (
        <div key={field} className="contents">
          <dt className="type-meta self-start pt-0.5">{fieldLabel(field, type)}</dt>
          {/* min-w-0 so a long value wraps in its track instead of widening it. */}
          <dd className="m-0 flex min-w-0 flex-col gap-0.5">
            {existing && (
              <span className="text-ink-dim line-through decoration-ink-ghost">
                {fieldValue(existing[field])}
              </span>
            )}
            <span className={existing ? 'text-ink' : 'text-ink-soft'}>
              {fieldValue(incoming[field])}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
