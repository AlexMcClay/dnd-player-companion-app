import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import type { Entity, Knowledge } from '@codex/shared'
import { LuEyeOff, LuLoader, LuSparkles, LuTag } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { listVariants, rowVariants, SPRING } from '../lib/motion'
import { templateFor } from '../templates'
import { cx, pillClass, rowClass } from './ui'

const MotionLink = motion.create(Link)

/** Image box. Falls back to the template's placeholder when there is no art. */
export function Portrait({
  entity,
  size,
  aspect,
  style,
  className,
}: {
  entity: Pick<Entity, 'imageUrl' | 'name' | 'type'>
  size?: number
  aspect?: string
  style?: CSSProperties
  className?: string
}) {
  const template = templateFor(entity.type)
  const Icon = template.icon
  const box: CSSProperties = size
    ? { width: size, height: size, ...style }
    : { width: '100%', aspectRatio: aspect ?? '3 / 2', ...style }

  return (
    <div
      className={cx(
        'port-fill grid shrink-0 place-items-center overflow-hidden border border-line',
        className,
      )}
      style={box}
    >
      {entity.imageUrl ? (
        <motion.img
          src={entity.imageUrl}
          alt={entity.name}
          loading="lazy"
          className="block size-full object-cover"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        />
      ) : size && size <= 56 ? (
        // Small boxes get the type glyph; large ones keep the placeholder word.
        <Icon className="size-[42%] text-ink-ghost" aria-hidden />
      ) : (
        <span className="p-1 text-center font-mono text-[8px] tracking-[0.12em] text-ink-wisp uppercase">
          {template.portraitWord}
        </span>
      )}
    </div>
  )
}

const KNOWLEDGE_LABEL: Record<Knowledge, string> = {
  known: 'Known',
  rumoured: 'Rumoured',
  unknown: 'Sealed',
}

/**
 * Players only ever see rumoured/known — the API filters unknown out — so a
 * "Sealed" pill on screen means the DM is looking.
 */
export function KnowledgePill({ knowledge }: { knowledge: Knowledge }) {
  if (knowledge === 'known') return null
  const rumoured = knowledge === 'rumoured'
  return (
    <span className={pillClass(rumoured ? 'gold' : 'neutral')}>
      {rumoured ? <LuSparkles aria-hidden /> : <LuEyeOff aria-hidden />}
      {KNOWLEDGE_LABEL[knowledge]}
    </span>
  )
}

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.75">
      {tags.map((tag) => (
        <motion.span key={tag} whileTap={{ scale: 0.94 }} transition={SPRING}>
          <Link to={`/search?tag=${encodeURIComponent(tag)}`} className={pillClass('neutral')}>
            <LuTag aria-hidden />
            {tag}
          </Link>
        </motion.span>
      ))}
    </div>
  )
}

/** Wraps a run of EntityRows so they fade in one after another. */
export function StaggerList({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={listVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

/** List row used across every tab. Picks up stagger from a parent StaggerList. */
export function EntityRow({
  entity,
  portraitSize = 46,
  right,
}: {
  entity: Entity
  portraitSize?: number
  right?: ReactNode
}) {
  return (
    <MotionLink
      to={`/e/${entity.id}`}
      className={cx(rowClass, entity.knowledge === 'unknown' && 'opacity-55')}
      variants={rowVariants}
      whileTap={{ scale: 0.985, backgroundColor: 'rgba(236,230,220,0.04)' }}
      transition={SPRING}
    >
      <Portrait entity={entity} size={portraitSize} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2.5">
          <span className="type-name">{entity.name}</span>
          <KnowledgePill knowledge={entity.knowledge} />
        </div>
        {entity.summary && <div className="type-meta mt-0.5">{entity.summary}</div>}
      </div>
      {right}
    </MotionLink>
  )
}

/** Title block at the top of every page, with the gold rule under it. */
export function PageHead({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2.25 border-b border-line pt-4.5 pb-3.5">{children}</div>
  )
}

export function SectionHead({ label, note }: { label: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2.5">
      <span className="type-lab">{label}</span>
      {note && <span className="type-meta">{note}</span>}
    </div>
  )
}

export function Loading() {
  return (
    <div className="px-3 py-10 text-center">
      <motion.span
        className="inline-grid place-items-center text-[22px] text-gold"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
      >
        <LuLoader aria-hidden />
      </motion.span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="px-3 py-10 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <span className="type-meta">{children}</span>
    </motion.div>
  )
}

/** Section wrapper that eases in — used for the stacked blocks on each tab. */
export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.section>
  )
}
