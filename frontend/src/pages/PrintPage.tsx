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
  cardFontCss,
  excerptBudget,
  excerptOf,
  expandPicks,
  formatGrid,
  formatNudge,
  formatPicks,
  MAX_CARDS,
  MAX_COUNT,
  packSheets,
  parseGrid,
  isNudged,
  MAX_NUDGE_MM,
  NUDGE_STEP_MM,
  parseNudge,
  parsePicks,
  ROW_CHOICES,
  specRowBudget,
  withBacks,
  withNudge,
  type Grid,
  type Nudge,
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

  /*
    Off by default: most sheets get cut up and used straight away, and a back
    doubles the paper through the printer. `backs=1` turns it on.
  */
  const withBacksOn = params.get('backs') === '1'

  /*
    A standing correction for this printer's duplex registration. It shifts
    where the backs are painted and nothing else — see the note on `Nudge`.
  */
  const nudge = useMemo(() => parseNudge(params.get('nudge')), [params])

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
    (next: { grid?: Grid; picks?: Pick[]; body?: boolean; backs?: boolean; nudge?: Nudge }) => {
      const nextGrid = next.grid ?? grid
      const nextPicks = next.picks ?? picks
      const nextBody = next.body ?? withBody
      const nextBacks = next.backs ?? withBacksOn
      const nextNudge = next.nudge ?? nudge

      const out = new URLSearchParams()
      if (nextPicks.length > 0) out.set('ids', formatPicks(nextPicks))
      if (nextGrid.cols !== DEFAULT_GRID.cols || nextGrid.rows !== DEFAULT_GRID.rows) {
        out.set('grid', formatGrid(nextGrid))
      }
      if (!nextBody) out.set('body', '0')
      if (nextBacks) out.set('backs', '1')
      if (isNudged(nextNudge)) out.set('nudge', formatNudge(nextNudge))
      // Replace, so picking ten entries does not leave ten history entries
      // between the sheet and the page the DM came from.
      setParams(out, { replace: true })
    },
    [grid, picks, withBody, withBacksOn, nudge, setParams],
  )

  const toggle = useCallback(
    (id: string) =>
      write({
        picks: picks.some((p) => p.id === id)
          ? picks.filter((p) => p.id !== id)
          : [...picks, { id, w: 1, h: 1, n: 1, simple: false }],
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

  /*
    What actually goes through the printer. With backs on, each front is
    followed immediately by its own mirrored back — interleaved, because that
    is the order a duplex printer consumes pages in.
  */
  const pages = useMemo(
    () =>
      withBacksOn
        ? withBacks(sheets, grid.cols, grid.rows)
        : sheets.map((cardsOnSheet) => ({ side: 'front' as const, cards: cardsOnSheet })),
    [sheets, grid.cols, grid.rows, withBacksOn],
  )

  const chosen = useMemo(() => new Set(picks.map((p) => p.id)), [picks])

  /*
    The packer only knows keys and spans, and rightly: whether a card is drawn
    simplified has no bearing on where it goes. The renderer looks it up here.
  */
  const simpleIds = useMemo(
    () => new Set(live.filter((p) => p.simple).map((p) => p.id)),
    [live],
  )

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
        withBacks={withBacksOn}
        onBacks={(backs) => write({ backs })}
        nudge={nudge}
        onNudge={(patch) => write({ nudge: withNudge(nudge, patch) })}
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

      <Preview
        pages={pages}
        grid={grid}
        nudge={nudge}
        byId={byId}
        simpleIds={simpleIds}
        bodyById={bodyById}
      />
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
  withBacks: backsOn,
  onBacks,
  nudge,
  onNudge,
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
  withBacks: boolean
  onBacks: (on: boolean) => void
  nudge: Nudge
  onNudge: (patch: Partial<Nudge>) => void
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
            : `${cards} card${cards === 1 ? '' : 's'} · ${sheets} sheet${sheets === 1 ? '' : 's'}${
                backsOn ? ', both sides' : ''
              }`}
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

        <label className="type-meta flex cursor-pointer items-center gap-1.75">
          <input
            type="checkbox"
            className="size-3.5 accent-[#666]"
            checked={backsOn}
            onChange={(e) => onBacks(e.target.checked)}
          />
          Print backs
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

        {backsOn && (
          <div className="type-meta basis-full text-ink-faint">
            Set your printer to double sided, flipping on the <strong>long edge</strong>. A
            short-edge flip puts every back on the wrong card.
          </div>
        )}

        {backsOn && <Registration nudge={nudge} onNudge={onNudge} />}

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
 * A standing correction for this printer's duplex registration.
 *
 * Every duplex printer lands the second side a fraction off the first: the
 * sheet takes another trip through the rollers and does not come back to
 * exactly the same place. A millimetre or two is ordinary, and no stylesheet
 * can prevent it. What saves it is that a given printer is consistent, so
 * measuring the drift once and shifting the backs by the same amount the
 * other way cancels it for good — and the query string remembers it.
 */
function Registration({
  nudge,
  onNudge,
}: {
  nudge: Nudge
  onNudge: (patch: Partial<Nudge>) => void
}) {
  return (
    <div className="type-meta flex basis-full flex-wrap items-center gap-x-4 gap-y-2">
      <span>Back alignment</span>

      <Nudger
        label="Across"
        value={nudge.x}
        onChange={(x) => onNudge({ x })}
        less="left"
        more="right"
      />
      <Nudger
        label="Down"
        value={nudge.y}
        onChange={(y) => onNudge({ y })}
        less="up"
        more="down"
      />

      {isNudged(nudge) && (
        <button
          type="button"
          className="cursor-pointer underline-offset-2 hover:underline"
          onClick={() => onNudge({ x: 0, y: 0 })}
        >
          Reset
        </button>
      )}

      <span className="text-ink-faint">
        Print one sheet, hold it to the light, and shift the backs by whatever you measure.
      </span>
    </div>
  )
}

function Nudger({
  label,
  value,
  onChange,
  less,
  more,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  less: string
  more: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="w-11 text-right">{label}</span>
      <StepButton
        label={`Move the backs ${less}`}
        disabled={value <= -MAX_NUDGE_MM}
        onClick={() => onChange(value - NUDGE_STEP_MM)}
      >
        <LuMinus aria-hidden />
      </StepButton>
      {/* Wide enough for "-0.4mm" so the row does not jitter as it changes. */}
      <span className="w-12 text-center text-ink tabular-nums">{value.toFixed(1)}mm</span>
      <StepButton
        label={`Move the backs ${more}`}
        disabled={value >= MAX_NUDGE_MM}
        onClick={() => onChange(value + NUDGE_STEP_MM)}
      >
        <LuPlus aria-hidden />
      </StepButton>
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

            {/* Trades the art band for a thumbnail beside the name, for an
                entry whose value is in its words rather than its picture. */}
            <PillButton
              tone={pick.simple ? 'solid' : 'neutral'}
              aria-pressed={pick.simple}
              title="Swap the art for a small portrait, leaving more room for text"
              onClick={() => onEdit(pick.id, { simple: !pick.simple })}
            >
              Simple
            </PillButton>

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
  pages,
  grid,
  nudge,
  byId,
  simpleIds,
  bodyById,
}: {
  pages: Array<{ side: 'front' | 'back'; cards: Placed[] }>
  grid: Grid
  nudge: Nudge
  byId: Map<string, EntitySummary>
  simpleIds: Set<string>
  bodyById: Map<string, string>
}) {
  const scale = usePreviewScale()

  if (pages.length === 0) {
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
          {pages.map((page, i) => (
            // The outline separates one sheet from the next on screen. On
            // paper the sheet *is* the page, so the print rules drop it.
            <div
              key={i}
              className="print-sheet border border-line"
              style={
                {
                  '--cols': grid.cols,
                  '--rows': grid.rows,
                  // The text scale, from the one definition the budgets use.
                  '--card-font': CARD_FONT_CSS,
                  /*
                    The registration correction, on the backs only.

                    A transform rather than a margin or padding on purpose: it
                    moves where the sheet is painted without touching where it
                    sits in the flow, so a nudge can never shunt a card onto
                    another page. Pagination is decided before this applies.
                  */
                  ...(page.side === 'back' && isNudged(nudge)
                    ? { transform: `translate(${nudge.x}mm, ${nudge.y}mm)` }
                    : null),
                } as React.CSSProperties
              }
            >
              {page.cards.map((card) => {
                const entity = byId.get(idOfKey(card.key))
                if (!entity) return null
                return page.side === 'back' ? (
                  <CardBack key={card.key} placed={card} />
                ) : (
                  <PrintCard
                    key={card.key}
                    entity={entity}
                    placed={card}
                    grid={grid}
                    simple={simpleIds.has(entity.id)}
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

/** Built once: it depends on nothing but the constants. */
const CARD_FONT_CSS = cardFontCss()

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

/**
 * The points of a star polygon `{points/step}` inscribed at radius `r` about
 * the centre of a 100-unit box, first point straight up. `{7/3}` is the
 * heptagram: seven points, each joined to the one three along.
 */
function starPath(points: number, step: number, r: number): string {
  const at = (k: number) => {
    const a = ((-90 + (k * 360) / points) * Math.PI) / 180
    return `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`
  }
  const order = Array.from({ length: points }, (_, i) => (i * step) % points)
  return `M${order.map(at).join(' L')} Z`
}

const HEPTAGRAM = starPath(7, 3, 33)

/**
 * The first eight runes of the Elder Futhark, drawn about their own centre in
 * a box roughly 3 units wide and 5 tall — fehu, uruz, thurisaz, ansuz, raido,
 * kenaz, gebo, wunjo.
 *
 * Paths, not characters. A rune in a font only prints if the machine doing
 * the printing has a font with runes in it; a stroke prints everywhere.
 */
const RUNES = [
  'M0 -2.5V2.5M0 -2.5L1.8 -1.2M0 -0.6L1.8 0.7',
  'M-1.1 2.5V-2.5L1.1 -1V2.5',
  'M-0.7 -2.5V2.5M-0.7 -1.3L1.1 0L-0.7 1.3',
  'M-0.9 -2.5V2.5M-0.9 -2.5L1.1 -1.3M-0.9 -1L1.1 0.2',
  'M-0.9 2.5V-2.5L1 -1.3L-0.9 -0.1L1 2.5',
  'M0.9 -2.5L-0.9 0L0.9 2.5',
  'M-1.2 -2.5L1.2 2.5M1.2 -2.5L-1.2 2.5',
  'M-0.9 2.5V-2.5L1 -1.3L-0.9 0',
]

/** The band between the two outer rings, where the runes sit. */
const RUNE_RADIUS = 43

/**
 * The card back's emblem: a magic circle.
 *
 * Two rings hold a band of runes, a heptagram sits inside them, and a small
 * ring marks the centre where the star's lines cross. Drawn outward from the
 * middle and entirely in the viewBox, so it holds up at any card size and has
 * no edge for a misaligned duplex print to show.
 */
function Sigil() {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/*
        A white disc behind the whole emblem, so the weave stops at its edge
        instead of running through the runes. An SVG fill is foreground paint,
        so it prints even with background graphics turned off.
      */}
      <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="none" />

      <circle cx="50" cy="50" r="47.5" strokeWidth="1.1" />
      <circle cx="50" cy="50" r="38.5" strokeWidth="0.6" />

      {/* Runes around the band, each turned to face outward. */}
      {RUNES.map((d, i) => (
        <g key={i} transform={`rotate(${i * 45} 50 50)`}>
          <path d={d} transform={`translate(50 ${50 - RUNE_RADIUS})`} strokeWidth="0.55" />
        </g>
      ))}

      {/* A small dot between each pair of runes, so the band reads as one ring. */}
      {RUNES.map((_, i) => (
        <circle
          key={i}
          cx="50"
          cy={50 - RUNE_RADIUS}
          r="0.55"
          fill="currentColor"
          stroke="none"
          transform={`rotate(${i * 45 + 22.5} 50 50)`}
        />
      ))}

      <path d={HEPTAGRAM} strokeWidth="0.7" />
      <circle cx="50" cy="50" r="33" strokeWidth="0.35" />
      <circle cx="50" cy="50" r="7" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Where a card sits on its sheet, as inline grid placement. */
function placement(placed: Placed): React.CSSProperties {
  return {
    gridColumn: `${placed.col} / span ${placed.w}`,
    gridRow: `${placed.row} / span ${placed.h}`,
  }
}

/**
 * The common back. One design for every card, whatever is on the front —
 * a deck you can shuffle face down should not leak what it is hiding.
 *
 * Drawn as strokes rather than fills. A printer drops background paint unless
 * asked, and even when asked, a solid block shows every millimetre of the
 * front-to-back drift that consumer duplex produces as a matter of course.
 * A centred emblem over a fading weave hides it instead.
 */
function CardBack({ placed }: { placed: Placed }) {
  return (
    <article className="print-card print-card-back" style={placement(placed)}>
      <div className="print-card-back-field" aria-hidden />

      <div className="print-card-back-mark">
        <Sigil />
      </div>
    </article>
  )
}

function PrintCard({
  entity,
  placed,
  grid,
  simple,
  bodyMd,
}: {
  entity: EntitySummary
  placed: Placed
  grid: Grid
  /** Thumbnail beside the name instead of the art band. */
  simple: boolean
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
    specRowBudget(grid, placed.h, simple),
  )

  const ingredients =
    entity.type === 'recipe' ? ((entity.data as RecipeData).ingredients ?? []) : []

  const budget = excerptBudget(grid, placed.w, placed.h, {
    specRows: rows.length,
    // A simplified card always has a summary line: it carries the type.
    summary: simple || Boolean(entity.summary),
    simple,
  })

  const html = useMemo(() => {
    if (!bodyMd) return null
    return DOMPurify.sanitize(printMarked.parse(excerptOf(bodyMd, budget)) as string)
  }, [bodyMd, budget])

  const proseRef = useRef<HTMLDivElement>(null)

  /*
    A table either fits on the card or is left out — never sliced by the
    card's bottom edge. The character budget cannot judge this: a table row
    costs a full line however few characters it holds, so a short table can
    still be far too tall. So it is measured, after layout, and any table that
    runs past the bottom is hidden along with every table after it, leaving an
    ellipsis where it stood.

    Measured again once the webfonts land, because they change line heights.
    The DOM is edited in place rather than through state: the prose is set as
    innerHTML, which React leaves alone while the string is unchanged, and
    re-rendering to hide a table would change the very layout being measured.
  */
  useLayoutEffect(() => {
    const prose = proseRef.current
    const body = prose?.parentElement
    if (!prose || !body) return

    const fit = () => {
      const tables = [...prose.querySelectorAll('table')]
      if (tables.length === 0) return

      // Start from everything shown, so a re-measure can bring one back.
      prose.querySelector('.print-card-more')?.remove()
      for (const table of tables) table.style.display = ''

      // A pixel of clearance, so a table that only just fits on screen does
      // not tip over the edge once print re-lays it out at full size.
      const limit = body.getBoundingClientRect().bottom - 1
      const first = tables.findIndex((t) => t.getBoundingClientRect().bottom > limit)
      if (first < 0) return

      for (const table of tables.slice(first)) table.style.display = 'none'
      const more = document.createElement('p')
      more.className = 'print-card-more'
      more.textContent = '…'
      tables[first]?.before(more)
    }

    fit()
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) fit()
    })
    return () => {
      live = false
    }
  }, [html])

  // Eager and synchronous, unlike `Portrait`, which is lazy — a card below the
  // fold must still have its art in hand when print fires. Built once and
  // placed in either the band or the thumbnail, so the two cannot disagree
  // about how a broken image is handled.
  const art = src ? (
    <img src={src} alt="" loading="eager" decoding="sync" onError={() => setBroken(true)} />
  ) : null

  const kind = (
    <div className="print-card-kind">
      <Icon aria-hidden />
      {template.label}
    </div>
  )

  return (
    <article
      className={cx('print-card', simple && 'print-card-simple')}
      // Explicit placement from the packer. Auto-flow is left alone on
      // purpose: `dense` would be a no-op here and would hide a lost
      // placement instead of letting it show up in the preview.
      style={placement(placed)}
    >
      {!simple && (
        <div className="print-card-art">
          {art ?? (
            // The band already centres its child, so this only stacks the two.
            <div className="print-card-fallback flex flex-col items-center gap-1 text-ink-muted">
              <Icon aria-hidden />
              <span className="text-[0.85em] tracking-[0.14em] uppercase">
                {template.portraitWord}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="print-card-body">
        <div className="flex flex-col">
          {/* The name sits directly under the art, with the type beside it.
              Type only: a handout is always going to a player, so what the
              party is allowed to know is not a question the card answers.
              The icon carries it — a bare grey word made every card in a
              stack look identical from across the table. */}
          <div className="print-card-head">
            {simple && (
              // The thumbnail. With no art it shows the type's icon, so a
              // simplified card never has a hole where a picture should be.
              <div className="print-card-thumb">{art ?? <Icon aria-hidden />}</div>
            )}
            {/* The badge floats right, and a float only shapes the text that
                comes after it — so it has to precede the name for the name's
                first line to wrap round it.

                A simplified card has none: its title row already holds the
                portrait, and a badge squeezed in beside both left the name a
                sliver. The type moves down into the summary line instead. */}
            {!simple && kind}
            <h2 className={cx('print-card-name', entity.name.length > 28 && 'is-long')}>
              {entity.name}
            </h2>
          </div>
          <div className="print-card-crest" aria-hidden />
        </div>

        {simple ? (
          /*
            The type leads the summary. This line always renders on a
            simplified card, summary or not, because it is now the only place
            the type appears. The summary text is its own span so the smallest
            cards can drop it and still keep the type — see the container
            query that trims summaries.
          */
          <p className="print-card-meta m-0 line-clamp-3 text-[1.02em] leading-[1.32] text-ink-dim">
            <span className="print-card-meta-kind">{template.label}</span>
            {entity.summary && (
              <span className="print-card-summary">
                <span className="print-card-meta-sep" aria-hidden>
                  {' · '}
                </span>
                {plainValue(entity.summary)}
              </span>
            )}
          </p>
        ) : (
          entity.summary && (
            <p className="print-card-summary m-0 line-clamp-3 text-[1.02em] leading-[1.32] text-ink-dim">
              {plainValue(entity.summary)}
            </p>
          )
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
          <div
            ref={proseRef}
            className="print-card-prose md"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </article>
  )
}
