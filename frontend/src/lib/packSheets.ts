/**
 * Laying cards onto printed sheets, and the query string that describes them.
 *
 * Pure and free of React, so the packing rules can be unit tested rather than
 * eyeballed in a print preview — which is the only other way to find out that a
 * card landed on top of another one.
 */

/** Columns a sheet may be divided into. */
export const COLUMN_CHOICES = [2, 3, 4] as const
/** Rows a sheet may be divided into. */
export const ROW_CHOICES = [2, 3, 4, 5, 6] as const

/** What the sheet was before it was configurable, and what a bare link means. */
export const DEFAULT_GRID: Grid = { cols: 2, rows: 3 }

/**
 * The most cards one sheet request may produce.
 *
 * A 4x6 grid is 24 cards a sheet, and a count of 99 on a handful of entries
 * runs into the hundreds. Every card holds an image and a sanitised body, so
 * the preview would lock up long before the paper ran out. The cap is generous
 * — 20 full sheets at the densest grid — and the toolbar says when it bites.
 */
export const MAX_CARDS = 480

/** The largest count one entry may carry. */
export const MAX_COUNT = 99

export interface Grid {
  cols: number
  rows: number
}

/** A chosen entry: which one, how big a block it takes, and how many copies. */
export interface Pick {
  id: string
  /** Columns spanned. Clamped to the grid at pack time. */
  w: number
  /** Rows spanned. Clamped to the grid at pack time. */
  h: number
  /** Copies to print. */
  n: number
}

export interface Card {
  key: string
  w: number
  h: number
}

/** A card with its place on the sheet. Both are 1-based, as CSS grid counts. */
export interface Placed extends Card {
  col: number
  row: number
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return Math.min(Math.max(Math.trunc(value), low), high)
}

/**
 * Turn picks into the flat list of cards that actually get printed.
 *
 * Copies are expanded here rather than inside the packer, so the packer stays a
 * function of a plain list and its tests do not have to know about counts.
 * Keys carry the copy index because React needs them distinct and because the
 * same entry can legitimately appear many times.
 */
export function expandPicks(picks: Pick[], limit = MAX_CARDS): Card[] {
  const cards: Card[] = []

  for (const pick of picks) {
    const copies = clamp(pick.n, 1, MAX_COUNT)
    for (let i = 0; i < copies; i++) {
      if (cards.length >= limit) return cards
      cards.push({ key: `${pick.id}#${i}`, w: pick.w, h: pick.h })
    }
  }

  return cards
}

/**
 * Lay cards onto sheets, filling holes as it goes.
 *
 * Each card takes the first free block that fits, scanning row-major from the
 * top of the current sheet — so a small card slots into a gap a bigger one left
 * behind rather than queueing after it. The cards are cut apart anyway, so
 * wasted paper matters more than keeping them in the order they were picked.
 *
 * Spans are clamped to the grid on the way in. That is what makes "this card
 * fits nowhere" unreachable: a clamped card always fits an empty sheet, so
 * opening a new one is guaranteed to succeed and there is no retry loop to run
 * away.
 */
export function packSheets(cards: Card[], cols: number, rows: number): Placed[][] {
  const width = clamp(cols, 1, 64)
  const height = clamp(rows, 1, 64)

  const sheets: Placed[][] = []
  // Occupancy is flat rather than an array of rows: one bounds-checked index
  // instead of two, which keeps the inner loop honest under strict indexing.
  let taken = new Uint8Array(0)
  let sheet: Placed[] = []

  const openSheet = () => {
    taken = new Uint8Array(width * height)
    sheet = []
    sheets.push(sheet)
  }

  const free = (row: number, col: number, w: number, h: number): boolean => {
    if (row + h > height || col + w > width) return false
    for (let y = row; y < row + h; y++) {
      for (let x = col; x < col + w; x++) {
        if (taken[y * width + x]) return false
      }
    }
    return true
  }

  const place = (card: Card, w: number, h: number): boolean => {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (!free(row, col, w, h)) continue
        for (let y = row; y < row + h; y++) {
          for (let x = col; x < col + w; x++) taken[y * width + x] = 1
        }
        sheet.push({ key: card.key, w, h, col: col + 1, row: row + 1 })
        return true
      }
    }
    return false
  }

  for (const card of cards) {
    const w = clamp(card.w, 1, width)
    const h = clamp(card.h, 1, height)
    if (sheets.length === 0) openSheet()
    if (!place(card, w, h)) {
      openSheet()
      // Cannot fail: the span is clamped to the grid and the sheet is empty.
      place(card, w, h)
    }
  }

  return sheets
}

/* ── how big a card actually is ───────────────────────────────────── */

/*
 * The printable area inside the sheet's 8mm padding, and the gutter between
 * cells. These mirror `.print-sheet` in styles.css; if that changes, so must
 * this. They live here because how much text a card can hold is a function of
 * how big the card is, and that is arithmetic, not styling.
 */
const PAGE_MM = { w: 194, h: 280 }
const GAP_MM = 4
const PX_PER_MM = 96 / 25.4

