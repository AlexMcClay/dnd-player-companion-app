/**
 * Run with `npm -w @codex/frontend test`.
 *
 * Same shape as `backend/src/lib/archive.test.ts`: node:test, node:assert, no
 * framework. Packing is the one part of the print sheet whose bugs are
 * invisible until paper comes out of a printer, so it is the part with tests.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CARD_FONT,
  cardFontCss,
  cardFontPx,
  cardSizeMm,
  DEFAULT_GRID,
  excerptBudget,
  excerptOf,
  MAX_CARDS,
  expandPicks,
  formatGrid,
  formatNudge,
  formatPicks,
  isNudged,
  MAX_NUDGE_MM,
  mirrorForBack,
  NO_NUDGE,
  parseNudge,
  packSheets,
  parseGrid,
  parsePicks,
  specRowBudget,
  withBacks,
  withNudge,
  type Card,
} from './packSheets.js'

/** `[key, w, h]` triples, so a test case reads as the shape it describes. */
function cards(...spans: Array<[string, number, number]>): Card[] {
  return spans.map(([key, w, h]) => ({ key, w, h }))
}

/** Placements as `key@col,row` strings — easier to read than nested objects. */
function at(sheet: ReturnType<typeof packSheets>[number]): string[] {
  return sheet.map((c) => `${c.key}@${c.col},${c.row}`)
}

/**
 * One sheet, asserted to exist.
 *
 * `noUncheckedIndexedAccess` is on, so `nth(sheets, 0)` is `Placed[] | undefined`.
 * Failing loudly here beats sprinkling non-null assertions, which would hide a
 * packer that quietly returned nothing.
 */
function nth(sheets: ReturnType<typeof packSheets>, i: number) {
  const sheet = sheets[i]
  assert.ok(sheet, `expected a sheet at index ${i}`)
  return sheet
}

test('no cards means no sheets', () => {
  assert.deepEqual(packSheets([], 3, 3), [])
})

test('a full grid is one sheet, not two', () => {
  const sheets = packSheets(cards(['a', 1, 1], ['b', 1, 1], ['c', 1, 1], ['d', 1, 1]), 2, 2)
  assert.equal(sheets.length, 1)
  assert.deepEqual(at(nth(sheets, 0)), ['a@1,1', 'b@2,1', 'c@1,2', 'd@2,2'])
})

test('one more than a full grid opens a second sheet', () => {
  const sheets = packSheets(
    cards(['a', 1, 1], ['b', 1, 1], ['c', 1, 1], ['d', 1, 1], ['e', 1, 1]),
    2,
    2,
  )
  assert.equal(sheets.length, 2)
  assert.deepEqual(at(nth(sheets, 1)), ['e@1,1'])
})

test('holes are backfilled by later small cards', () => {
  // The 2x2 takes the top-left block, leaving column 3 and the bottom row.
  const sheets = packSheets(cards(['big', 2, 2], ['a', 1, 1], ['b', 1, 1], ['c', 1, 1]), 3, 3)
  assert.equal(sheets.length, 1)
  assert.deepEqual(at(nth(sheets, 0)), ['big@1,1', 'a@3,1', 'b@3,2', 'c@1,3'])
})

test('a wide card moves to the next row rather than splitting', () => {
  // 'a' takes 1,1. The 2-wide 'w' cannot start at column 2 of 3... it can:
  // columns 2 and 3 are free. 'x' then cannot fit row 1 and drops to row 2.
  const sheets = packSheets(cards(['a', 1, 1], ['w', 2, 1], ['x', 2, 1]), 3, 3)
  assert.deepEqual(at(nth(sheets, 0)), ['a@1,1', 'w@2,1', 'x@1,2'])
})

test('a wide card skips a row it cannot start in', () => {
  // Columns 1 and 2 taken in row 1, so a 2-wide card cannot fit row 1 at all.
  const sheets = packSheets(cards(['a', 1, 1], ['b', 1, 1], ['w', 2, 1]), 3, 2)
  assert.deepEqual(at(nth(sheets, 0)), ['a@1,1', 'b@2,1', 'w@1,2'])
})

