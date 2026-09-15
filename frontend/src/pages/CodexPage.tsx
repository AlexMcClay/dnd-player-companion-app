import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { EntitySummary } from '@codex/shared'
import { motion } from 'framer-motion'
import { useEffect, useMemo, type ReactNode } from 'react'
import type { IconType } from 'react-icons'
import {
  LuBackpack,
  LuBoxes,
  LuCaravan,
  LuChevronLeft,
  LuChevronRight,
  LuFlaskRound,
  LuGem,
  LuSearch,
  LuShield,
  LuSparkles,
  LuSprout,
  LuSwords,
  LuWand,
  LuWrench,
  LuX,
} from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import DmCreateBar from '../components/DmCreateBar'
import { RarityChips } from '../components/ItemFilterBar'
import {
  Empty,
  EntityRow,
  Loading,
  PageHead,
  Section,
  SectionHead,
  StaggerList,
} from '../components/bits'
import VirtualList from '../components/VirtualList'
import { cx, inputClass, panelClass } from '../components/ui'
import {
  CATEGORIES,
  CATEGORY_BLURB,
  CATEGORY_LABEL,
  campaignFirst,
  categoryCounts,
  categoryOf,
  isCategory,
  isReference,
  rarityOf,
  RARITIES,
  type Category,
  type ItemFilter,
  type Rarity,
} from '../lib/itemFacets'
import { rowVariants, SPRING } from '../lib/motion'
import { tokenMatch } from '../lib/textMatch'
import { useAllEntities, useAllItems } from '../lib/useAllEntities'
import { useDebounced } from '../lib/useDebounced'
import { CODEX_TYPES, templateFor } from '../templates'

type CodexType = (typeof CODEX_TYPES)[number]

const BLURB: Record<CodexType, string> = {
  npc: 'People you have met',
  faction: 'Who holds power, and how they feel about you',
  location: 'Countries, cities, districts and the odd inn',
  monster: 'What you have fought, and what you learned',
  item: 'Weapons, gear, reagents and everything else',
}

const CATEGORY_ICON: Record<Category, IconType> = {
  weapons: LuSwords,
  armour: LuShield,
  gear: LuBackpack,
  tools: LuWrench,
  consumables: LuFlaskRound,
  wondrous: LuSparkles,
  implements: LuWand,
  reagents: LuSprout,
  treasure: LuGem,
  mounts: LuCaravan,
  misc: LuBoxes,
}

function isCodexType(value: string | null): value is CodexType {
  return value !== null && (CODEX_TYPES as readonly string[]).includes(value)
}

function isRarity(value: string | null): value is Rarity {
  return value !== null && (RARITIES as readonly string[]).includes(value)
}

/**
 * How deep in the codex a set of params sits.
 *
 * Replace-vs-push is decided by comparing depths, not by which params changed.
 * Keyed on params it goes wrong the moment a param becomes a view discriminator:
 * the first keystroke at grid level changes the view but not the group, so it
 * would replace, and back would leave the codex entirely rather than returning
 * to the grid.
 */
function depthOf(group: CodexType | null, category: Category | null, q: string): number {
  if (!group) return 0
  if (group !== 'item') return 1
  if (category) return 2
  return q ? 2 : 1
}

/**
 * The shared pool of knowledge. Pick a kind, then — for items, which run to
 * hundreds — a category. Everything lives in the URL, so back works and any
 * view can be shared.
 */