/** The size in millimetres of a card spanning `w` by `h` cells of `grid`. */
export function cardSizeMm(grid: Grid, w: number, h: number): { w: number; h: number } {
  const cols = Math.max(1, grid.cols)
  const rows = Math.max(1, grid.rows)
  const spanW = clamp(w, 1, cols)
  const spanH = clamp(h, 1, rows)

  const cellW = (PAGE_MM.w - (cols - 1) * GAP_MM) / cols
  const cellH = (PAGE_MM.h - (rows - 1) * GAP_MM) / rows

  return {
    w: cellW * spanW + GAP_MM * (spanW - 1),
    h: cellH * spanH + GAP_MM * (spanH - 1),
  }
}

/**
 * The card's text scale, in pixels.
 *
 * Mirrors the `clamp(5.5px, calc(1.9px + 2.12cqw), 9.5px)` on the card's
 * children, because the number of characters that fit depends on it. Two
 * copies of one curve is a real cost, so the CSS names this function.
 */
export function cardFontPx(widthMm: number): number {
  return Math.min(9.5, Math.max(5.5, 1.9 + 0.0212 * widthMm * PX_PER_MM))
}

/** Card width below which the art band shrinks. Mirrors the container query. */
const NARROW_MM = 50

/**
 * Roughly how many characters of prose a card has room for.
 *
 * This replaces a flat 420, which was the whole reason a bigger card showed no
 * more text: the excerpt was cut to the same length whatever the card, so
 * expanding one only added white space under the same ellipsis.
 *
 * It is an estimate, not a measurement — the real answer depends on where the
 * words wrap. It is deliberately a little generous, because running slightly
 * over is invisible (the card clips) while running under is the bug being
 * fixed here. The CSS `overflow: hidden` remains the backstop.
 */
export function excerptBudget(
  grid: Grid,
  w: number,
  h: number,
  { specRows = 0, summary = false }: { specRows?: number; summary?: boolean } = {},
): number {
  const size = cardSizeMm(grid, w, h)
  const fontMm = cardFontPx(size.w) / PX_PER_MM

  // Everything above the prose: the art band, the body padding, the name and
  // type lines, an optional summary, and the spec table.
  const artMm = size.h * (size.w <= NARROW_MM ? 0.24 : 0.38)
  const headerMm = fontMm * (2.6 + specRows * 1.1 + (summary ? 2.6 : 0))
  const proseMm = size.h - artMm - 6 - headerMm
  if (proseMm <= 0) return 0

  // An average glyph is about half an em wide; lines are 1.38em apart.
  const perLine = Math.max(1, (size.w - 6) / (fontMm * 0.5))
  const lines = proseMm / (fontMm * 1.38)

  return Math.round(perLine * lines)
}

/**
 * How many spec rows to render.
 *
 * Also a function of height for the same reason: a tall card that stopped at
 * eight rows was throwing away fields it had room for. The CSS trims further
 * on a card too short for even this.
 */
export function specRowBudget(grid: Grid, h: number): number {
  const size = cardSizeMm(grid, 1, h)
  return clamp(Math.round(size.h / 11), 3, 16)
}

/* ── the query string ─────────────────────────────────────────────── */

/**
 * `grid=CxR`. Anything unrecognised falls back to the default rather than
 * erroring, the same way `CodexPage` guards its own params — a hand-edited or
 * stale link should still show you a sheet.
 */
export function parseGrid(raw: string | null): Grid {
  const match = /^(\d+)x(\d+)$/.exec((raw ?? '').trim())
  if (!match) return DEFAULT_GRID

  const cols = Number(match[1])
  const rows = Number(match[2])
  if (!COLUMN_CHOICES.includes(cols as 2) || !ROW_CHOICES.includes(rows as 2)) {
    return DEFAULT_GRID
  }
  return { cols, rows }
}

export function formatGrid(grid: Grid): string {
  return `${grid.cols}x${grid.rows}`
}

/**
 * `ids=abc:2x2*3,def,ghi:1x2`.
 *
 * The span and the count are both optional and both omitted at their defaults,
 * so the common case stays the plain comma-separated list of ids it has always
 * been, and a link written before this existed still opens.
 *
 * An id appearing twice is merged rather than repeated: two entries for the
 * same thing would be two rows in the Selected panel saying different things
 * about one card.
 */
export function parsePicks(raw: string | null): Pick[] {
  if (!raw) return []

  const byId = new Map<string, Pick>()

  for (const token of raw.split(',')) {
    const match = /^([^:*]+)(?::(\d+)x(\d+))?(?:\*(\d+))?$/.exec(token.trim())
    if (!match) continue

    const id = match[1]
    if (!id) continue

    const pick: Pick = {
      id,
      w: match[2] ? clamp(Number(match[2]), 1, 4) : 1,
      h: match[3] ? clamp(Number(match[3]), 1, 6) : 1,
      n: match[4] ? clamp(Number(match[4]), 1, MAX_COUNT) : 1,
    }

    const existing = byId.get(id)
    if (existing) {
      // Same entry twice in one link: keep the larger block and add the copies.
      existing.w = Math.max(existing.w, pick.w)
      existing.h = Math.max(existing.h, pick.h)
      existing.n = clamp(existing.n + pick.n, 1, MAX_COUNT)
    } else {
      byId.set(id, pick)
    }
  }

  return [...byId.values()]
}

export function formatPicks(picks: Pick[]): string {
  return picks
    .map(({ id, w, h, n }) => {
      const span = w === 1 && h === 1 ? '' : `:${w}x${h}`
      const count = n === 1 ? '' : `*${n}`
      return `${id}${span}${count}`
    })
    .join(',')
}