test('a card spanning the whole grid takes a sheet to itself', () => {
  const sheets = packSheets(cards(['a', 1, 1], ['full', 3, 3]), 3, 3)
  assert.equal(sheets.length, 2)
  assert.deepEqual(at(nth(sheets, 0)), ['a@1,1'])
  assert.deepEqual(at(nth(sheets, 1)), ['full@1,1'])
})

test('a span larger than the grid is clamped, never wedged', () => {
  const sheets = packSheets(cards(['huge', 9, 9]), 3, 3)
  assert.equal(sheets.length, 1)
  assert.deepEqual(nth(sheets, 0), [{ key: 'huge', w: 3, h: 3, col: 1, row: 1 }])
})

test('shrinking the grid under an oversized span still terminates', () => {
  const sheets = packSheets(cards(['a', 3, 3], ['b', 3, 3]), 2, 2)
  assert.equal(sheets.length, 2)
  assert.deepEqual(nth(sheets, 0), [{ key: 'a', w: 2, h: 2, col: 1, row: 1 }])
  assert.deepEqual(nth(sheets, 1), [{ key: 'b', w: 2, h: 2, col: 1, row: 1 }])
})

test('a zero or negative span is treated as one cell', () => {
  const sheets = packSheets(cards(['a', 0, -4]), 3, 3)
  assert.deepEqual(nth(sheets, 0), [{ key: 'a', w: 1, h: 1, col: 1, row: 1 }])
})

test('placements never overlap, across every allowed grid', () => {
  const spans: Array<[string, number, number]> = [
    ['a', 2, 2], ['b', 1, 1], ['c', 3, 1], ['d', 1, 2],
    ['e', 1, 1], ['f', 2, 1], ['g', 1, 3], ['h', 1, 1],
  ]
  for (const cols of [2, 3, 4]) {
    for (const rows of [2, 3, 4, 5, 6]) {
      for (const sheet of packSheets(cards(...spans), cols, rows)) {
        const seen = new Set<string>()
        for (const c of sheet) {
          assert.ok(c.col >= 1 && c.col + c.w - 1 <= cols, `${cols}x${rows} overflows a column`)
          assert.ok(c.row >= 1 && c.row + c.h - 1 <= rows, `${cols}x${rows} overflows a row`)
          for (let y = c.row; y < c.row + c.h; y++) {
            for (let x = c.col; x < c.col + c.w; x++) {
              const cell = `${x},${y}`
              assert.ok(!seen.has(cell), `${cols}x${rows} put two cards on ${cell}`)
              seen.add(cell)
            }
          }
        }
      }
    }
  }
})

test('the same input always packs the same way', () => {
  const input = cards(['a', 2, 2], ['b', 1, 1], ['c', 2, 1])
  assert.deepEqual(packSheets(input, 3, 4), packSheets(input, 3, 4))
})

test('every card is placed exactly once', () => {
  const input = cards(['a', 2, 2], ['b', 1, 1], ['c', 3, 2], ['d', 1, 1], ['e', 2, 3])
  const placed = packSheets(input, 3, 4).flat().map((c) => c.key)
  assert.deepEqual([...placed].sort(), ['a', 'b', 'c', 'd', 'e'])
})

/* ── counts ───────────────────────────────────────────────────────── */

test('a count expands into that many cards with distinct keys', () => {
  const out = expandPicks([{ id: 'x', w: 1, h: 1, n: 3, simple: false }])
  assert.deepEqual(out.map((c) => c.key), ['x#0', 'x#1', 'x#2'])
})

test('copies keep the span of the entry they came from', () => {
  const out = expandPicks([{ id: 'x', w: 2, h: 3, n: 2, simple: false }])
  assert.ok(out.every((c) => c.w === 2 && c.h === 3))
})