export default function CodexPage() {
  const [params, setParams] = useSearchParams()

  const groupParam = params.get('group')
  const group = isCodexType(groupParam) ? groupParam : null

  const catParam = params.get('cat')
  const category = isCategory(catParam) ? catParam : null

  const rarityParam = params.get('rarity')
  const rarity = isRarity(rarityParam) ? rarityParam : null

  const q = params.get('q') ?? ''

  interface Nav {
    group: CodexType | null
    category: Category | null
    rarity: Rarity | null
    q: string
  }

  function open(next: Partial<Nav>) {
    const merged: Nav = { group, category, rarity, q, ...next }
    const out = new URLSearchParams()
    if (merged.group) out.set('group', merged.group)
    if (merged.category) out.set('cat', merged.category)
    if (merged.rarity) out.set('rarity', merged.rarity)
    if (merged.q) out.set('q', merged.q)

    // Going deeper pushes; staying level or stepping back replaces, so the
    // history stack never grows by browsing sideways.
    const to = depthOf(merged.group, merged.category, merged.q)
    const from = depthOf(group, category, q)
    setParams(out, { replace: to <= from })
  }

  if (!group) return <TypeGrid onPick={(type) => open({ group: type, q: '', category: null })} />

  if (group === 'item') {
    return (
      <Items
        category={category}
        rarity={rarity}
        q={q}
        onQuery={(next) => open({ q: next })}
        onCategory={(next) => open({ category: next, rarity: null, q: '' })}
        onRarity={(next) => open({ rarity: next })}
        onBack={() =>
          category || q
            ? open({ category: null, rarity: null, q: '' })
            : open({ group: null, q: '' })
        }
      />
    )
  }

  return (
    <GroupList
      group={group}
      q={q}
      onQuery={(next) => open({ q: next })}
      onBack={() => open({ group: null, q: '' })}
    />
  )
}

/** Landing view: one card per kind, with how many entries it holds. */
function TypeGrid({ onPick }: { onPick: (type: CodexType) => void }) {
  const all = useAllEntities()
  const rows = all.data ?? []

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">Codex</h1>
        <div className="type-meta">Everything the party has confirmed in play</div>
      </PageHead>

      {all.isLoading ? (
        <Loading />
      ) : (
        <StaggerList className="grid grid-cols-2 gap-3">
          {CODEX_TYPES.map((type) => {
            const template = templateFor(type)
            return (
              <Tile
                key={type}
                icon={template.icon}
                label={template.plural}
                count={rows.filter((entity) => entity.type === type).length}
                blurb={BLURB[type]}
                onClick={() => onPick(type)}
              />
            )
          })}
        </StaggerList>
      )}

      <div className="mt-4">
        <DmCreateBar path="/codex" />
      </div>
    </>
  )
}

/** One card in either grid. */
function Tile({
  icon: Icon,
  label,
  count,
  blurb,
  onClick,
}: {
  icon: IconType
  label: string
  count: number
  blurb: string
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      className={panelClass('flex cursor-pointer flex-col items-start gap-2 text-left')}
      variants={rowVariants}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      onClick={onClick}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <Icon className="size-5 text-gold" aria-hidden />
        <span className="type-meta">{count}</span>
      </span>
      <span className="type-name">{label}</span>
      <span className="type-meta leading-relaxed normal-case tracking-normal">{blurb}</span>
    </motion.button>
  )
}

/** Back link, title and search box — the chrome every browse view shares. */
function BrowseHead({
  back,
  title,
  q,
  placeholder,
  onQuery,
  children,
}: {
  back: { label: string; onClick: () => void }
  title: string
  q: string
  placeholder: string
  onQuery: (next: string) => void
  children?: ReactNode
}) {
  return (
    <PageHead>
      <motion.button
        type="button"
        className="inline-flex w-fit cursor-pointer items-center gap-1.25 py-1 text-[9.5px] tracking-[0.13em] text-ink-faint uppercase"
        whileTap={{ scale: 0.92 }}
        transition={SPRING}
        onClick={back.onClick}
      >
        <LuChevronLeft aria-hidden />
        {back.label}
      </motion.button>

      <h1 className="type-title m-0">{title}</h1>

      <div className="relative flex items-center">
        <LuSearch
          className="pointer-events-none absolute left-3.25 size-3.75 text-ink-faint"
          aria-hidden
        />
        <input
          className={cx(inputClass, 'pl-9.5', q && 'pr-10')}
          type="search"
          value={q}
          placeholder={placeholder}
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

      {children}
    </PageHead>
  )
}

/**
 * Server-side search across one kind, debounced.
 *
 * Kept server-side because it matches body text, which the list payload does not
 * carry — a client-side filter can only ever see names and summaries.
 */
