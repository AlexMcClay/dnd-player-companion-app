import { Link } from 'react-router-dom'
import { useIsDm } from '../lib/dm'
import { templateFor } from '../templates'

/** Create buttons, shown only in DM mode. Writes are enforced server-side. */
export default function DmCreateBar({ types }: { types: string[] }) {
  const isDm = useIsDm()
  if (!isDm) return null

  return (
    <div className="stack gap-8" style={{ marginTop: 4 }}>
      <div className="divider" />
      {types.map((type) => (
        <Link key={type} to={`/new?type=${type}`} className="cta cta-ghost">
          New {templateFor(type).label}
        </Link>
      ))}
    </div>
  )
}
