import { useQuery } from '@tanstack/react-query'
import { LuSearch, LuX } from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { ENTITY_TYPES } from '@codex/shared'
import { api } from '../api/client'
import {
  Empty,
  EntityRow,
  Loading,
  PageHead,
  Section,
  SectionHead,
  StaggerList,
} from '../components/bits'
import { cx, inputClass, PillButton } from '../components/ui'
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
      <PageHead>
        <h1 className="type-title m-0">Search</h1>
        <div className="relative flex items-center">
          <LuSearch
            className="pointer-events-none absolute left-3.25 size-3.75 text-ink-faint"
            aria-hidden
          />
          <input
            className={cx(inputClass, 'pl-9.5')}
            type="search"
            autoFocus
            value={q}
            placeholder="People, beasts, items, recipes…"
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
        {tag && (
          <div className="flex flex-wrap gap-1.75">
            <PillButton tone="solid" onClick={() => update({ tag: '' })}>
              tag: {tag}
              <LuX aria-hidden />
            </PillButton>
          </div>
        )}
      </PageHead>

      {!q.trim() && !tag && <Empty>Type to search everything the party knows</Empty>}

      {results.isLoading && <Loading />}

      {results.data && results.data.length === 0 && <Empty>Nothing matched</Empty>}

      <div className="flex flex-col gap-4">
        {grouped.map((group) => {
          const Icon = group.template.icon
          return (
            <Section key={group.type} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2.5">
                <span className="type-lab flex items-center gap-1.75">
                  <Icon aria-hidden />
                  {group.template.plural}
                </span>
                <span className="type-meta">{group.entities.length}</span>
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
          <Section className="flex flex-col gap-2">
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
