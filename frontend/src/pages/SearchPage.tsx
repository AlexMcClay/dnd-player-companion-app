import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { LuSearch, LuX } from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { ENTITY_TYPES } from '@codex/shared'
import { api } from '../api/client'
import { Empty, EntityRow, Loading, Section, SectionHead, StaggerList } from '../components/bits'
import { SPRING } from '../lib/motion'
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
        <div className="input-with-icon">
          <LuSearch className="input-icon" aria-hidden />
          <input
            className="input"
            type="search"
            autoFocus
            value={q}
            placeholder="People, beasts, items, recipes…"
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
        {tag && (
          <div className="pill-row">
            <motion.button
              type="button"
              className="pill pill-s with-icon"
              onClick={() => update({ tag: '' })}
              whileTap={{ scale: 0.94 }}
              transition={SPRING}
            >
              tag: {tag}
              <LuX aria-hidden />
            </motion.button>
          </div>
        )}
      </div>

      {!q.trim() && !tag && <Empty>Type to search everything the party knows</Empty>}

      {results.isLoading && <Loading />}

      {results.data && results.data.length === 0 && <Empty>Nothing matched</Empty>}

      <div className="stack gap-16">
        {grouped.map((group) => {
          const Icon = group.template.icon
          return (
            <Section key={group.type} className="stack gap-8">
              <div className="row-between" style={{ alignItems: 'baseline' }}>
                <span className="lab with-icon">
                  <Icon aria-hidden />
                  {group.template.plural}
                </span>
                <span className="meta">{group.entities.length}</span>
              </div>
              <StaggerList>
                {group.entities.map((entity) => (
                  <EntityRow key={entity.id} entity={entity} portraitSize={40} />
                ))}
              </StaggerList>
            </Section>
          )
        })}

        {other.length > 0 && (
          <Section className="stack gap-8">
            <SectionHead label="Other" note={`${other.length}`} />
            <StaggerList>
              {other.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={40} />
              ))}
            </StaggerList>
          </Section>
        )}
      </div>
    </>
  )
}
