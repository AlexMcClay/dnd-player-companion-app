import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import type { Entity, Knowledge } from '@codex/shared'
import { LuEyeOff, LuLoader, LuSparkles, LuTag } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { listVariants, rowVariants, SPRING } from '../lib/motion'
import { templateFor } from '../templates'

const MotionLink = motion.create(Link)

/** Image box. Falls back to the template's placeholder word when there is no art. */
export function Portrait({
  entity,
  size,
  aspect,
  style,
}: {
  entity: Pick<Entity, 'imageUrl' | 'name' | 'type'>
  size?: number
  aspect?: string
  style?: CSSProperties
}) {
  const template = templateFor(entity.type)
  const Icon = template.icon
  const box: CSSProperties = size
    ? { width: size, height: size, ...style }
    : { width: '100%', aspectRatio: aspect ?? '3 / 2', ...style }

  return (
    <div className="port" style={box}>
      {entity.imageUrl ? (
        <motion.img
          src={entity.imageUrl}
          alt={entity.name}
          loading="lazy"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        />
      ) : size && size <= 56 ? (
        // Small boxes get the type glyph; large ones keep the placeholder word.
        <Icon className="port-glyph" aria-hidden />
      ) : (
        <span>{template.portraitWord}</span>
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
    <span className={rumoured ? 'pill with-icon' : 'pill pill-n with-icon'}>
      {rumoured ? <LuSparkles aria-hidden /> : <LuEyeOff aria-hidden />}
      {KNOWLEDGE_LABEL[knowledge]}
    </span>
  )
}

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="pill-row">
      {tags.map((tag) => (
        <motion.span key={tag} whileTap={{ scale: 0.94 }} transition={SPRING}>
          <Link to={`/search?tag=${encodeURIComponent(tag)}`} className="pill pill-n with-icon">
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
      className={entity.knowledge === 'unknown' ? 'row dimmed' : 'row'}
      variants={rowVariants}
      whileTap={{ scale: 0.985, backgroundColor: 'rgba(236,230,220,0.04)' }}
      transition={SPRING}
    >
      <Portrait entity={entity} size={portraitSize} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-between">
          <span className="name">{entity.name}</span>
          <KnowledgePill knowledge={entity.knowledge} />
        </div>
        {entity.summary && (
          <div className="meta" style={{ marginTop: 2 }}>
            {entity.summary}
          </div>
        )}
      </div>
      {right}
    </MotionLink>
  )
}

export function SectionHead({ label, note }: { label: string; note?: string }) {
  return (
    <div className="row-between" style={{ alignItems: 'baseline' }}>
      <span className="lab">{label}</span>
      {note && <span className="meta">{note}</span>}
    </div>
  )
}

export function Loading() {
  return (
    <div className="empty">
      <motion.span
        className="spinner"
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
    <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <span className="meta">{children}</span>
    </motion.div>
  )
}

/** Section wrapper that eases in — used for the stacked blocks on each tab. */
export function Section({ children, ...rest }: { children: ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...rest}
    >
      {children}
    </motion.section>
  )
}
