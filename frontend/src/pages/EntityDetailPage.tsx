import { useQuery } from '@tanstack/react-query'
import type { Entity, RecipeData } from '@codex/shared'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import Markdown from '../components/Markdown'
import { Empty, KnowledgePill, Loading, Portrait, SectionHead, TagChips } from '../components/bits'
import { useIsDm } from '../lib/dm'
import { reagentStatus, stockFor } from '../lib/recipes'
import { templateFor } from '../templates'

export default function EntityDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const isDm = useIsDm()

  const entity = useQuery({
    queryKey: ['entity', id],
    queryFn: () => api.getEntity(id),
  })

  if (entity.isLoading) return <Loading />
  if (entity.isError || !entity.data) return <Empty>Not found, or not yet known to the party</Empty>

  const e = entity.data
  const template = templateFor(e.type)

  return (
    <>
      <div className="head">
        <div className="row-between">
          <button
            type="button"
            className="backlink"
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
            onClick={() => navigate(-1)}
          >
            ‹ Back
          </button>
          {isDm && (
            <Link to={`/e/${e.id}/edit`} className="meta" style={{ color: 'var(--gold)' }}>
              Edit
            </Link>
          )}
        </div>

        <Portrait entity={e} aspect={template.heroAspect} style={{ maxHeight: 260 }} />

        <div>
          <h1 className="ttl">{e.name}</h1>
          {e.summary && (
            <div className="meta" style={{ marginTop: 4 }}>
              {e.summary}
            </div>
          )}
        </div>

        <div className="pill-row">
          <span className="pill pill-n">{template.label}</span>
          <KnowledgePill knowledge={e.knowledge} />
        </div>
      </div>

      <div className="stack gap-16">
        {e.knowledge === 'unknown' && (
          <div className="sealed">
            <span className="meta">Sealed — players cannot see this entry</span>
          </div>
        )}

        <SpecList entity={e} />

        {e.type === 'recipe' && <RecipeSheet recipe={e} />}

        {e.type === 'item' && <Ownership entity={e} />}

        {e.type === 'player' && <Carrying playerId={e.id} />}

        {e.bodyMd && <Markdown source={e.bodyMd} />}

        {e.tags.length > 0 && (
          <div className="stack gap-8">
            <SectionHead label="Tags" />
            <TagChips tags={e.tags} />
          </div>
        )}
      </div>
    </>
  )
}

/** Template-driven `data` fields, minus the ones with their own rendering. */
function SpecList({ entity }: { entity: Entity }) {
  const template = templateFor(entity.type)
  const rows = template.fields
    .filter((field) => field.kind !== 'ingredients')
    .map((field) => ({ field, value: entity.data[field.key] }))
    .filter(({ value }) => value !== undefined && value !== null && value !== '')

  if (rows.length === 0) return null

  return (
    <dl className="spec panel">
      {rows.map(({ field, value }) => (
        <div key={field.key} style={{ display: 'contents' }}>
          <dt>{field.label}</dt>
          <dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Reagent checklist against what the party actually holds. */
function RecipeSheet({ recipe }: { recipe: Entity }) {
  const items = useQuery({
    queryKey: ['entities', { type: 'item' }],
    queryFn: () => api.listEntities({ type: 'item' }),
  })

  const ingredients = (recipe.data as RecipeData).ingredients ?? []
  if (ingredients.length === 0) return null

  const status = reagentStatus(ingredients, stockFor(items.data ?? []))
  const ready = status.every((r) => r.enough)

  return (
    <section className="stack gap-8">
      <SectionHead label="Reagents" note={ready ? 'All in hand' : 'Missing something'} />
      <div>
        {status.map((reagent) => (
          <div key={reagent.name} className="row">
            <div style={{ flex: 1 }}>{reagent.name}</div>
            <span
              className="meta"
              style={{ color: reagent.enough ? 'var(--gold)' : 'var(--ink-faint)' }}
            >
              have {reagent.have} / {reagent.qty}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Ownership({ entity }: { entity: Entity }) {
  const owner = useQuery({
    queryKey: ['entity', entity.ownerId],
    queryFn: () => api.getEntity(entity.ownerId!),
    enabled: entity.ownerId !== null,
  })

  return (
    <div className="panel row-between">
      <div>
        <div className="lab">Carried by</div>
        <div className="name" style={{ marginTop: 3 }}>
          {entity.ownerId ? (owner.data?.name ?? '…') : 'Party stash'}
        </div>
      </div>
      <span className="pill pill-n">×{entity.quantity}</span>
    </div>
  )
}

function Carrying({ playerId }: { playerId: string }) {
  const items = useQuery({
    queryKey: ['entities', { type: 'item', owner: playerId }],
    queryFn: () => api.listEntities({ type: 'item', owner: playerId }),
  })

  if (!items.data || items.data.length === 0) return null

  return (
    <section className="stack gap-8">
      <SectionHead label="Carrying" note={`${items.data.length} items`} />
      <div>
        {items.data.map((item) => (
          <Link key={item.id} to={`/e/${item.id}`} className="row">
            <Portrait entity={item} size={36} />
            <div style={{ flex: 1 }}>{item.name}</div>
            <span className="meta">×{item.quantity}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