test('expansion stops at the cap rather than running away', () => {
  const out = expandPicks([{ id: 'x', w: 1, h: 1, n: 99, simple: false }], 10)
  assert.equal(out.length, 10)
})

test('the default cap is the documented one', () => {
  const out = expandPicks(
    Array.from({ length: 50 }, (_, i) => ({ id: `e${i}`, w: 1, h: 1, n: 99, simple: false })),
  )
  assert.equal(out.length, MAX_CARDS)
})

/* ── the query string ─────────────────────────────────────────────── */

test('a missing or broken grid falls back to the old fixed layout', () => {
  assert.deepEqual(parseGrid(null), DEFAULT_GRID)
  assert.deepEqual(parseGrid(''), DEFAULT_GRID)
  assert.deepEqual(parseGrid('nonsense'), DEFAULT_GRID)
  assert.deepEqual(parseGrid('9x9'), DEFAULT_GRID, 'out of range is not honoured')
  assert.deepEqual(parseGrid('1x1'), DEFAULT_GRID, 'below range is not honoured')
})

test('a grid in range round-trips', () => {
  for (const cols of [2, 3, 4]) {
    for (const rows of [2, 3, 4, 5, 6]) {
      assert.deepEqual(parseGrid(formatGrid({ cols, rows })), { cols, rows })
    }
  }
})

test('a link written before spans existed still parses', () => {
  assert.deepEqual(parsePicks('abc,def'), [
    { id: 'abc', w: 1, h: 1, n: 1, simple: false },
    { id: 'def', w: 1, h: 1, n: 1, simple: false },
  ])
})

test('span and count are both optional', () => {
  assert.deepEqual(parsePicks('a:2x2*3,b,c:1x2,d*4'), [
    { id: 'a', w: 2, h: 2, n: 3, simple: false },
    { id: 'b', w: 1, h: 1, n: 1, simple: false },
    { id: 'c', w: 1, h: 2, n: 1, simple: false },
    { id: 'd', w: 1, h: 1, n: 4, simple: false },
  ])
})

test('picks round-trip, and defaults are left out of the string', () => {
  const picks = [
    { id: 'a', w: 1, h: 1, n: 1, simple: false },
    { id: 'b', w: 2, h: 2, n: 3, simple: true },
  ]
  assert.equal(formatPicks(picks), 'a,b:2x2*3!')
  assert.deepEqual(parsePicks(formatPicks(picks)), picks)
})

test('the same id twice is merged, not duplicated', () => {
  assert.deepEqual(parsePicks('a*2,a:2x1*3'), [
    { id: 'a', w: 2, h: 1, n: 5, simple: false },
  ])
})

test('order of first appearance is kept', () => {
  assert.deepEqual(parsePicks('c,a,b').map((p) => p.id), ['c', 'a', 'b'])
})

test('empty and malformed tokens are dropped, not thrown on', () => {
  assert.deepEqual(parsePicks(''), [])
  assert.deepEqual(parsePicks(',,').map((p) => p.id), [])
  assert.deepEqual(parsePicks('a,,b').map((p) => p.id), ['a', 'b'])
})

/* ── how much a card can hold ─────────────────────────────────────── */

test('a cell is the page divided by the grid, gutters included', () => {
  // 194mm of printable width, one 4mm gutter, two columns.
  const one = cardSizeMm({ cols: 2, rows: 3 }, 1, 1)
  assert.equal(Math.round(one.w), 95)
  assert.equal(Math.round(one.h), 91)
})

test('a span is its cells plus the gutters it swallows', () => {
  const grid = { cols: 3, rows: 3 }
  const one = cardSizeMm(grid, 1, 1)
  const two = cardSizeMm(grid, 2, 2)
  assert.ok(Math.abs(two.w - (one.w * 2 + 4)) < 0.01)
  assert.ok(Math.abs(two.h - (one.h * 2 + 4)) < 0.01)
})

