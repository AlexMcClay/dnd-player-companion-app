/**
 * Design-system primitives. Tailwind's own advice for a repeated pattern in a
 * React codebase is a component, not a CSS class — so the utility strings live
 * here once and every page composes them.
 */
import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'
import { SPRING } from '../lib/motion'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ── pills ────────────────────────────────────────────────────────── */

export type PillTone = 'gold' | 'neutral' | 'solid' | 'danger'

const PILL_BASE =
  'inline-flex items-center gap-1.75 whitespace-nowrap rounded-full border px-2.5 py-1 text-[9.5px] uppercase tracking-[0.11em]'

const PILL_TONE: Record<PillTone, string> = {
  gold: 'border-gold-dim text-gold',
  neutral: 'border-line text-ink-soft',
  solid: 'border-gold bg-gold-wash text-gold',
  danger: 'border-danger-line text-danger',
}

export function pillClass(tone: PillTone = 'gold', extra?: string): string {
  return cx(PILL_BASE, PILL_TONE[tone], extra)
}

export function Pill({
  tone = 'gold',
  className,
  children,
}: {
  tone?: PillTone
  className?: string
  children: ReactNode
}) {
  return <span className={pillClass(tone, className)}>{children}</span>
}

/** Pill that is a button. Springs on press. */
export function PillButton({
  tone = 'gold',
  className,
  children,
  ...rest
}: { tone?: PillTone } & HTMLMotionProps<'button'>) {
  return (
    <motion.button
      type="button"
      className={pillClass(tone, cx('cursor-pointer', className))}
      whileTap={{ scale: 0.94 }}
      transition={SPRING}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

/**
 * A filter chip: a label, how many rows it would yield, and whether it is on.
 *
 * An empty chip goes dead rather than disappearing — a bar that reflows on
 * every keystroke during a search is worse to use than a dim chip.
 */
export function Chip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}) {
  const empty = count === 0 && !selected

  return (
    <PillButton
      tone={selected ? 'solid' : 'neutral'}
      disabled={empty}
      aria-pressed={selected}
      className={cx(empty && 'opacity-45')}
      onClick={onClick}
    >
      {label}
      <span className={cx('tabular-nums', selected ? 'opacity-70' : 'text-ink-faint')}>
        {count}
      </span>
    </PillButton>
  )
}

/* ── buttons ──────────────────────────────────────────────────────── */

export type CtaTone = 'primary' | 'ghost' | 'danger'

const CTA_BASE =
  'flex w-full cursor-pointer items-center justify-center gap-1.75 py-3.25 text-center text-[10.5px] font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45'

const CTA_TONE: Record<CtaTone, string> = {
  primary: 'cta-fill border-0 text-on-gold',
  ghost: 'border border-gold-dim bg-transparent text-gold',
  danger: 'border border-danger-line bg-transparent text-danger',
}

export function ctaClass(tone: CtaTone = 'primary', extra?: string): string {
  return cx(CTA_BASE, CTA_TONE[tone], extra)
}

export function Cta({
  tone = 'primary',
  className,
  children,
  ...rest
}: { tone?: CtaTone } & HTMLMotionProps<'button'>) {
  return (
    <motion.button
      className={ctaClass(tone, className)}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

/* ── surfaces ─────────────────────────────────────────────────────── */

/** Gold corner brackets, drawn with the two pseudo-elements. */
const CORNERS =
  "before:pointer-events-none before:absolute before:-top-px before:-left-px before:size-3.25 before:border before:border-r-0 before:border-b-0 before:border-gold-dim before:content-[''] " +
  "after:pointer-events-none after:absolute after:-right-px after:-bottom-px after:size-3.25 after:border after:border-t-0 after:border-l-0 after:border-gold-dim after:content-['']"

export function panelClass(extra?: string): string {
  return cx('panel-fill relative border border-line p-3.25', CORNERS, extra)
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={panelClass(className)}>{children}</div>
}

/** Hatched block standing in for content the party has not learned yet. */
export function Sealed({ children }: { children: ReactNode }) {
  return (
    <div className="hatch flex items-center justify-center gap-1.75 border border-line p-3.5 text-center">
      {children}
    </div>
  )
}

export function Divider() {
  return <div className="rule-fade h-px" />
}

/* ── form controls ────────────────────────────────────────────────── */

/**
 * 16px font size is deliberate: anything smaller makes iOS Safari zoom the
 * viewport when the field takes focus.
 */
export const inputClass =
  'w-full min-h-10.5 rounded-none border border-line bg-ink-tint px-3 py-2.75 text-[16px] text-ink focus:border-gold-dim focus:outline-none'

export const textareaClass = cx(inputClass, 'min-h-30 resize-y font-sans leading-relaxed')

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label}
      {children}
    </label>
  )
}

/* ── rows ─────────────────────────────────────────────────────────── */

export const rowClass =
  'flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left last:border-b-0'

/**
 * Inventory lists, two items to a line on a wide screen.
 *
 * A row is a thumbnail, a name and a few small buttons, which leaves most of a
 * 740px line empty. Only the columns are gapped: the rows keep their own bottom
 * border as the separator, so a two-up list still reads as one list rather than
 * as two stacked next to each other.
 *
 * grid-cols-1 is explicit because bare `grid` leaves an implicit `auto` track,
 * which is content-sized and can push past the viewport on a phone.
 */
export const twoUpClass = 'grid grid-cols-1 gap-x-3 md:grid-cols-2'
