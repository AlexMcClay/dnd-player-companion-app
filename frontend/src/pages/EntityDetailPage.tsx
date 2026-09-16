import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KNOWLEDGE_STATES, type Entity, type EntityInput, type RecipeData } from '@codex/shared'
import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  LuBackpack,
  LuCheck,
  LuChevronLeft,
  LuExpand,
  LuLink,
  LuPencil,
  LuScrollText,
  LuX,
} from 'react-icons/lu'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import DdbPanel from '../components/DdbPanel'
import Lightbox from '../components/Lightbox'
import Markdown from '../components/Markdown'
import NoteCard from '../components/NoteCard'
import NoteComposer from '../components/NoteComposer'
import NoteList from '../components/NoteList'
import WikiText from '../components/WikiText'
import {
  Empty,
  KNOWLEDGE_LABEL,
  KnowledgePill,
  Loading,
  PageHead,
  Portrait,
  Section,
  SectionHead,
  StaggerList,
  TagChips,
} from '../components/bits'
import { cx, panelClass, Pill, PillButton, rowClass, Sealed, twoUpClass } from '../components/ui'
import { useIsDm, usePlayerId } from '../lib/identity'
import { rowVariants, SPRING } from '../lib/motion'
import { firstNameOf } from '../lib/names'
import { reagentStatus, stockFor } from '../lib/recipes'
import { templateFor } from '../templates'

const ICON_BTN =
  'inline-flex cursor-pointer items-center gap-1.25 py-1 text-[9.5px] uppercase tracking-[0.13em]'

