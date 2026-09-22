import { useQueries } from '@tanstack/react-query'
import type { Entity, EntitySummary, RecipeData } from '@codex/shared'
import DOMPurify from 'dompurify'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuChevronLeft, LuMinus, LuPlus, LuPrinter, LuSearch, LuX } from 'react-icons/lu'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import VirtualList from '../components/VirtualList'
import { Empty, Loading, Portrait } from '../components/bits'
import {
  Chip,
  cx,
  ctaClass,
  inputClass,
  panelClass,
  PillButton,
  rowClass,
  StepButton,
} from '../components/ui'
import {
  COLUMN_CHOICES,
  DEFAULT_GRID,
  excerptBudget,
  expandPicks,
  formatGrid,
  formatPicks,
  MAX_CARDS,
  MAX_COUNT,
  packSheets,
  parseGrid,
  parsePicks,
  ROW_CHOICES,
  specRowBudget,
  type Grid,
  type Pick,
  type Placed,
} from '../lib/packSheets'
import { tokenMatch } from '../lib/textMatch'
import { useAllEntities } from '../lib/useAllEntities'
import { splitWikiText } from '../lib/wikiLinks'
import { createWikiMarked } from '../lib/wikiMarked'
import { specRowsFor, templateFor, TEMPLATES } from '../templates'

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

/** `expandPicks` keys a copy as `<id>#<n>`; this reads the entry back out. */
function idOfKey(key: string): string {
  const cut = key.lastIndexOf('#')
  return cut < 0 ? key : key.slice(0, cut)
}

/**
 * Trim prose to the card's budget, on a word boundary.
 *
 * The budget comes from the card's real size, so a bigger card genuinely
 * shows more. The CSS clips anything left over, so this is not what keeps the
 * card honest — it is what stops us handing the sanitiser half a megabyte of
 * SRD rules text and then hiding almost all of it.
 */