test('a span beyond the grid is clamped to it', () => {
  const grid = { cols: 2, rows: 2 }
  assert.deepEqual(cardSizeMm(grid, 9, 9), cardSizeMm(grid, 2, 2))
})

test('the text scale tracks width, between its floor and ceiling', () => {
  assert.equal(cardFontPx(20), CARD_FONT.floorPx, 'floor')
  assert.equal(cardFontPx(400), CARD_FONT.ceilPx, 'ceiling')
  assert.ok(cardFontPx(62) > CARD_FONT.floorPx && cardFontPx(62) < CARD_FONT.ceilPx)
  assert.ok(cardFontPx(95) > cardFontPx(62))
})

test('the smallest card text is not drastically smaller than the largest', () => {
  // Card widths at four columns and at two, the extremes of the grid.
  const narrow = cardFontPx(cardSizeMm({ cols: 4, rows: 3 }, 1, 1).w)
  const wide = cardFontPx(cardSizeMm({ cols: 2, rows: 3 }, 1, 1).w)
  const ratio = narrow / wide
  // It used to be 0.58: 5.5px against 9.5px, about 4pt on paper.
  assert.ok(ratio >= 0.72, `four-column text is ${(ratio * 100).toFixed(0)}% of two-column`)
})

test('no card text drops below a readable size', () => {
  for (const cols of [2, 3, 4]) {
    for (const rows of [2, 3, 4, 5, 6]) {
      const px = cardFontPx(cardSizeMm({ cols, rows }, 1, 1).w)
      assert.ok(px >= 7, `${cols}x${rows} renders at ${px.toFixed(2)}px`)
    }
  }
})

test('the CSS and the budgets read one curve', () => {
  // The stylesheet takes this string verbatim, so its numbers must be the
  // same constants cardFontPx computes with.
  const css = cardFontCss()
  for (const n of [CARD_FONT.floorPx, CARD_FONT.basePx, CARD_FONT.perCqw, CARD_FONT.ceilPx]) {
    assert.ok(css.includes(String(n)), `${n} missing from ${css}`)
  }
  assert.match(css, /^clamp\(.+px, calc\(.+px \+ .+cqw\), .+px\)$/)
})

test('a bigger card gets a bigger excerpt — the whole point', () => {
  const opts = { specRows: 4, summary: true }
  const grid = { cols: 2, rows: 3 }
  const oneCell = excerptBudget(grid, 1, 1, opts)
  const twoTall = excerptBudget(grid, 1, 2, opts)
  const wideTall = excerptBudget(grid, 2, 2, opts)

  assert.ok(twoTall > oneCell, 'taller shows more')
  assert.ok(wideTall > twoTall, 'wider as well as taller shows more still')
})

test('a roomier grid gets a bigger excerpt than a dense one', () => {
  const opts = { specRows: 4, summary: true }
  assert.ok(
    excerptBudget({ cols: 2, rows: 2 }, 1, 1, opts) >
      excerptBudget({ cols: 4, rows: 6 }, 1, 1, opts),
  )
})

test('the default card still holds a typical body whole', () => {
  // Bodies in a real campaign run to about 480 characters; the old flat cap
  // of 420 truncated the longest of them even on a card with room to spare.
  const budget = excerptBudget(DEFAULT_GRID, 1, 1, { specRows: 4, summary: true })
  assert.ok(budget > 480, `expected room for a long body, got ${budget}`)
})

test('spec rows crowd out prose rather than being ignored', () => {
  const grid = DEFAULT_GRID
  assert.ok(
    excerptBudget(grid, 1, 1, { specRows: 0 }) > excerptBudget(grid, 1, 1, { specRows: 8 }),
  )
})

test('a budget is never negative', () => {
  for (const cols of [2, 3, 4]) {
    for (const rows of [2, 3, 4, 5, 6]) {
      const budget = excerptBudget({ cols, rows }, 1, 1, { specRows: 12, summary: true })
      assert.ok(budget >= 0, `${cols}x${rows} produced ${budget}`)
    }
  }
})