/** "4 / 5" -> 0.8, so a hero can be sized by its shape. */
function ratioOf(aspect: string): number {
  const [w, h] = aspect.split('/').map((part) => Number(part.trim()))
  return w && h ? w / h : 1.5
}

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
  // Portrait-shaped art wants a narrow column, landscape art a wide one. Both
  // then land around 210-280px tall, so heroes stay a consistent weight on the
  // page whatever shape the template asks for.
  const tallHero = ratioOf(template.heroAspect) < 1.2

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

        {/* One column on a phone, hero beside the title from md up. */}
        <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:gap-5">
          <Hero entity={e} tall={tallHero} />

          <div className="flex min-w-0 flex-col gap-2.25 md:flex-1">
            <div>
              <h1 className="type-title m-0">{e.name}</h1>
              {e.summary && <div className="type-meta mt-1">{e.summary}</div>}
            </div>

            <div className="flex flex-wrap gap-1.75">
              <Pill tone="neutral">
                <TypeIcon aria-hidden />
                {template.label}
              </Pill>
              {isDm ? <KnowledgeSwitch entity={e} /> : <KnowledgePill knowledge={e.knowledge} />}
            </div>
          </div>
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

        {e.type === 'item' && <Holders itemId={e.id} />}

        {/*
          A character's description gets the same framed section it has on the
          Me tab, rather than the bare prose block every other kind of entry
          uses. Unlabelled it read as page furniture — you could not tell it was
          the thing its player wrote about themselves.
        */}
        {e.type === 'player' && <About entity={e} />}

        {e.type === 'player' && (
          <Section className="flex flex-col gap-2">
            <SectionHead icon={LuLink} label="D&D Beyond" note="Their sheet, mirrored" />
            <DdbPanel playerId={e.id} characterName={e.name} />
          </Section>
        )}

        {e.type === 'player' && <Carrying playerId={e.id} />}

        {/* Characters had theirs above, in a labelled section of its own. */}
        {e.type !== 'player' && <Body entity={e} />}

        <Section className="flex flex-col gap-2">
          <SectionHead label={`Notes about ${e.name}`} />
          <NoteList
            placement="entry"
            subjectId={e.id}
            emptyLabel="Nobody has written anything here yet"
            addLabel="Add a note"
          />
        </Section>

        {/*
          A character's own shared vault notes, published to whoever opens their
          page. Labelled distinctly so two note blocks do not read as a bug.
        */}
        {e.type === 'player' && (
          <Section className="flex flex-col gap-2">
            <SectionHead
              label={`${firstNameOf(e.name)}'s public notes`}
              note="From their vault"
            />
            <PublicVault playerId={e.id} />
          </Section>
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

/**
 * One field of an entry, changed from the entry itself.
 *
 * The PUT route takes a partial body and answers with the whole entry, so the
 * response goes straight into the cache and the page redraws without a refetch.
 * Lists elsewhere show the name, the summary and the knowledge pill, so they
 * are invalidated too — unawaited, because nothing here waits on them.
 */
function useEntityPatch(id: string, onDone?: () => void) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const patch = useMutation({
    mutationFn: (input: Partial<EntityInput>) => api.updateEntity(id, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(['entity', id], saved)
      void queryClient.invalidateQueries({ queryKey: ['entities'] })
      setError(null)
      onDone?.()
    },
    onError: (err: Error) => setError(err.message),
  })

  return { patch, error, clearError: () => setError(null) }
}

/**
 * The DM's three-way knowledge switch, in place of the pill a player sees.
 *
 * Mid-scene the party learns things faster than a trip through the edit form
 * allows, and this is the one field that decides whether an entry exists at all
 * for them — so it is one tap from the entry itself.
 */
function KnowledgeSwitch({ entity }: { entity: Entity }) {
  const { patch, error } = useEntityPatch(entity.id)

  return (
    <>
      {KNOWLEDGE_STATES.map((state) => {
        const current = entity.knowledge === state
        return (
          <PillButton
            key={state}
            tone={current ? 'solid' : 'neutral'}
            aria-pressed={current}
            disabled={patch.isPending}
            className={cx(patch.isPending && 'opacity-60')}
            onClick={() => {
              if (!current) patch.mutate({ knowledge: state })
            }}
          >
            {KNOWLEDGE_LABEL[state]}
          </PillButton>
        )
      })}
      {/* basis-full so the message takes its own line rather than squeezing
          in beside the third pill. */}
      {error && <div className="type-meta basis-full text-danger">{error}</div>}
    </>
  )
}

/**
 * The entry's prose, and for the DM a way to change it without the edit form.
 *
 * Same composer a player writes their character with on the Me tab, so the
 * `@`-mention linking and the markdown toggle come along. Emptying a body still
 * belongs to the full form — the composer will not submit nothing.
 */
function Body({ entity }: { entity: Entity }) {
  const isDm = useIsDm()
  const [editing, setEditing] = useState(false)
  const { patch, error, clearError } = useEntityPatch(entity.id, () => setEditing(false))

  if (!entity.bodyMd && !isDm) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.06 }}
    >
      {/*
        A 740px line of 13.5px prose is roughly 110 characters, which is well
        past where the eye loses its place returning to the left — so reading is
        capped at a measure.

        Writing is not. The measure exists for the reader; imposed on the editor
        it just leaves the toolbar and the Save button stranded in the left half
        of the page with dead space beside them.
      */}
      <div className={cx('flex flex-col gap-2', !editing && 'md:max-w-[72ch]')}>
        {editing ? (
          <NoteComposer
            initial={{ bodyMd: entity.bodyMd ?? '' }}
            withVisibility={false}
            submitLabel="Save"
            placeholder="Markdown. Type @ to link another entry."
            busy={patch.isPending}
            error={error}
            onSubmit={(draft) => patch.mutate({ bodyMd: draft.bodyMd })}
            onCancel={() => {
              setEditing(false)
              clearError()
            }}
          />
        ) : (
          <>
            {entity.bodyMd ? (
              <Markdown source={entity.bodyMd} />
            ) : (
              <Empty>Nothing written yet</Empty>
            )}
            {isDm && (
              <motion.button
                type="button"
                className={cx(ICON_BTN, 'self-start text-gold')}
                whileTap={{ scale: 0.92 }}
                transition={SPRING}
                onClick={() => setEditing(true)}
              >
                <LuPencil aria-hidden />
                {entity.bodyMd ? 'Edit body' : 'Write something'}
              </motion.button>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}

/**
 * The entry's art, shown whole.
 *
 * Everywhere else a portrait fills a fixed box and `object-cover` crops to fit,
 * which is right for a 46px row thumbnail — but on the entry itself it was
 * cutting the face off a character and the top off a map. Here the frame sizes
 * itself to the image instead: bounded, never cropped, never letterboxed.
 *
 * Only the bounds differ between phone and desktop, so the rule is the same on
 * both: whatever its dimensions, you see the whole image.
 */
function Hero({ entity, tall }: { entity: Entity; tall: boolean }) {
  const template = templateFor(entity.type)
  const [zoomed, setZoomed] = useState(false)

  // Nothing to preserve, so the placeholder keeps the template's shape and the
  // fixed column it used to have.
  if (!entity.imageUrl) {
    return (
      <motion.div
        className={cx('w-full md:shrink-0', tall ? 'md:w-56' : 'md:w-80')}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
      >
        <Portrait entity={entity} aspect={template.heroAspect} className="max-h-65 md:max-h-none" />
      </motion.div>
    )
  }

  return (
    <>
      <motion.button
        type="button"
        aria-label={`View ${entity.name} full screen`}
        onClick={() => setZoomed(true)}
        // self-start keeps the frame hugging the image; stretched by the column
        // it would grow bars down the sides again. The width cap stops a
        // panoramic map from squeezing the title into a gutter.
        // Centred on a phone, where the frame sits alone above the title and an
        // off-centre hug reads as a mistake; from md up it is one of two columns,
        // so it hugs the left edge instead and shares the row with the title.
        //
        // Either way it never stretches — stretched by the column it would grow
        // bars down the sides, which is the thing being fixed.
        //
        // min-h so the frame does not start at zero height and shove the title
        // down when the image lands — we have no intrinsic size to reserve, since
        // the API carries a URL and nothing else.
        className="group port-fill relative max-w-full min-h-25 shrink-0 cursor-zoom-in self-center border border-line md:max-w-[58%] md:self-start"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
      >
        <motion.img
          src={entity.imageUrl}
          alt={entity.name}
          // No object-fit: the image is the only child, so it sets the frame's
          // size rather than being fitted into one. Height bounds it normally;
          // max-w-full takes over for anything very wide, and because only
          // max-* are set the other axis follows on its own and the aspect holds.
          className="block h-auto max-h-70 w-auto max-w-full md:max-h-80"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        />
        {/* Only a hint, and only where there is a pointer to hover with — on a
            phone the picture being tappable is the expectation anyway. */}
        <span className="pointer-events-none absolute right-1.5 bottom-1.5 hidden size-7 place-items-center border border-line bg-tabbar text-ink-soft opacity-0 transition-opacity group-hover:opacity-100 md:grid [&>svg]:size-3.5">
          <LuExpand aria-hidden />
        </span>
      </motion.button>

      <Lightbox
        src={entity.imageUrl}
        alt={entity.name}
        open={zoomed}
        onClose={() => setZoomed(false)}
      />
    </>
  )
}

/**
 * A character's own description, laid out exactly as it is on the Me tab.
 *
 * Read-only here even on your own character: writing it belongs to one place,
 * and the note says which. Whoever is looking, this is the block their player
 * wrote — labelling it is the whole point.
 */
function About({ entity }: { entity: Entity }) {
  const playerId = usePlayerId()
  const mine = playerId === entity.id

  return (
    <Section className="flex flex-col gap-2">
      <SectionHead
        icon={LuScrollText}
        label={`About ${firstNameOf(entity.name)}`}
        note={
          mine ? (
            <Link to="/me" className="text-gold">
              Yours to write →
            </Link>
          ) : (
            'In their own words'
          )
        }
      />
      {entity.bodyMd ? (
        <div className="md:max-w-[72ch]">
          <Markdown source={entity.bodyMd} />
        </div>
      ) : (
        <Empty>Nothing written yet</Empty>
      )}
    </Section>
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

  // Two label/value pairs per row on a wide screen — each pair is a few words,
  // so one per row left most of the panel empty.
  return (
    <motion.dl
      className={panelClass(
        'm-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13.5px] md:grid-cols-[auto_1fr_auto_1fr] md:gap-x-6',
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {rows.map(({ field, value }) => (
        <div key={field.key} className="contents">
          <dt className="type-meta self-center">{field.label}</dt>
          {/* min-w-0 so a long value wraps inside its 1fr track instead of
              widening it and pushing the second pair off the panel. */}
          <dd className="m-0 min-w-0">
            {typeof value === 'boolean' ? (
              value ? (
                'Yes'
              ) : (
                'No'
              )
            ) : (
              // Template fields are plain text, but people still write
              // [[links]] in them — a location's "Run by", for instance.
              <WikiText text={String(value)} />
            )}
          </dd>
        </div>
      ))}
    </motion.dl>
  )
}

/** Reagent checklist against what the party actually holds. */
function RecipeSheet({ recipe }: { recipe: Entity }) {
  const holdings = useQuery({
    queryKey: ['holdings', {}],
    queryFn: () => api.listHoldings(),
  })

  const ingredients = (recipe.data as RecipeData).ingredients ?? []
  if (ingredients.length === 0) return null

  const status = reagentStatus(ingredients, stockFor(holdings.data ?? []))
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

/**
 * Read-only view of a character's vault notes. The API already filters to what
 * the viewer may see, so a player's private notes never arrive here — except
 * for the DM, and on your own page.
 */
function PublicVault({ playerId }: { playerId: string }) {
  const notes = useQuery({
    queryKey: ['notes', { placement: 'vault', author: playerId }],
    queryFn: () => api.listNotes({ placement: 'vault', author: playerId }),
  })

  const rows = notes.data ?? []
  if (notes.isLoading) return <Loading />
  if (rows.length === 0) return <Empty>Nothing shared from their vault</Empty>

  return (
    <StaggerList>
      {rows.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </StaggerList>
  )
}

/**
 * Who has this item, and how many. Only answerable now that holdings are their
 * own thing rather than a column on the item.
 */
function Holders({ itemId }: { itemId: string }) {
  const holdings = useQuery({
    queryKey: ['holdings', { item: itemId }],
    queryFn: () => api.listHoldings({ item: itemId }),
  })

  const players = useQuery({
    queryKey: ['entities', { type: 'player' }],
    queryFn: () => api.listEntities({ type: 'player' }),
  })

  if (holdings.isLoading) return null

  const stacks = holdings.data ?? []
  const nameById = new Map((players.data ?? []).map((p) => [p.id, p.name]))
  const total = stacks.reduce((sum, h) => sum + h.quantity, 0)

  if (stacks.length === 0) {
    return (
      <motion.div
        className={panelClass('flex items-center justify-between gap-2.5')}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="type-lab">Held by</div>
        <span className="type-meta">Nobody — catalogued only</span>
      </motion.div>
    )
  }

  return (
    <Section className="flex flex-col gap-2">
      <SectionHead label="Held by" note={`${total} in total`} />
      <StaggerList className={twoUpClass}>
        {stacks.map((holding) => (
          <motion.div key={holding.id} variants={rowVariants} className={rowClass}>
            <div className="flex-1">
              {holding.ownerId ? (
                <Link to={`/e/${holding.ownerId}`} className="text-gold">
                  {nameById.get(holding.ownerId) ?? 'A character'}
                </Link>
              ) : (
                'Party stash'
              )}
            </div>
            <Pill tone="neutral">×{holding.quantity}</Pill>
          </motion.div>
        ))}
      </StaggerList>
    </Section>
  )
}

function Carrying({ playerId }: { playerId: string }) {
  const holdings = useQuery({
    queryKey: ['holdings', { owner: playerId }],
    queryFn: () => api.listHoldings({ owner: playerId }),
  })

  const stacks = holdings.data ?? []
  if (stacks.length === 0) return null

  return (
    <Section className="flex flex-col gap-2">
      <SectionHead icon={LuBackpack} label="Carrying" note={`${stacks.length} entries`} />
      <StaggerList className={twoUpClass}>
        {stacks.map((holding) => (
          <motion.div key={holding.id} variants={rowVariants}>
            <Link to={`/e/${holding.itemId}`} className={rowClass}>
              <Portrait entity={holding.item} size={36} />
              <div className="flex-1">{holding.item.name}</div>
              <span className="type-meta">×{holding.quantity}</span>
            </Link>
          </motion.div>
        ))}
      </StaggerList>
    </Section>
  )
}
