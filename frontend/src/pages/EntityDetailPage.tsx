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
  PageHead,
  Portrait,
  Section,
  SectionHead,
  StaggerList,
  TagChips,
} from '../components/bits'
import { cx, panelClass, Pill, rowClass, Sealed } from '../components/ui'
import { useIsDm } from '../lib/dm'
import { rowVariants, SPRING } from '../lib/motion'
import { reagentStatus, stockFor } from '../lib/recipes'
import { templateFor } from '../templates'

const ICON_BTN =
  'inline-flex cursor-pointer items-center gap-1.25 py-1 text-[9.5px] uppercase tracking-[0.13em]'

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
      <PageHead>
        <div className="flex items-center justify-between gap-2.5">
          <motion.button
            type="button"
            className={cx(ICON_BTN, 'text-ink-faint')}
            onClick={() => navigate(-1)}
            whileTap={{ scale: 0.92 }}
            transition={SPRING}
          >
            <LuChevronLeft aria-hidden />
            Back
          </motion.button>
          {isDm && (
            <motion.span whileTap={{ scale: 0.92 }} transition={SPRING}>
              <Link to={`/e/${e.id}/edit`} className={cx(ICON_BTN, 'text-gold')}>
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
          <h1 className="type-title m-0">{e.name}</h1>
          {e.summary && <div className="type-meta mt-1">{e.summary}</div>}
        </div>

        <div className="flex flex-wrap gap-1.75">
          <Pill tone="neutral">
            <TypeIcon aria-hidden />
            {template.label}
          </Pill>
          <KnowledgePill knowledge={e.knowledge} />
        </div>
      </PageHead>

      <div className="flex flex-col gap-4">
        {e.knowledge === 'unknown' && (
          <Sealed>
            <LuX aria-hidden />
            <span className="type-meta">Sealed — players cannot see this entry</span>
          </Sealed>
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
          <div className="flex flex-col gap-2">
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
      className={panelClass('m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13.5px]')}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {rows.map(({ field, value }) => (
        <div key={field.key} className="contents">
          <dt className="type-meta self-center">{field.label}</dt>
          <dd className="m-0">
            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
          </dd>
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
    <Section className="flex flex-col gap-2">
      <SectionHead label="Reagents" note={ready ? 'All in hand' : 'Missing something'} />
      <StaggerList>
        {status.map((reagent) => (
          <motion.div key={reagent.name} className={rowClass} variants={rowVariants}>
            <span
              className={cx(
                'grid size-5.5 shrink-0 place-items-center border [&>svg]:size-3',
                reagent.enough
                  ? 'border-gold-dim bg-gold-tint text-gold'
                  : 'border-line text-ink-faint',
              )}
            >
              {reagent.enough ? <LuCheck aria-hidden /> : <LuX aria-hidden />}
            </span>
            <div className="flex-1">{reagent.name}</div>
            <span className={cx('type-meta', reagent.enough && 'text-gold')}>
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
      className={panelClass('flex items-center justify-between gap-2.5')}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div>
        <div className="type-lab">Carried by</div>
        <div className="type-name mt-0.75">
          {entity.ownerId ? (owner.data?.name ?? '…') : 'Party stash'}
        </div>
      </div>
      <Pill tone="neutral">×{entity.quantity}</Pill>
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
    <Section className="flex flex-col gap-2">
      <SectionHead label="Carrying" note={`${items.data.length} items`} />
      <StaggerList>
        {items.data.map((item) => (
          <motion.div key={item.id} variants={rowVariants}>
            <Link to={`/e/${item.id}`} className={rowClass}>
              <Portrait entity={item} size={36} />
              <div className="flex-1">{item.name}</div>
              <span className="type-meta">×{item.quantity}</span>
            </Link>
          </motion.div>
        ))}
      </StaggerList>
    </Section>
  )
}