function useSearch(type: CodexType, q: string) {
  const debounced = useDebounced(q)
  const query = useQuery({
    queryKey: ['entities', { type, q: debounced }],
    queryFn: () => api.listEntities({ type, q: debounced || undefined }),
    // Without this the list drops to a full-page spinner between keystrokes.
    placeholderData: keepPreviousData,
  })
  return { ...query, settling: q !== debounced }
}

/** One kind, searchable. Everything except items, which have categories. */
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
  const entries = useSearch(group, q)
  const rows = entries.data ?? []
  const busy = entries.isLoading || entries.settling

  return (
    <>
      <BrowseHead
        back={{ label: 'All of the codex', onClick: onBack }}
        title={template.plural}
        q={q}
        placeholder={`Search ${template.plural.toLowerCase()}…`}
        onQuery={onQuery}
      />

      <div className="flex flex-col gap-4">
        <Section className="flex flex-col gap-2">
          <SectionHead
            label={q ? 'Matches' : BLURB[group]}
            note={busy ? undefined : `${rows.length}`}
          />

          {entries.isLoading ? (
            <Loading />
          ) : (
            <VirtualList
              items={rows}
              getKey={(entity) => entity.id}
              renderItem={(entity) => <EntityRow entity={entity} portraitSize={48} />}
            />
          )}

          {!busy && rows.length === 0 && (
            <Empty>{q ? `Nothing matching "${q}"` : 'Nothing here yet'}</Empty>
          )}
        </Section>

        <DmCreateBar path="/codex" only={[group]} />
      </div>
    </>
  )
}

/**
 * Items: a category grid, then one category's rows.
 *
 * The party's own items are not kept apart — they sit in whichever category they
 * belong to, sorted to the top and marked with a gold edge. Reagents, Treasure
 * and Misc happen to be entirely campaign items, so three tiles are the party's
 * without anything being filtered.
 */
function Items({
  category,
  rarity,
  q,
  onQuery,
  onCategory,
  onRarity,
  onBack,
}: {
  category: Category | null
  rarity: Rarity | null
  q: string
  onQuery: (next: string) => void
  onCategory: (next: Category | null) => void
  onRarity: (next: Rarity | null) => void
  onBack: () => void
}) {
  const { items, isLoading } = useAllItems()
  const searching = q.trim().length > 0

  // Only the cross-category search hits the server; inside a category the
  // cached pool is small enough to filter here, and must be — see below.
  const search = useSearch('item', category ? '' : q)

  const counts = useMemo(() => categoryCounts(items), [items])

  // Changing category is navigation now, so the list starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [category])

  if (!category) {
    return (
      <ItemGrid
        counts={counts}
        q={q}
        search={search}
        loading={isLoading}
        onQuery={onQuery}
        onCategory={onCategory}
        onBack={onBack}
      />
    )
  }

  const pool = items.filter((item) => categoryOf(item) === category)
  const filter: ItemFilter = { category: null, rarity }

  /*
    Client-side, and deliberately not the server search narrowed down. The
    server caps at 200 rows by rank, and common words genuinely reach it — "a",
    "the", "magic", "you", "gp" and "item" each return exactly 200 — so
    filtering that result to one category silently drops real matches and shows
    "Nothing matching", which is a confident lie. The pool here is at most a
    couple of hundred rows already in cache.
  */
  const named = searching ? pool.filter((item) => tokenMatch(item.name, q)) : pool
  const rows = campaignFirst(rarity ? named.filter((item) => rarityOf(item) === rarity) : named)

  // Where the party's own items stop and the reference begins: ordering made
  // visible, one hairline, no headings. Marked by id rather than index so the
  // virtual list does not have to hand positions back out.
  const own = rows.filter((item) => !isReference(item))
  const lastOwnId = own.length > 0 && own.length < rows.length ? own[own.length - 1]!.id : null

  return (
    <>
      <BrowseHead
        back={{ label: 'All items', onClick: onBack }}
        title={CATEGORY_LABEL[category]}
        q={q}
        placeholder={`Search ${CATEGORY_LABEL[category].toLowerCase()}…`}
        onQuery={onQuery}
      >
        <RarityChips
          pool={pool}
          value={filter}
          onChange={(next) => onRarity(next.rarity)}
        />
      </BrowseHead>

      <div className="flex flex-col gap-4">
        <Section className="flex flex-col gap-2">
          <SectionHead
            label={searching ? 'Matches' : CATEGORY_BLURB[category]}
            note={`${rows.length}`}
          />

          {isLoading ? (
            <Loading />
          ) : (
            <VirtualList
              items={rows}
              getKey={(entity) => entity.id}
              renderItem={(entity) => (
                <>
                  <EntityRow entity={entity} portraitSize={48} marked={!isReference(entity)} />
                  {entity.id === lastOwnId && <div className="my-1 h-px bg-line" />}
                </>
              )}
            />
          )}

          {!isLoading && rows.length === 0 && (
            <Empty>
              {searching ? `No ${CATEGORY_LABEL[category].toLowerCase()} match "${q}"` : 'Nothing here yet'}
            </Empty>
          )}

          {/*
            The way out of a wrong guess. Searching inside a category cannot see
            body text or other categories, so without this a miss is
            indistinguishable from "it does not exist".
          */}
          {searching && (
            <motion.button
              type="button"
              className="type-meta flex cursor-pointer items-center justify-center gap-1.5 py-2 text-gold"
              whileTap={{ scale: 0.98 }}
              transition={SPRING}
              onClick={() => onCategory(null)}
            >
              Search all items for “{q}”
              <LuChevronRight className="size-3.5" aria-hidden />
            </motion.button>
          )}
        </Section>

        <DmCreateBar path="/codex" only={['item']} />
      </div>
    </>
  )
}

