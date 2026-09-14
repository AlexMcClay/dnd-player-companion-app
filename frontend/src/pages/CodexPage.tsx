import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { LuChevronLeft, LuSearch, LuX } from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import DmCreateBar from '../components/DmCreateBar'
import {
  Empty,
  EntityRow,
  Loading,
  PageHead,
  Section,
  SectionHead,
  StaggerList,
} from '../components/bits'
import { cx, inputClass, panelClass } from '../components/ui'
import { listVariants, rowVariants, SPRING } from '../lib/motion'
import { useAllEntities } from '../lib/useAllEntities'
import { CODEX_TYPES, templateFor } from '../templates'

type CodexType = (typeof CODEX_TYPES)[number]

const BLURB: Record<CodexType, string> = {
  npc: 'People you have met',
  faction: 'Who holds power, and how they feel about you',
  location: 'Countries, cities, districts and the odd inn',
  monster: 'What you have fought, and what you learned',
  item: 'The repository of everything you can lay hands on',
}

function isCodexType(value: string | null): value is CodexType {
  return value !== null && (CODEX_TYPES as readonly string[]).includes(value)
}

/**
 * The shared pool of knowledge. Choose a kind from the grid, then browse or
 * search within it. Both the chosen kind and the query live in the URL, so back
 * works and a search can be shared.
 */
export default function CodexPage() {
  const [params, setParams] = useSearchParams()
  const groupParam = params.get('group')
  const group = isCodexType(groupParam) ? groupParam : null
  const q = params.get('q') ?? ''

  function open(next: CodexType | null, query = '') {
    const merged = new URLSearchParams()
    if (next) merged.set('group', next)
    if (query) merged.set('q', query)
    setParams(merged, { replace: Boolean(group) && next === group })
  }

  if (!group) return <TypeGrid onPick={(type) => open(type)} />

  return (
    <GroupList
      group={group}
      q={q}
      onQuery={(next) => open(group, next)}
      onBack={() => open(null)}
    />
  )
}

/** Landing view: one card per kind, with how many entries it holds. */
function TypeGrid({ onPick }: { onPick: (type: CodexType) => void }) {
  const all = useAllEntities()

  const countOf = (type: CodexType) =>
    (all.data ?? []).filter((entity) => entity.type === type).length

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">Codex</h1>
        <div className="type-meta">Everything the party has confirmed in play</div>
      </PageHead>

      {all.isLoading ? (
        <Loading />
      ) : (
        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {CODEX_TYPES.map((type) => {
            const template = templateFor(type)
            const Icon = template.icon
            return (
              <motion.button
                key={type}
                type="button"
                className={panelClass(
                  'flex cursor-pointer flex-col items-start gap-2 text-left',
                )}
                variants={rowVariants}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                onClick={() => onPick(type)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <Icon className="size-5 text-gold" aria-hidden />
                  <span className="type-meta">{countOf(type)}</span>
                </span>
                <span className="type-name">{template.plural}</span>
                <span className="type-meta leading-relaxed normal-case tracking-normal">
                  {BLURB[type]}
                </span>
              </motion.button>
            )
          })}
        </motion.div>
      )}

      <div className="mt-4">
        <DmCreateBar path="/codex" />
      </div>
    </>
  )
}

/** One kind, searchable. */
function GroupList({
  group,
  q,
  onQuery,
  onBack,
}: {
  group: CodexType
  q: string
  onQuery: (next: string) => void
  onBack: () => void
}) {
  const template = templateFor(group)

  // Server-side search so it matches body text, not just names on this page.
  const entries = useQuery({
    queryKey: ['entities', { type: group, q }],
    queryFn: () => api.listEntities({ type: group, q: q || undefined }),
  })

  const rows = entries.data ?? []

  return (
    <>
      <PageHead>
        <motion.button
          type="button"
          className="inline-flex w-fit cursor-pointer items-center gap-1.25 py-1 text-[9.5px] uppercase tracking-[0.13em] text-ink-faint"
          whileTap={{ scale: 0.92 }}
          transition={SPRING}
          onClick={onBack}
        >
          <LuChevronLeft aria-hidden />
          All of the codex
        </motion.button>

        <h1 className="type-title m-0">{template.plural}</h1>

        <div className="relative flex items-center">
          <LuSearch
            className="pointer-events-none absolute left-3.25 size-3.75 text-ink-faint"
            aria-hidden
          />
          <input
            className={cx(inputClass, 'pl-9.5', q && 'pr-10')}
            type="search"
            value={q}
            placeholder={`Search ${template.plural.toLowerCase()}…`}
            onChange={(e) => onQuery(e.target.value)}
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-3 grid size-5 cursor-pointer place-items-center text-ink-faint"
              onClick={() => onQuery('')}
            >
              <LuX aria-hidden />
            </button>
          )}
        </div>
      </PageHead>

      <div className="flex flex-col gap-4">
        <Section className="flex flex-col gap-2">
          <SectionHead
            label={q ? 'Matches' : BLURB[group]}
            note={entries.isLoading ? undefined : `${rows.length}`}
          />

          {entries.isLoading ? (
            <Loading />
          ) : (
            <StaggerList>
              {rows.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={48} />
              ))}
            </StaggerList>
          )}

          {!entries.isLoading && rows.length === 0 && (
            <Empty>{q ? `Nothing matching "${q}"` : 'Nothing here yet'}</Empty>
          )}
        </Section>

        <DmCreateBar path="/codex" only={[group]} />
      </div>
    </>
  )
}