function excerptOf(bodyMd: string, budget: number): string {
  if (bodyMd.length <= budget) return bodyMd
  const cut = bodyMd.slice(0, budget)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > budget * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Pick entries, size the grid, get sheets of handouts.
 *
 * Rendered outside `Layout` — see the route split in `App.tsx`. The app chrome
 * is sticky, full-height and dark, none of which survives contact with a
 * printer, and framer-motion's inline `opacity: 0` cannot be overridden from a
 * print stylesheet. So this page owns its own frame, and the cards themselves
 * use no motion at all.
 */
export default function PrintPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  /*
    Grid and selection both live in the query string rather than in state: a
    reload keeps them, the back button works, and a DM can send someone the
    exact sheet. Every reader falls back to a default, so a hand-edited or
    pre-spans link still opens.
  */
  const grid = useMemo(() => parseGrid(params.get('grid')), [params])
  const picks = useMemo(() => parsePicks(params.get('ids')), [params])

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
  const live = useMemo(() => picks.filter((p) => byId.has(p.id)), [picks, byId])
  const missing = all.isLoading ? 0 : picks.length - live.length

  /** One writer, so the three controls cannot disagree about the other two. */
  const write = useCallback(
    (next: { grid?: Grid; picks?: Pick[]; body?: boolean }) => {
      const nextGrid = next.grid ?? grid
      const nextPicks = next.picks ?? picks
      const nextBody = next.body ?? withBody

      const out = new URLSearchParams()
      if (nextPicks.length > 0) out.set('ids', formatPicks(nextPicks))
      if (nextGrid.cols !== DEFAULT_GRID.cols || nextGrid.rows !== DEFAULT_GRID.rows) {
        out.set('grid', formatGrid(nextGrid))
      }
      if (!nextBody) out.set('body', '0')
      // Replace, so picking ten entries does not leave ten history entries
      // between the sheet and the page the DM came from.
      setParams(out, { replace: true })
    },
    [grid, picks, withBody, setParams],
  )

  const toggle = useCallback(
    (id: string) =>
      write({
        picks: picks.some((p) => p.id === id)
          ? picks.filter((p) => p.id !== id)
          : [...picks, { id, w: 1, h: 1, n: 1 }],
      }),
    [picks, write],
  )

  /** Change one entry's span or count, leaving its place in the order alone. */
  const edit = useCallback(
    (id: string, patch: Partial<Pick>) =>
      write({ picks: picks.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
    [picks, write],
  )

  /*
    `bodyMd` is deliberately absent from list responses, so the one thing the
    cached pool cannot answer is the prose excerpt. Fetch it per entry, and only
    when the toggle is on — keyed exactly as the entry page keys it, so coming
    here from an entry costs nothing. One request per *entry*, not per copy.
  */
  const bodies = useQueries({
    queries: withBody
      ? live.map((p) => ({
          queryKey: ['entity', p.id],
          queryFn: (): Promise<Entity> => api.getEntity(p.id),
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

  const cards = useMemo(() => expandPicks(live), [live])
  const sheets = useMemo(
    () => packSheets(cards, grid.cols, grid.rows),
    [cards, grid.cols, grid.rows],
  )

  const chosen = useMemo(() => new Set(picks.map((p) => p.id)), [picks])

  /** What the picks asked for, before the cap trimmed it. */
  const wanted = useMemo(
    () => live.reduce((sum, p) => sum + Math.max(1, Math.min(p.n, MAX_COUNT)), 0),
    [live],
  )

  return (
    <div className="print-root min-h-screen">
      <Controls
        cards={cards.length}
        sheets={sheets.length}
        missing={missing}
        trimmed={wanted - cards.length}
        withBody={withBody}
        onBody={(body) => write({ body })}
        onClear={() => write({ picks: [] })}
        onBack={() => navigate(-1)}
        placed={sheets}
        bodyById={bodyById}
        waiting={all.isLoading || bodiesLoading}
      />

      <div className="print-hide mx-auto flex w-full max-w-195 flex-col gap-4 px-4.5 pb-10">
        <GridPicker grid={grid} onChange={(next) => write({ grid: next })} />

        {live.length > 0 && (
          <SelectedPanel
            picks={live}
            byId={byId}
            grid={grid}
            onEdit={edit}
            onRemove={(id) => write({ picks: picks.filter((p) => p.id !== id) })}
          />
        )}

        <Picker
          pool={pool}
          loading={all.isLoading}
          chosen={chosen}
          onToggle={toggle}
        />
      </div>

      <Preview sheets={sheets} grid={grid} byId={byId} bodyById={bodyById} />
    </div>
  )
}

/* ── the bar above the sheet ──────────────────────────────────────── */

function Controls({
  cards,
  sheets,
  missing,
  trimmed,
  withBody,
  onBody,
  onClear,
  onBack,
  placed,
  bodyById,
  waiting,
}: {
  cards: number
  sheets: number
  missing: number
  trimmed: number
  withBody: boolean
  onBody: (on: boolean) => void
  onClear: () => void
  onBack: () => void
  placed: Placed[][]
  bodyById: Map<string, string>
  waiting: boolean
}) {
  const ready = useArtReady(placed, bodyById, waiting)

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
          {cards === 0
            ? 'Nothing selected'
            : `${cards} card${cards === 1 ? '' : 's'} · ${sheets} sheet${sheets === 1 ? '' : 's'}`}
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
          {cards > 0 && (
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
            disabled={cards === 0 || !ready}
            onClick={() => window.print()}
          >
            <LuPrinter aria-hidden />
            {cards === 0 ? 'Print' : ready ? 'Print' : 'Loading art…'}
          </button>
        </div>

        {missing > 0 && (
          <div className="type-meta basis-full text-ink-faint">
            {missing} {missing === 1 ? 'entry was' : 'entries were'} skipped — deleted, or not
            yours to see.
          </div>
        )}

        {trimmed > 0 && (
          <div className="type-meta basis-full text-ink-faint">
            Stopped at {MAX_CARDS} cards; {trimmed} more were not laid out.
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
 * images arrive prints a sheet of empty frames — and a dense grid with copies
 * puts a great many images in flight at once. The Print button stays disabled
 * until this says yes, which makes the race unreachable rather than unlikely.
 */
function useArtReady(
  placed: Placed[][],
  bodyById: Map<string, string>,
  waiting: boolean,
): boolean {
  const [ready, setReady] = useState(false)
  // The identity of what is on the sheet, so a re-render does not re-arm this
  // but changing the selection or the grid does.
  const signature = placed
    .flat()
    .map((c) => `${c.key}:${c.col},${c.row},${c.w}x${c.h}`)
    .join('|')

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

/* ── how the sheet is divided ─────────────────────────────────────── */

function GridPicker({ grid, onChange }: { grid: Grid; onChange: (next: Grid) => void }) {
  return (
    <div className={panelClass('flex flex-col gap-2.5')}>
      <div className="type-lab">Sheet</div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Row label="Columns">
          {COLUMN_CHOICES.map((cols) => (
            <PillButton
              key={cols}
              tone={grid.cols === cols ? 'solid' : 'neutral'}
              aria-pressed={grid.cols === cols}
              onClick={() => onChange({ ...grid, cols })}
            >
              {cols}
            </PillButton>
          ))}
        </Row>

        <Row label="Rows">
          {ROW_CHOICES.map((rows) => (
            <PillButton
              key={rows}
              tone={grid.rows === rows ? 'solid' : 'neutral'}
              aria-pressed={grid.rows === rows}
              onClick={() => onChange({ ...grid, rows })}
            >
              {rows}
            </PillButton>
          ))}
        </Row>

        <span className="type-meta tabular-nums">
          {grid.cols * grid.rows} cards a sheet
        </span>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.75">
      <span className="type-meta">{label}</span>
      {children}
    </div>
  )
}

/* ── what has been chosen, and how big ────────────────────────────── */

function SelectedPanel({
  picks,
  byId,
  grid,
  onEdit,
  onRemove,
}: {
  picks: Pick[]
  byId: Map<string, EntitySummary>
  grid: Grid
  onEdit: (id: string, patch: Partial<Pick>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className={panelClass('flex flex-col gap-1')}>
      <div className="type-lab">Selected</div>

      {picks.map((pick) => {
        const entity = byId.get(pick.id)
        if (!entity) return null

        return (
          <div key={pick.id} className={cx(rowClass, 'flex-wrap gap-y-2')}>
            <span className="min-w-0 flex-1 truncate">{entity.name}</span>

            {/* Capped at the grid: a span wider than the sheet is clamped by
                the packer anyway, so offering it would only mislead. */}
            <Span
              label="Wide"
              value={pick.w}
              max={grid.cols}
              name={entity.name}
              onChange={(w) => onEdit(pick.id, { w })}
            />
            <Span
              label="Tall"
              value={pick.h}
              max={grid.rows}
              name={entity.name}
              onChange={(h) => onEdit(pick.id, { h })}
            />
            <Span
              label="Copies"
              value={pick.n}
              max={MAX_COUNT}
              name={entity.name}
              onChange={(n) => onEdit(pick.id, { n })}
            />

            <StepButton label={`Remove ${entity.name}`} onClick={() => onRemove(pick.id)}>
              <LuX aria-hidden />
            </StepButton>
          </div>
        )
      })}
    </div>
  )
}

/** A labelled minus/number/plus triple, floored at one. */
function Span({
  label,
  value,
  max,
  name,
  onChange,
}: {
  label: string
  value: number
  max: number
  name: string
  onChange: (next: number) => void
}) {
  const shown = Math.min(value, max)

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="type-meta w-11 text-right">{label}</span>
      <StepButton
        label={`${name}: less ${label.toLowerCase()}`}
        disabled={shown <= 1}
        onClick={() => onChange(shown - 1)}
      >
        <LuMinus aria-hidden />
      </StepButton>
      <span className="type-meta w-5 text-center text-ink tabular-nums">{shown}</span>
      <StepButton
        label={`${name}: more ${label.toLowerCase()}`}
        disabled={shown >= max}
        onClick={() => onChange(shown + 1)}
      >
        <LuPlus aria-hidden />
      </StepButton>
    </div>
  )
}

/* ── choosing what to print ───────────────────────────────────────── */

function Picker({
  pool,
  loading,
  chosen,
  onToggle,
}: {
  pool: EntitySummary[]
  loading: boolean
  chosen: Set<string>
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

  return (
    <div className={panelClass('flex flex-col gap-3')}>
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
                checked={chosen.has(e.id)}
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
  grid,
  byId,
  bodyById,
}: {
  sheets: Placed[][]
  grid: Grid
  byId: Map<string, EntitySummary>
  bodyById: Map<string, string>
}) {
  const scale = usePreviewScale()

  if (sheets.length === 0) {
    return (
      <div className="print-hide mx-auto w-full max-w-195 px-4.5 pb-16">
        <Empty>Tick an entry above to build a sheet</Empty>
      </div>
    )
  }

  return (
    <div className="print-preview mx-auto w-full max-w-195 px-4.5 pb-16">
      {/*
        The sheet is a full 210mm page so it prints true to size, which is far
        wider than a phone. Scaling the preview keeps it honest — the cards are
        still their real size, we are just looking from further away.

        `zoom` rather than `transform: scale`, because a transform does not
        change the layout box: the sheet would still claim its full width and
        push a horizontal scrollbar onto the page it is supposed to fit inside.
        Print resets it, so none of this reaches the paper.
      */}
      <div className="print-scale" style={{ zoom: scale }}>
        <div className="print-stack flex flex-col items-center gap-6">
          {sheets.map((cards, i) => (
            // The outline separates one sheet from the next on screen. On
            // paper the sheet *is* the page, so the print rules drop it.
            <div
              key={i}
              className="print-sheet border border-line"
              style={
                {
                  '--cols': grid.cols,
                  '--rows': grid.rows,
                } as React.CSSProperties
              }
            >
              {cards.map((card) => {
                const entity = byId.get(idOfKey(card.key))
                if (!entity) return null
                return (
                  <PrintCard
                    key={card.key}
                    entity={entity}
                    placed={card}
                    grid={grid}
                    bodyMd={bodyById.get(entity.id)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The preview's on-screen scale. A 210mm sheet is about 794px at 96dpi. */
const SHEET_PX = 794

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

function PrintCard({
  entity,
  placed,
  grid,
  bodyMd,
}: {
  entity: EntitySummary
  placed: Placed
  grid: Grid
  bodyMd?: string
}) {
  const template = templateFor(entity.type)
  const Icon = template.icon
  const [broken, setBroken] = useState(false)

  const src = entity.imageUrl && !broken ? entity.imageUrl : null

  /*
    Template order is priority order, so dropping the tail is the right cut:
    an item's rarity matters more than its charges. How many survive depends
    on the card's height — a tall card used to throw away fields it had room
    for. The CSS trims further on a card too short even for this.
  */
  const rows = specRowsFor(entity.type, entity.data).slice(
    0,
    specRowBudget(grid, placed.h),
  )

  const ingredients =
    entity.type === 'recipe' ? ((entity.data as RecipeData).ingredients ?? []) : []

  const budget = excerptBudget(grid, placed.w, placed.h, {
    specRows: rows.length,
    summary: Boolean(entity.summary),
  })

  const html = useMemo(() => {
    if (!bodyMd) return null
    return DOMPurify.sanitize(printMarked.parse(excerptOf(bodyMd, budget)) as string)
  }, [bodyMd, budget])

  return (
    <article
      className="print-card"
      // Explicit placement from the packer. Auto-flow is left alone on
      // purpose: `dense` would be a no-op here and would hide a lost
      // placement instead of letting it show up in the preview.
      style={{
        gridColumn: `${placed.col} / span ${placed.w}`,
        gridRow: `${placed.row} / span ${placed.h}`,
      }}
    >
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
          <div className="print-card-fallback flex flex-col items-center gap-1 text-ink-muted">
            <Icon aria-hidden />
            <span className="text-[0.85em] tracking-[0.14em] uppercase">
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
          <div className="mt-0.5 text-[0.84em] tracking-[0.13em] text-ink-faint uppercase">
            {template.label}
          </div>
        </div>

        {entity.summary && (
          <p className="print-card-summary m-0 line-clamp-3 text-[0.95em] leading-[1.32] text-ink-dim">
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
          <div className="text-[0.92em] leading-[1.3] text-ink-dim">
            <span className="text-[0.84em] tracking-[0.07em] text-ink-faint uppercase">
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
