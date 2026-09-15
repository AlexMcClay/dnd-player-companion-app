import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { EntitySummary } from '@codex/shared'
import { motion } from 'framer-motion'
import { useMemo, type ReactNode } from 'react'
import { LuChevronLeft, LuChevronRight, LuLibrary, LuSearch, LuX } from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import DmCreateBar from '../components/DmCreateBar'
import ItemFilterBar from '../components/ItemFilterBar'
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
import { cx, inputClass, panelClass, rowClass } from '../components/ui'
import {
  filterItems,
  isShelf,
  shelfOf,
  type CategoryGroup,
  type ItemFilter,
  type Rarity,
  type Shelf,
  CATEGORY_GROUPS,
  NO_FILTER,
  RARITIES,
} from '../lib/itemFacets'
import { rowVariants, SPRING } from '../lib/motion'
import { useAllEntities, useAllItems } from '../lib/useAllEntities'
import { useDebounced } from '../lib/useDebounced'
import { CODEX_TYPES, templateFor } from '../templates'

type CodexType = (typeof CODEX_TYPES)[number]

const BLURB: Record<CodexType, string> = {
  npc: 'People you have met',
  faction: 'Who holds power, and how they feel about you',
  location: 'Countries, cities, districts and the odd inn',
  monster: 'What you have fought, and what you learned',
  item: 'What the party has actually found',
}

function isCodexType(value: string | null): value is CodexType {
  return value !== null && (CODEX_TYPES as readonly string[]).includes(value)
}

function isGroup(value: string | null): value is CategoryGroup {
  return value !== null && (CATEGORY_GROUPS as readonly string[]).includes(value)
}

function isRarity(value: string | null): value is Rarity {
  return value !== null && (RARITIES as readonly string[]).includes(value)
}

/**
 * The shared pool of knowledge. Choose a kind from the grid, then browse or
 * search within it. Everything — kind, shelf, query, filters — lives in the URL,
 * so back works and any view can be shared.
 */
