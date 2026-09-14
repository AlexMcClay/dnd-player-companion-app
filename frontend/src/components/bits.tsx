import type { CSSProperties, ReactNode } from 'react'
import type { Entity, Knowledge } from '@codex/shared'
import { Link } from 'react-router-dom'
import { templateFor } from '../templates'

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
  const word = templateFor(entity.type).portraitWord
  const box: CSSProperties = size
    ? { width: size, height: size, ...style }
    : { width: '100%', aspectRatio: aspect ?? '3 / 2', ...style }

  return (
    <div className="port" style={box}>
      {entity.imageUrl ? (
        <img src={entity.imageUrl} alt={entity.name} loading="lazy" />
      ) : (
        <span>{word}</span>
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
  return (
    <span className={knowledge === 'rumoured' ? 'pill' : 'pill pill-n'}>
      {KNOWLEDGE_LABEL[knowledge]}
    </span>
  )
}

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="pill-row">
      {tags.map((tag) => (
        <Link key={tag} to={`/search?tag=${encodeURIComponent(tag)}`} className="pill pill-n">
          {tag}
        </Link>
      ))}
    </div>
  )
}

/** List row used across every tab. */
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
    <Link
      to={`/e/${entity.id}`}
      className={entity.knowledge === 'unknown' ? 'row dimmed' : 'row'}
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
    </Link>
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
      <span className="meta">Loading…</span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span className="meta">{children}</span>
    </div>
  )
}
