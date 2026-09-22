import { useQueries } from '@tanstack/react-query'
import type { Entity, EntitySummary, RecipeData } from '@codex/shared'
import DOMPurify from 'dompurify'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuChevronLeft, LuPrinter, LuSearch } from 'react-icons/lu'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import VirtualList from '../components/VirtualList'
import { Empty, Loading, Portrait } from '../components/bits'
import { Chip, cx, ctaClass, inputClass, panelClass, rowClass } from '../components/ui'
import { tokenMatch } from '../lib/textMatch'
import { useAllEntities } from '../lib/useAllEntities'
import { splitWikiText } from '../lib/wikiLinks'
import { createWikiMarked } from '../lib/wikiMarked'
import { specRowsFor, templateFor, TEMPLATES } from '../templates'

/** Cards to a printed sheet. Mirrors the 2-column, 3-row grid in `.print-sheet`. */
const PER_SHEET = 6

/** How many spec rows fit a 94x84mm card before the overflow clips them. */
const MAX_SPEC_ROWS = 8

/** Characters of prose a card can hold under a full spec list. */
const EXCERPT_CHARS = 420

/**
 * One instance, deliberately built with **no name index**.
 *
 * Given an index the renderer emits an `<a href="/e/...">`, which is a dead
 * blue word once it is ink on paper. Without one it emits the label as plain
 * text, which is exactly what a printed card wants — so this is reuse, not a
 * second renderer to keep in step.
 */
const printMarked = createWikiMarked()

/**
 * An empty index, so nothing ever resolves. Same reasoning as `printMarked`:
 * a spec value like "[[The Everwyvern House]]" has to reach paper as the name,
 * not as the markup and not as a link nobody can tap.
 */
const NO_NAMES = new Map<string, string>()

/** A template field's value as plain text, with any `[[links]]` unwrapped. */
function plainValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return splitWikiText(String(value), NO_NAMES)
    .map((segment) => segment.text)
    .join('')
}

/** The order type chips appear in: template order, then anything unrecognised. */
const TYPE_ORDER = Object.keys(TEMPLATES)

function sortTypes(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a)
    const bi = TYPE_ORDER.indexOf(b)
    return (ai < 0 ? TYPE_ORDER.length : ai) - (bi < 0 ? TYPE_ORDER.length : bi)
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Trim prose to something that fits the card, on a word boundary.
 *
 * The CSS clips anything left over, so this is not what keeps the card honest
 * — it is what stops us handing the sanitiser half a megabyte of SRD rules
 * text per card and then hiding almost all of it.
 */
function excerptOf(bodyMd: string): string {
  if (bodyMd.length <= EXCERPT_CHARS) return bodyMd
  const cut = bodyMd.slice(0, EXCERPT_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > EXCERPT_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Pick entries, get a sheet of playing-card handouts.
 *
 * Rendered outside `Layout` — see the route split in `App.tsx`. The app chrome
 * is sticky, full-height and dark, none of which survives contact with a
 * printer, and framer-motion's inline `opacity: 0` cannot be overridden from a
 * print stylesheet. So this page owns its own frame and uses no motion at all.
 */
export default function PrintPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  /*
    The selection lives in the query string rather than in state: a reload keeps
    it, the back button works, and a DM can send someone the exact sheet.
  */
  const ids = useMemo(() => {
    const raw = params.get('ids')
    if (!raw) return [] as string[]
    // Deduplicated, because a link can be hand-edited and a card printed twice
    // by accident is wasted paper.
    return [...new Set(raw.split(',').filter(Boolean))]
  }, [params])

  /*
    On by default. An item card without its rules text, or an NPC card without
    the line about who they are, is not much of a handout — so the excerpt is
    what you get unless you say otherwise, and `body=0` is what turns it off.
  */
  const withBody = params.get('body') !== '0'

  const all = useAllEntities()
  const pool = useMemo(() => all.data ?? [], [all.data])

  const byId = useMemo(() => new Map(pool.map((e) => [e.id, e])), [pool])

  /*
    An entry can be deleted between someone sharing a link and someone opening
    it, and a player following a DM's link may simply not be allowed to see one
    of them. Neither is an error worth a screen — drop them and say how many.
  */
  const selected = useMemo(
    () => ids.map((id) => byId.get(id)).filter((e): e is EntitySummary => Boolean(e)),
    [ids, byId],
  )
  const missing = all.isLoading ? 0 : ids.length - selected.length

  const setIds = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams()
      if (next.length > 0) params.set('ids', next.join(','))
      if (!withBody) params.set('body', '0')
      // Replace, so picking ten entries does not leave ten history entries
      // between the sheet and the page the DM came from.
      setParams(params, { replace: true })
    },
    [setParams, withBody],
  )

  const toggle = useCallback(
    (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
    [ids, setIds],
  )

  const setBody = useCallback(
    (on: boolean) => {
      const params = new URLSearchParams()
      if (ids.length > 0) params.set('ids', ids.join(','))
      if (!on) params.set('body', '0')
      setParams(params, { replace: true })
    },
    [ids, setParams],
  )

  /*
    `bodyMd` is deliberately absent from list responses, so the one thing the
    cached pool cannot answer is the prose excerpt. Fetch it per entry, and only
    when the toggle is on — keyed exactly as the entry page keys it, so coming
    here from an entry costs nothing.
  */
  const bodies = useQueries({
    queries: withBody
      ? selected.map((e) => ({
          queryKey: ['entity', e.id],
          queryFn: (): Promise<Entity> => api.getEntity(e.id),
          staleTime: 60_000,
        }))
      : [],
  })

  const bodyById = useMemo(() => {
    const map = new Map<string, string>()
    for (const q of bodies) {
      const entity = q.data
      if (entity?.bodyMd) map.set(entity.id, entity.bodyMd)
    }
    return map
  }, [bodies])

  const bodiesLoading = withBody && bodies.some((q) => q.isLoading)

  const sheets = useMemo(() => chunk(selected, PER_SHEET), [selected])

  return (
    <div className="print-root min-h-screen">
      <Controls
        count={selected.length}
        sheets={sheets.length}
        missing={missing}
        withBody={withBody}
        onBody={setBody}
        onClear={() => setIds([])}
        onBack={() => navigate(-1)}
        cards={sheets}
        bodyById={bodyById}
        waiting={all.isLoading || bodiesLoading}
      />

      <div className="print-hide mx-auto w-full max-w-195 px-4.5 pb-10">
        <Picker pool={pool} loading={all.isLoading} ids={ids} onToggle={toggle} />
      </div>

      <Preview sheets={sheets} bodyById={bodyById} empty={selected.length === 0} />
    </div>
  )
}