/** The category tiles, or — when searching — results from across all of them. */
function ItemGrid({
  counts,
  q,
  search,
  loading,
  onQuery,
  onCategory,
  onBack,
}: {
  counts: Record<Category, number>
  q: string
  search: ReturnType<typeof useSearch>
  loading: boolean
  onQuery: (next: string) => void
  onCategory: (next: Category) => void
  onBack: () => void
}) {
  const searching = q.trim().length > 0
  const rows = search.data ?? []

  // Grouped by category so a hit says which drawer it lives in. Relevance is
  // kept within each group; campaignFirst is deliberately not applied, because
  // floating an owned item above a better-matching one reads as broken.
  const grouped = useMemo(() => {
    const byCategory = new Map<Category, EntitySummary[]>()
    for (const row of rows) {
      const key = categoryOf(row)
      const bucket = byCategory.get(key)
      if (bucket) bucket.push(row)
      else byCategory.set(key, [row])
    }
    return CATEGORIES.filter((c) => byCategory.has(c)).map((c) => ({
      category: c,
      rows: byCategory.get(c) ?? [],
    }))
  }, [rows])

  return (
    <>
      <BrowseHead
        back={{ label: 'All of the codex', onClick: onBack }}
        title="Items"
        q={q}
        placeholder="Search every item…"
        onQuery={onQuery}
      />

      {searching ? (
        <div className="flex flex-col gap-4">
          {search.isLoading ? (
            <Loading />
          ) : (
            grouped.map(({ category, rows: found }) => (
              <Section key={category} className="flex flex-col gap-2">
                <SectionHead label={CATEGORY_LABEL[category]} note={`${found.length}`} />
                <StaggerList>
                  {found.map((entity) => (
                    <EntityRow
                      key={entity.id}
                      entity={entity}
                      portraitSize={48}
                      marked={!isReference(entity)}
                    />
                  ))}
                </StaggerList>
              </Section>
            ))
          )}

          {!search.isLoading && !search.settling && rows.length === 0 && (
            <Empty>Nothing matching “{q}”</Empty>
          )}
        </div>
      ) : loading ? (
        <Loading />
      ) : (
        <>
          <StaggerList className="grid grid-cols-2 gap-3">
            {CATEGORIES.filter((category) => counts[category] > 0).map((category) => (
              <Tile
                key={category}
                icon={CATEGORY_ICON[category]}
                label={CATEGORY_LABEL[category]}
                count={counts[category]}
                blurb={CATEGORY_BLURB[category]}
                onClick={() => onCategory(category)}
              />
            ))}
          </StaggerList>

          <div className="mt-4">
            <DmCreateBar path="/codex" only={['item']} />
          </div>
        </>
      )}
    </>
  )
}