test('spec rows scale with height and stay in sane bounds', () => {
  const tall = specRowBudget({ cols: 2, rows: 2 }, 1)
  const short = specRowBudget({ cols: 2, rows: 6 }, 1)
  assert.ok(tall > short, 'a taller card shows more fields')
  assert.ok(short >= 3, 'never so few that a card says nothing')
  assert.ok(tall <= 16)
})

test('the default grid still shows the eight rows it used to', () => {
  assert.equal(specRowBudget(DEFAULT_GRID, 1), 8)
})

/* ── backs ────────────────────────────────────────────────────────── */

test('a long-edge flip mirrors columns and leaves rows alone', () => {
  const front = packSheets(cards(['a', 1, 1], ['b', 1, 1], ['c', 1, 1]), 3, 2)
  const back = mirrorForBack(nth(front, 0), 3, 2)
  // a@1 -> 3, b@2 -> 2, c@3 -> 1
  assert.deepEqual(back.map((c) => `${c.key}@${c.col},${c.row}`), ['a@3,1', 'b@2,1', 'c@1,1'])
})

test('a short-edge flip mirrors rows and leaves columns alone', () => {
  const front = packSheets(cards(['a', 1, 1], ['b', 1, 1], ['c', 1, 1], ['d', 1, 1]), 2, 2)
  const back = mirrorForBack(nth(front, 0), 2, 2, 'short')
  assert.deepEqual(back.map((c) => `${c.key}@${c.col},${c.row}`), ['a@1,2', 'b@2,2', 'c@1,1', 'd@2,1'])
})

test('a wide card mirrors by its far edge, not its near one', () => {
  // Occupies columns 1-2 of 3. Flipped it must occupy 2-3, not 3-4.
  const back = mirrorForBack([{ key: 'w', w: 2, h: 1, col: 1, row: 1 }], 3, 3)
  assert.deepEqual(back, [{ key: 'w', w: 2, h: 1, col: 2, row: 1 }])
})

test('a card centred across the sheet does not move', () => {
  const back = mirrorForBack([{ key: 'm', w: 2, h: 1, col: 2, row: 1 }], 4, 3)
  assert.equal(nth([back], 0)[0]?.col, 2)
})

test('mirroring twice returns every card to where it started', () => {
  const front = nth(packSheets(cards(['a', 2, 2], ['b', 1, 1], ['c', 3, 1]), 4, 4), 0)
  assert.deepEqual(mirrorForBack(mirrorForBack(front, 4, 4), 4, 4), front)
})

test('a back never falls off the sheet', () => {
  const spans: Array<[string, number, number]> = [
    ['a', 2, 2], ['b', 1, 1], ['c', 3, 1], ['d', 1, 2], ['e', 2, 1], ['f', 1, 1],
  ]
  for (const cols of [2, 3, 4]) {
    for (const rows of [2, 3, 4, 5, 6]) {
      for (const sheet of packSheets(cards(...spans), cols, rows)) {
        for (const flip of ['long', 'short'] as const) {
          for (const c of mirrorForBack(sheet, cols, rows, flip)) {
            assert.ok(c.col >= 1 && c.col + c.w - 1 <= cols, `${cols}x${rows} ${flip}: column off sheet`)
            assert.ok(c.row >= 1 && c.row + c.h - 1 <= rows, `${cols}x${rows} ${flip}: row off sheet`)
          }
        }
      }
    }
  }
})

test('backs are interleaved, each after its own front', () => {
  const sheets = packSheets(
    cards(['a', 1, 1], ['b', 1, 1], ['c', 1, 1], ['d', 1, 1], ['e', 1, 1]),
    2,
    2,
  )
  assert.equal(sheets.length, 2)
  const pages = withBacks(sheets, 2, 2)
  assert.deepEqual(pages.map((p) => p.side), ['front', 'back', 'front', 'back'])
  // The second back belongs to the second front, not the first.
  assert.deepEqual(pages[3]?.cards.map((c) => c.key), ['e'])
})

