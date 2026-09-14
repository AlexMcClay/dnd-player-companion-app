import { useQuery } from '@tanstack/react-query'
import type { Entity, RecipeData } from '@codex/shared'
import { motion } from 'framer-motion'
import { LuCheck, LuChevronLeft, LuPencil, LuX } from 'react-icons/lu'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import Markdown from '../components/Markdown'
import {
  Empty,
  KnowledgePill,
  Loading,
  Portrait,
  Section,
  SectionHead,
  StaggerList,
  TagChips,
} from '../components/bits'
import { useIsDm } from '../lib/dm'
import { rowVariants, SPRING } from '../lib/motion'
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
  const TypeIcon = template.icon

  return (
    <>
      <div className="head">
        <div className="row-between">
          <motion.button
            type="button"
            className="iconbtn"
            onClick={() => navigate(-1)}
            whileTap={{ scale: 0.92 }}
            transition={SPRING}
          >
            <LuChevronLeft aria-hidden />
            Back
          </motion.button>
          {isDm && (
            <motion.span whileTap={{ scale: 0.92 }} transition={SPRING}>
              <Link to={`/e/${e.id}/edit`} className="iconbtn iconbtn-gold">
                <LuPencil aria-hidden />
                Edit
              </Link>
            </motion.span>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >
          <Portrait entity={e} aspect={template.heroAspect} style={{ maxHeight: 260 }} />
        </motion.div>

        <div>
          <h1 className="ttl">{e.name}</h1>
          {e.summary && (
            <div className="meta" style={{ marginTop: 4 }}>
              {e.summary}
            </div>
          )}
        </div>

        <div className="pill-row">
          <span className="pill pill-n with-icon">
            <TypeIcon aria-hidden />
            {template.label}
          </span>
          <KnowledgePill knowledge={e.knowledge} />
        </div>
      </div>

      <div className="stack gap-16">
        {e.knowledge === 'unknown' && (
          <div className="sealed with-icon" style={{ justifyContent: 'center' }}>
            <LuX aria-hidden />
            <span className="meta">Sealed — players cannot see this entry</span>
          </div>
        )}

        <SpecList entity={e} />

        {e.type === 'recipe' && <RecipeSheet recipe={e} />}

        {e.type === 'item' && <Ownership entity={e} />}

        {e.type === 'player' && <Carrying playerId={e.id} />}

        {e.bodyMd && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.06 }}
          >
            <Markdown source={e.bodyMd} />
          </motion.div>
        )}

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
    <motion.dl
      className="spec panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {rows.map(({ field, value }) => (
        <div key={field.key} style={{ display: 'contents' }}>
          <dt>{field.label}</dt>
          <dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
        </div>
      ))}
    </motion.dl>
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
    <Section className="stack gap-8">
      <SectionHead label="Reagents" note={ready ? 'All in hand' : 'Missing something'} />
      <StaggerList>
        {status.map((reagent) => (
          <motion.div key={reagent.name} className="row" variants={rowVariants}>
            <span className={reagent.enough ? 'reagent-tick on' : 'reagent-tick'}>
              {reagent.enough ? <LuCheck aria-hidden /> : <LuX aria-hidden />}
            </span>
            <div style={{ flex: 1 }}>{reagent.name}</div>
            <span
              className="meta"
              style={{ color: reagent.enough ? 'var(--gold)' : 'var(--ink-faint)' }}
            >
              have {reagent.have} / {reagent.qty}
            </span>
          </motion.div>
        ))}
      </StaggerList>
    </Section>
  )
}

function Ownership({ entity }: { entity: Entity }) {
  const owner = useQuery({
    queryKey: ['entity', entity.ownerId],
    queryFn: () => api.getEntity(entity.ownerId!),
    enabled: entity.ownerId !== null,
  })

  return (
    <motion.div
      className="panel row-between"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div>
        <div className="lab">Carried by</div>
        <div className="name" style={{ marginTop: 3 }}>
          {entity.ownerId ? (owner.data?.name ?? '…') : 'Party stash'}
        </div>
      </div>
      <span className="pill pill-n">×{entity.quantity}</span>
    </motion.div>
  )
}

function Carrying({ playerId }: { playerId: string }) {
  const items = useQuery({
    queryKey: ['entities', { type: 'item', owner: playerId }],
    queryFn: () => api.listEntities({ type: 'item', owner: playerId }),
  })

  if (!items.data || items.data.length === 0) return null

  return (
    <Section className="stack gap-8">
      <SectionHead label="Carrying" note={`${items.data.length} items`} />
      <StaggerList>
        {items.data.map((item) => (
          <EntityRowCompact key={item.id} item={item} />
        ))}
      </StaggerList>
    </Section>
  )
}

function EntityRowCompact({ item }: { item: Entity }) {
  return (
    <motion.div variants={rowVariants}>
      <Link to={`/e/${item.id}`} className="row">
        <Portrait entity={item} size={36} />
        <div style={{ flex: 1 }}>{item.name}</div>
        <span className="meta">×{item.quantity}</span>
      </Link>
    </motion.div>
  )
}