export default function CodexPage() {
  const [params, setParams] = useSearchParams()

  const groupParam = params.get('group')
  const group = isCodexType(groupParam) ? groupParam : null

  const shelfParam = params.get('shelf')
  const shelf: Shelf = isShelf(shelfParam) ? shelfParam : 'campaign'

  const q = params.get('q') ?? ''
  const catParam = params.get('cat')
  const rarityParam = params.get('rarity')
  const filter: ItemFilter = {
    group: isGroup(catParam) ? catParam : null,
    rarity: isRarity(rarityParam) ? rarityParam : null,
  }

  interface Nav {
    group: CodexType | null
    shelf: Shelf
    q: string
    filter: ItemFilter
  }

  function open(next: Partial<Nav>) {
    const merged: Nav = { group, shelf, q, filter, ...next }
    const out = new URLSearchParams()
    if (merged.group) out.set('group', merged.group)
    // 'campaign' is the default, so it stays out of the URL.
    if (merged.shelf === 'reference') out.set('shelf', 'reference')
    if (merged.q) out.set('q', merged.q)
    if (merged.filter.group) out.set('cat', merged.filter.group)
    if (merged.filter.rarity) out.set('rarity', merged.filter.rarity)

    // Typing and toggling a chip replace; changing shelf or kind pushes, so
    // stepping into the reference is something back can step out of.
    const sameView = merged.group === group && merged.shelf === shelf
    setParams(out, { replace: sameView })
  }

  if (!group) return <TypeGrid onPick={(type) => open({ group: type, q: '', filter: NO_FILTER })} />

  if (group === 'item') {
    return (
      <ItemShelf
        shelf={shelf}
        q={q}
        filter={filter}
        onQuery={(next) => open({ q: next })}
        onFilter={(next) => {
          // The virtualiser will happily leave you stranded in blank space when
          // 598 rows become 12.
          window.scrollTo({ top: 0 })
          open({ filter: next })
        }}
        onShelf={(next) => open({ shelf: next, q: '', filter: NO_FILTER })}
        onBack={() =>
          shelf === 'reference'
            ? open({ shelf: 'campaign', q: '', filter: NO_FILTER })
            : open({ group: null, q: '', filter: NO_FILTER })
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
  const countOf = (type: CodexType) => rows.filter((entity) => entity.type === type).length
  // The Items tile counts the campaign shelf, because that is where it lands.
  const referenceCount = rows.filter(
    (entity) => entity.type === 'item' && shelfOf(entity) === 'reference',
  ).length
  const campaignItems = countOf('item') - referenceCount

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
            const Icon = template.icon
            const isItem = type === 'item'
            return (
              <motion.button
                key={type}
                type="button"
                className={panelClass('flex cursor-pointer flex-col items-start gap-2 text-left')}
                variants={rowVariants}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                onClick={() => onPick(type)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <Icon className="size-5 text-gold" aria-hidden />
                  <span className="type-meta">{isItem ? campaignItems : countOf(type)}</span>
                </span>
                <span className="type-name">{template.plural}</span>
                <span className="type-meta leading-relaxed normal-case tracking-normal">
                  {BLURB[type]}
                </span>
                {isItem && referenceCount > 0 && (
                  <span className="type-meta text-ink-muted">+{referenceCount} reference</span>
                )}
              </motion.button>
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

/** Back link, title and search box — the chrome every browse view shares. */
function BrowseHead({
  back,
  title,
  subtitle,
  q,
  placeholder,
  onQuery,
  children,
}: {
  back: { label: string; onClick: () => void }
  title: string
  subtitle?: ReactNode
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
      {subtitle && <div className="type-meta">{subtitle}</div>}

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
 * Server-side search for one kind, debounced.
 *
 * Kept server-side because it matches body text, which the list payload does not
 * carry — a client-side filter could only ever see names and summaries.
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

/** One kind, searchable. Everything except items, which have shelves. */
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
          <SectionHead label={q ? 'Matches' : BLURB[group]} note={busy ? undefined : `${rows.length}`} />

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
 * Items, split in two.
 *
 * The campaign shelf is what the party has actually found — a dozen or so
 * things, each of which means something. The reference shelf is the SRD: six
 * hundred rows nobody browses, only looks up. They were one list, and the dozen
 * drowned in the six hundred.
 */
function ItemShelf({
  shelf,
  q,
  filter,
  onQuery,
  onFilter,
  onShelf,
  onBack,
}: {
  shelf: Shelf
  q: string
  filter: ItemFilter
  onQuery: (next: string) => void
  onFilter: (next: ItemFilter) => void
  onShelf: (next: Shelf) => void
  onBack: () => void
}) {
  const { items, isLoading } = useAllItems()
  const search = useSearch('item', q)
  const searching = q.trim().length > 0

  const counts = useMemo(
    () => ({
      campaign: items.filter((item) => shelfOf(item) === 'campaign').length,
      reference: items.filter((item) => shelfOf(item) === 'reference').length,
    }),
    [items],
  )

  // Searching goes to the server (it reads body text); browsing reads the list
  // already in cache. Either way the shelf predicate is the same one.
  const pool = useMemo(() => {
    const source: EntitySummary[] = searching ? (search.data ?? []) : items
    return source.filter((item) => item.type === 'item' && shelfOf(item) === shelf)
  }, [searching, search.data, items, shelf])

  const reference = shelf === 'reference'
  // Facets are the reference shelf's problem. On the campaign shelf they would
  // slice a dozen rows into ones and twos, and most would land in "Other" —
  // 11 of the 14 use a category the SRD taxonomy has no word for.
  const rows = reference ? filterItems(pool, filter) : pool

  const busy = (searching ? search.isLoading : isLoading) || search.settling

  return (
    <>
      <BrowseHead
        back={{
          label: reference ? 'Campaign items' : 'All of the codex',
          onClick: onBack,
        }}
        title={reference ? 'Rules reference' : 'Items'}
        subtitle={reference ? 'Every item in the SRD' : undefined}
        q={q}
        placeholder={reference ? 'Search the reference…' : 'Search the party’s items…'}
        onQuery={onQuery}
      >
        {reference && <ItemFilterBar pool={pool} value={filter} onChange={onFilter} />}
      </BrowseHead>

      <div className="flex flex-col gap-4">
        <Section className="flex flex-col gap-2">
          <SectionHead
            label={searching ? 'Matches' : reference ? 'Reference' : BLURB.item}
            note={busy ? undefined : `${rows.length}`}
          />

          {busy && rows.length === 0 ? (
            <Loading />
          ) : (
            <VirtualList
              items={rows}
              getKey={(entity) => entity.id}
              renderItem={(entity) => <EntityRow entity={entity} portraitSize={48} />}
            />
          )}

          {!busy && rows.length === 0 && (
            <Empty>
              {searching
                ? `Nothing matching "${q}"`
                : reference
                  ? 'Nothing matches those filters'
                  : 'The party has not found anything yet'}
            </Empty>
          )}
        </Section>

        {!reference && (
          <>
            <DmCreateBar path="/codex" only={['item']} />

            {/*
              The doorway. Deliberately at the bottom and understated: the
              reference is what you step into when the campaign shelf did not
              have what you wanted, not the thing you came here for.
            */}
            <motion.button
              type="button"
              className={cx(rowClass, 'cursor-pointer border-t border-line pt-3.5')}
              whileTap={{ scale: 0.99 }}
              transition={SPRING}
              onClick={() => onShelf('reference')}
            >
              <span className="grid size-9 shrink-0 place-items-center border border-gold-dim bg-gold-tint text-gold">
                <LuLibrary className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-name block">Rules reference</span>
                <span className="type-meta mt-0.75 block">
                  {counts.reference} SRD entries · weapons, armour, gear, magic
                </span>
              </span>
              <LuChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
            </motion.button>
          </>
        )}
      </div>
    </>
  )
}
