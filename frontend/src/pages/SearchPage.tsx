import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Empty, EntityRow, Loading, SectionHead } from '../components/bits'
import { ENTITY_TYPES } from '@codex/shared'
import { templateFor } from '../templates'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tag = params.get('tag') ?? ''

  const results = useQuery({
    queryKey: ['entities', 'search', { q, tag }],
    queryFn: () => api.listEntities({ q: q || undefined, tag: tag || undefined }),
    enabled: q.trim().length > 0 || tag.length > 0,
  })

  function update(next: { q?: string; tag?: string }) {
    const merged = new URLSearchParams()
    const nq = next.q ?? q
    const ntag = next.tag ?? tag
    if (nq) merged.set('q', nq)
    if (ntag) merged.set('tag', ntag)
    setParams(merged, { replace: true })
  }

  const grouped = ENTITY_TYPES.map((type) => ({
    type,
    template: templateFor(type),
    entities: (results.data ?? []).filter((entity) => entity.type === type),
  })).filter((group) => group.entities.length > 0)

  const other = (results.data ?? []).filter(
    (entity) => !(ENTITY_TYPES as readonly string[]).includes(entity.type),
  )

  return (
    <>
      <div className="head">
        <h1 className="ttl">Search</h1>
        <input
          className="input"
          type="search"
          autoFocus
          value={q}
          placeholder="People, beasts, items, recipes…"
          onChange={(e) => update({ q: e.target.value })}
        />
        {tag && (
          <div className="pill-row">
            <button type="button" className="pill pill-s" onClick={() => update({ tag: '' })}>
              tag: {tag} ×
            </button>
          </div>
        )}
      </div>

      {!q.trim() && !tag && <Empty>Type to search everything the party knows</Empty>}

      {results.isLoading && <Loading />}

      {results.data && results.data.length === 0 && <Empty>Nothing matched</Empty>}

      <div className="stack gap-16">
        {grouped.map((group) => (
          <section key={group.type} className="stack gap-8">
            <SectionHead label={group.template.plural} note={`${group.entities.length}`} />
            <div>
              {group.entities.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={40} />
              ))}
            </div>
          </section>
        ))}

        {other.length > 0 && (
          <section className="stack gap-8">
            <SectionHead label="Other" note={`${other.length}`} />
            <div>
              {other.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={40} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