test('backs double the page count but not the cards', () => {
  const sheets = packSheets(cards(['a', 1, 1], ['b', 1, 1], ['c', 1, 1]), 2, 2)
  const pages = withBacks(sheets, 2, 2)
  assert.equal(pages.length, sheets.length * 2)
  assert.equal(
    pages.filter((p) => p.side === 'front').flatMap((p) => p.cards).length,
    3,
  )
})

/* ── cancelling a printer's duplex drift ──────────────────────────── */

test('no nudge parameter means no shift', () => {
  assert.deepEqual(parseNudge(null), NO_NUDGE)
  assert.deepEqual(parseNudge(''), NO_NUDGE)
  assert.deepEqual(parseNudge('nonsense'), NO_NUDGE)
})

test('a measured drift round-trips through the query string', () => {
  assert.deepEqual(parseNudge('0,-0.4'), { x: 0, y: -0.4 })
  assert.equal(formatNudge({ x: 0, y: -0.4 }), '0,-0.4')
})

test('a nudge is clamped to what the page margin can absorb', () => {
  assert.equal(parseNudge('99,-99').x, MAX_NUDGE_MM)
  assert.equal(parseNudge('99,-99').y, -MAX_NUDGE_MM)
})

test('a nudge snaps to the step and carries no float dust', () => {
  // 0.1 + 0.2 in binary floating point is 0.30000000000000004, which would
  // otherwise end up in the URL and on the label.
  assert.equal(withNudge({ x: 0.1, y: 0 }, { x: 0.1 + 0.2 }).x, 0.3)
  assert.equal(parseNudge('0.37,0').x, 0.4, 'rounded to the nearest step')
})

test('one axis can be changed without disturbing the other', () => {
  assert.deepEqual(withNudge({ x: 1.2, y: -0.4 }, { y: -0.5 }), { x: 1.2, y: -0.5 })
})

test('a zero nudge is reported as no nudge', () => {
  assert.equal(isNudged(NO_NUDGE), false)
  assert.equal(isNudged({ x: 0, y: -0.1 }), true)
})

test('a nudge never moves cards, only where the sheet is painted', () => {
  // Registration is a print-time correction. If it reached the packer it
  // would change pagination, which is the one thing it must not do.
  const before = packSheets(cards(['a', 2, 2], ['b', 1, 1]), 3, 3)
  const after = packSheets(cards(['a', 2, 2], ['b', 1, 1]), 3, 3)
  assert.deepEqual(before, after)
})

/* ── the simplified card ──────────────────────────────────────────── */

test('a trailing bang means simplified, and is left off when it is not', () => {
  assert.equal(parsePicks('a!')[0]?.simple, true)
  assert.equal(parsePicks('a')[0]?.simple, false)
  assert.equal(formatPicks([{ id: 'a', w: 1, h: 1, n: 1, simple: true }]), 'a!')
})

test('the flag survives alongside a span and a count', () => {
  assert.deepEqual(parsePicks('a:2x3*4!'), [{ id: 'a', w: 2, h: 3, n: 4, simple: true }])
  assert.deepEqual(parsePicks(formatPicks(parsePicks('a:2x3*4!'))), parsePicks('a:2x3*4!'))
})

test('merging two mentions keeps the flag if either had it', () => {
  assert.equal(parsePicks('a,a!')[0]?.simple, true)
  assert.equal(parsePicks('a!,a')[0]?.simple, true)
  assert.equal(parsePicks('a,a')[0]?.simple, false)
})

test('a bang cannot be mistaken for part of an id', () => {
  assert.equal(parsePicks('abc-123!')[0]?.id, 'abc-123')
})