/* ── the bar above the sheet ──────────────────────────────────────── */

function Controls({
  count,
  sheets,
  missing,
  withBody,
  onBody,
  onClear,
  onBack,
  cards,
  bodyById,
  waiting,
}: {
  count: number
  sheets: number
  missing: number
  withBody: boolean
  onBody: (on: boolean) => void
  onClear: () => void
  onBack: () => void
  cards: EntitySummary[][]
  bodyById: Map<string, string>
  waiting: boolean
}) {
  const ready = useArtReady(cards, bodyById, waiting)

  return (
    <div className="print-hide sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-195 flex-wrap items-center gap-x-4 gap-y-2 px-4.5 py-3">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.25 py-1 text-[9.5px] tracking-[0.13em] text-ink-faint uppercase"
          onClick={onBack}
        >
          <LuChevronLeft aria-hidden />
          Back
        </button>

        <span className="type-meta tabular-nums">
          {count === 0
            ? 'Nothing selected'
            : `${count} selected · ${sheets} sheet${sheets === 1 ? '' : 's'}`}
        </span>

        <label className="type-meta flex cursor-pointer items-center gap-1.75">
          <input
            type="checkbox"
            className="size-3.5 accent-[#666]"
            checked={withBody}
            onChange={(e) => onBody(e.target.checked)}
          />
          Include body excerpt
        </label>

        <div className="ml-auto flex items-center gap-2.5">
          {count > 0 && (
            <button
              type="button"
              className="type-meta cursor-pointer underline-offset-2 hover:underline"
              onClick={onClear}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className={ctaClass('primary', 'w-auto px-5')}
            disabled={count === 0 || !ready}
            onClick={() => window.print()}
          >
            <LuPrinter aria-hidden />
            {count === 0 ? 'Print' : ready ? 'Print' : 'Loading art…'}
          </button>
        </div>

        {missing > 0 && (
          <div className="type-meta basis-full text-ink-faint">
            {missing} {missing === 1 ? 'entry was' : 'entries were'} skipped — deleted, or not
            yours to see.
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Whether every card's art has actually decoded.
 *
 * `window.print()` freezes the page as it stands, so a click landing before the
 * images arrive prints a sheet of empty frames — and with four cards to a sheet
 * there are a lot of images in flight at once. The Print button stays disabled
 * until this says yes, which makes the race unreachable rather than unlikely.
 */
function useArtReady(
  cards: EntitySummary[][],
  bodyById: Map<string, string>,
  waiting: boolean,
): boolean {
  const [ready, setReady] = useState(false)
  // The identity of what is on the sheet, so a re-render does not re-arm this
  // but changing the selection does.
  const signature = cards.flat().map((e) => `${e.id}:${e.imageUrl ?? ''}`).join('|')

  useEffect(() => {
    if (waiting) {
      setReady(false)
      return
    }

    let cancelled = false
    setReady(false)

    const run = async () => {
      // A frame, so the cards this effect is about are actually in the DOM.
      await new Promise((resolve) => requestAnimationFrame(resolve))
      if (cancelled) return

      const images = Array.from(document.querySelectorAll<HTMLImageElement>('.print-card img'))

      await Promise.all(
        images.map((img) =>
          img.complete
            ? // A decoded-but-broken image rejects; a broken image still prints
              // its fallback box, so that is not a reason to stay disabled.
              img.decode().catch(() => undefined)
            : new Promise<void>((resolve) => {
                img.onload = () => resolve()
                img.onerror = () => resolve()
              }),
        ),
      )

      // Serif headings reflow if the webfont lands after the print snapshot.
      await document.fonts?.ready?.catch?.(() => undefined)

      if (!cancelled) setReady(true)
    }

    void run()
    return () => {
      cancelled = true
    }
    // bodyById changes the card's text, not its art, but a card that grows
    // prose after the gate opened is still a card we have not measured.
  }, [signature, bodyById, waiting])

  return ready
}

/* ── choosing what to print ───────────────────────────────────────── */

function Picker({
  pool,
  loading,
  ids,
  onToggle,
}: {
  pool: EntitySummary[]
  loading: boolean
  ids: string[]
  onToggle: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string | null>(null)

  const needle = query.trim()

  /*
    Name-only and client-side, the same call `AddItemSheet` makes and for the
    same reason: by the time you are printing a card you know what it is
    called, and matching body text would bury "Red Larch" under every entry
    whose prose mentions it. `tokenMatch` is token-AND, so "veln harbour"
    finds "Harbourmaster Veln".
  */
  const named = useMemo(
    () => (needle ? pool.filter((e) => tokenMatch(e.name, needle)) : pool),
    [pool, needle],
  )

  // Counts come off the name-filtered set, so a chip tells you what it would
  // actually yield rather than what the whole codex holds.
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of named) map.set(e.type, (map.get(e.type) ?? 0) + 1)
    return map
  }, [named])

  const types = useMemo(() => sortTypes([...counts.keys()]), [counts])

  const matches = useMemo(() => {
    const rows = type ? named.filter((e) => e.type === type) : named
    return [...rows].sort((a, b) => a.name.localeCompare(b.name))
  }, [named, type])

  const selectedSet = useMemo(() => new Set(ids), [ids])

  return (
    <div className={panelClass('mt-4 flex flex-col gap-3')}>
      <div className="relative flex items-center">
        <LuSearch
          className="pointer-events-none absolute left-3.25 size-3.75 text-ink-faint"
          aria-hidden
        />
        <input
          className={cx(inputClass, 'pl-9.5')}
          value={query}
          placeholder="Search entries…"
          onChange={(e) => {
            setQuery(e.target.value)
            scrollRef.current?.scrollTo({ top: 0 })
          }}
        />
      </div>

      <div className="flex flex-wrap gap-1.75">
        <Chip
          label="All"
          count={named.length}
          selected={type === null}
          onClick={() => setType(null)}
        />
        {types.map((t) => (
          <Chip
            key={t}
            label={templateFor(t).label}
            count={counts.get(t) ?? 0}
            selected={type === t}
            onClick={() => {
              setType(type === t ? null : t)
              scrollRef.current?.scrollTo({ top: 0 })
            }}
          />
        ))}
      </div>

      <div ref={scrollRef} className="max-h-96 overflow-y-auto">
        {loading ? (
          <Loading />
        ) : matches.length === 0 ? (
          <Empty>Nothing matches</Empty>
        ) : (
          <VirtualList
            items={matches}
            scrollRef={scrollRef}
            estimate={46}
            getKey={(e) => e.id}
            renderItem={(e) => (
              <PickerRow
                entity={e}
                checked={selectedSet.has(e.id)}
                onToggle={() => onToggle(e.id)}
              />
            )}
          />
        )}
      </div>
    </div>
  )
}

function PickerRow({
  entity,
  checked,
  onToggle,
}: {
  entity: EntitySummary
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className={cx(rowClass, 'cursor-pointer')}>
      <input
        type="checkbox"
        className="size-3.5 shrink-0 accent-[#666]"
        checked={checked}
        onChange={onToggle}
      />
      <Portrait entity={entity} size={30} />
      <span className="min-w-0 flex-1 truncate">{entity.name}</span>
      <span className="type-meta shrink-0">{templateFor(entity.type).label}</span>
    </label>
  )
}

/* ── the sheets ───────────────────────────────────────────────────── */

function Preview({
  sheets,
  bodyById,
  empty,
}: {
  sheets: EntitySummary[][]
  bodyById: Map<string, string>
  empty: boolean
}) {
  const scale = usePreviewScale()

  if (empty) {
    return (
      <div className="print-hide mx-auto w-full max-w-195 px-4.5 pb-16">
        <Empty>Tick an entry above to build a sheet</Empty>
      </div>
    )
  }

  return (
    <div className="print-preview mx-auto w-full max-w-195 px-4.5 pb-16">
      {/*
        The sheet is a fixed 165mm wide so it prints true to size, which is far
        wider than a phone. Scaling the preview keeps it honest — the card is
        still 70x120mm, we are just looking at it from further away.

        `zoom` rather than `transform: scale`, because a transform does not
        change the layout box: the sheet would still claim its full 624px and
        push a horizontal scrollbar onto the page it is supposed to fit inside.
        Print resets it, so none of this reaches the paper.
      */}
      <div className="print-scale" style={{ zoom: scale }}>
        <div className="print-stack flex flex-col items-center gap-6">
          {sheets.map((cards, i) => (
            // The outline separates one sheet from the next on screen. On
            // paper the sheet *is* the page, so the print rules drop it.
            <div key={i} className="print-sheet border border-line">
              {cards.map((entity) => (
                <PrintCard key={entity.id} entity={entity} bodyMd={bodyById.get(entity.id)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The preview's on-screen scale. 208mm of sheet is about 786px at 96dpi. */
const SHEET_PX = 786

function usePreviewScale(): number {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const measure = () => {
      // 18px of gutter a side. The cap sits just above a full-size sheet, so a
      // wide window shows it at 1:1 rather than at a permanent 99%.
      const available = Math.min(window.innerWidth - 36, SHEET_PX + 40)
      setScale(Math.min(1, available / SHEET_PX))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return scale
}

function PrintCard({ entity, bodyMd }: { entity: EntitySummary; bodyMd?: string }) {
  const template = templateFor(entity.type)
  const Icon = template.icon
  const [broken, setBroken] = useState(false)

  const src = entity.imageUrl && !broken ? entity.imageUrl : null

  /*
    Template order is priority order, so clipping the tail is the right cut:
    an item's rarity matters more than its charges. The CSS would hide the
    overflow anyway; capping here keeps the DOM honest about what is shown.
  */
  const rows = specRowsFor(entity.type, entity.data).slice(0, MAX_SPEC_ROWS)

  const ingredients =
    entity.type === 'recipe' ? ((entity.data as RecipeData).ingredients ?? []) : []

  const html = useMemo(() => {
    if (!bodyMd) return null
    return DOMPurify.sanitize(printMarked.parse(excerptOf(bodyMd)) as string)
  }, [bodyMd])

  return (
    <article className="print-card">
      <div className="print-card-art">
        {src ? (
          // Eager and synchronous, unlike `Portrait`, which is lazy — a card
          // below the fold must still have its art in hand when print fires.
          <img
            src={src}
            alt=""
            loading="eager"
            decoding="sync"
            onError={() => setBroken(true)}
          />
        ) : (
          // The band already centres its child, so this only stacks the two.
          <div className="flex flex-col items-center gap-1 text-ink-muted">
            <Icon aria-hidden className="size-6" />
            <span className="text-[7.5px] tracking-[0.14em] uppercase">
              {template.portraitWord}
            </span>
          </div>
        )}
      </div>

      <div className="print-card-body">
        <div>
          <h2 className={cx('print-card-name', entity.name.length > 28 && 'is-long')}>
            {entity.name}
          </h2>
          {/* Type only. A handout is always going to a player, so what the
              party is allowed to know is not a question the card answers. */}
          <div className="mt-0.5 text-[7.4px] tracking-[0.13em] text-ink-faint uppercase">
            {template.label}
          </div>
        </div>

        {entity.summary && (
          <p className="m-0 line-clamp-3 text-[8.4px] leading-[1.32] text-ink-dim">
            {plainValue(entity.summary)}
          </p>
        )}

        {(rows.length > 0 || ingredients.length > 0) && <div className="print-rule" />}

        {rows.length > 0 && (
          <dl>
            {rows.map(({ field, value }) => (
              <div key={field.key} className="contents">
                <dt>{field.label}</dt>
                <dd>{plainValue(value)}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Reagents are a list, not a label/value pair, so `specRowsFor` drops
            them and they get one compact line of their own. No holdings query:
            a printed card cannot know what the party is carrying by the time
            someone reads it. */}
        {ingredients.length > 0 && (
          <div className="text-[8.2px] leading-[1.3] text-ink-dim">
            <span className="text-[7.4px] tracking-[0.07em] text-ink-faint uppercase">
              Reagents{' '}
            </span>
            {ingredients.map((r) => `${r.qty}x ${r.name}`).join(' · ')}
          </div>
        )}

        {html && (
          <div className="print-card-prose md" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </article>
  )
}