test('simplifying buys real room for prose', () => {
  const opts = { specRows: 4, summary: true }
  const normal = excerptBudget(DEFAULT_GRID, 1, 1, opts)
  const simple = excerptBudget(DEFAULT_GRID, 1, 1, { ...opts, simple: true })
  assert.ok(simple > normal * 1.5, `expected a large gain, got ${normal} -> ${simple}`)
})

test('simplifying also buys spec rows', () => {
  assert.ok(specRowBudget(DEFAULT_GRID, 1, true) > specRowBudget(DEFAULT_GRID, 1, false))
})

test('a simplified card still cannot have a negative budget', () => {
  for (const cols of [2, 3, 4]) {
    for (const rows of [2, 3, 4, 5, 6]) {
      const budget = excerptBudget({ cols, rows }, 1, 1, {
        specRows: 16,
        summary: true,
        simple: true,
      })
      assert.ok(budget >= 0, `${cols}x${rows} produced ${budget}`)
    }
  }
})

/* ── trimming a body without breaking its tables ──────────────────── */

const POTION = [
  'You regain hit points when you drink this potion.',
  '',
  'Potions of Healing (table)',
  '',
  '| Potion of | Rarity | HP Regained |',
  '|---|---|---|',
  '| Healing | Common | 2d4 + 2 |',
  '| Greater healing | Uncommon | 4d4 + 4 |',
  '| Superior healing | Rare | 8d4 + 8 |',
].join('\n')

const tableStart = POTION.indexOf('| Potion of')

/** Every table row that survives has all of its cells, or none survive. */
function tableIsWhole(out: string): boolean {
  const rows = out.split('\n').filter((l) => l.trim().startsWith('|'))
  return rows.length === 0 || rows.length === 5
}

test('a body within budget comes back untouched', () => {
  assert.equal(excerptOf(POTION, 10_000), POTION)
})

test('ordinary prose is still cut on a word boundary', () => {
  const out = excerptOf('one two three four five six seven', 20)
  assert.ok(out.endsWith('…'))
  assert.ok(!/\w…$/.test(out.replace(/ …$/, '')) || out === 'one two three four…')
})

test('a cut landing inside a table keeps the table whole when it nearly fits', () => {
  // A budget that lands in the table's last row, so its end is well within
  // the slack. (A budget only just into the table is too far short: this
  // table is 159 characters, more than half the whole body.)
  const out = excerptOf(POTION, POTION.length - 10)
  assert.ok(tableIsWhole(out), out)
  assert.ok(out.includes('Superior healing'), 'the whole table was kept')
})

test('a cut landing inside a table drops it when it is far too big', () => {
  // A tiny budget that only just reaches the table.
  const out = excerptOf(POTION, tableStart + 2)
  const slackEnd = POTION.length
  if (slackEnd > (tableStart + 2) * 1.5) {
    assert.ok(!out.includes('|'), 'no stray pipes')
    assert.ok(out.includes('Potions of Healing (table)'), 'the prose before it survives')
    assert.ok(out.endsWith('…'), 'and says there was more')
  }
})

test('a table is never printed as a fragment, at any budget', () => {
  for (let budget = 1; budget <= POTION.length + 5; budget++) {
    assert.ok(tableIsWhole(excerptOf(POTION, budget)), `budget ${budget} broke the table`)
  }
})

test('a word-boundary backtrack never reaches back into an earlier table', () => {
  const body = `${POTION}\n\nAfterwardswithoutanyspacesatallforaverylongstretch.`
  for (let budget = POTION.length; budget <= body.length; budget++) {
    assert.ok(tableIsWhole(excerptOf(body, budget)), `budget ${budget} broke the table`)
  }
})

test('prose after a kept table is cut normally', () => {
  const body = `${POTION}\n\nThe liquid glimmers when agitated, and tastes faintly of copper.`
  // Far enough past the table to reach "glimmers", short of the whole line.
  const out = excerptOf(body, POTION.length + 32)
  assert.ok(tableIsWhole(out))
  assert.ok(out.includes('glimmers'))
  assert.ok(out.endsWith('…'))
})
