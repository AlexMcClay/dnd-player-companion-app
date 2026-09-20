/**
 * The planner decides what an import does, so these check the decisions rather
 * than the plumbing: what counts as the same entry, what counts as a change,
 * and what has to stop an import before it starts.
 *
 * Run with `npm -w @codex/backend test`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ARCHIVE_FORMAT, ARCHIVE_VERSION, type Archive, type ArchiveEntity } from '@codex/shared'
import type {
  DdbPartySnapshot as PrismaDdbParty,
  DdbSnapshot as PrismaDdbSnapshot,
  Entity as PrismaEntity,
  Holding as PrismaHolding,
  Note as PrismaNote,
} from '@prisma/client'
import { normalizeArchive, planArchive, stableStringify, type DbSnapshot } from './archive.js'

/* ── fixtures ─────────────────────────────────────────────────────── */

const WHEN = new Date('2026-01-01T00:00:00.000Z')

function entity(over: Partial<PrismaEntity> & { id: string; type: string; name: string }) {
  return {
    summary: null,
    bodyMd: null,
    data: {},
    imageKey: null,
    tags: [],
    knowledge: 'known',
    createdAt: WHEN,
    updatedAt: WHEN,
    ...over,
  } as PrismaEntity
}

const ROOK = entity({
  id: '11111111-1111-4111-8111-111111111111',
  type: 'player',
  name: 'Rook',
  data: { level: 4, avatarUrl: 'https://ddb/rook.png' },
})
const DAGGER = entity({
  id: '22222222-2222-4222-8222-222222222222',
  type: 'item',
  name: 'Dagger',
  tags: ['srd', 'weapon'],
})
const LARCH = entity({
  id: '33333333-3333-4333-8333-333333333333',
  type: 'location',
  name: 'Red Larch',
  bodyMd: 'Home of [[Rook]].',
})

function db(over: Partial<DbSnapshot> = {}): DbSnapshot {
  return {
    entities: [ROOK, DAGGER, LARCH],
    holdings: [],
    notes: [],
    ddb: [] as PrismaDdbSnapshot[],
    party: [] as PrismaDdbParty[],
    ...over,
  }
}

function archive(over: Partial<Archive> = {}): Archive {
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    entities: [],
    holdings: [],
    notes: [],
    ...over,
  }
}

const plan = (a: Archive, snapshot = db(), resolutions = {}) =>
  planArchive(a, snapshot, resolutions)

/* ── identity ─────────────────────────────────────────────────────── */

test('an entry already there by name is a conflict, not a second copy', () => {
  const result = plan(archive({ entities: [{ type: 'player', name: 'rook' }] }))
  assert.equal(result.preview.entities.creates.length, 0)
  assert.equal(result.preview.entities.conflicts.length, 1)
  assert.equal(result.preview.entities.conflicts[0]?.key, `entity:${ROOK.id}`)
})

test('a name used twice in one file is refused, so it cannot become two rows', () => {
  const result = plan(
    archive({
      entities: [
        { type: 'npc', name: 'Krag' },
        { type: 'npc', name: ' krag ' },
      ],
    }),
  )
  assert.equal(result.preview.errors.length, 1)
  assert.match(result.preview.errors[0]?.message ?? '', /entities\[0\]/)
})

test('an id that is not here yet still creates, keeping the id', () => {
  const id = '44444444-4444-4444-8444-444444444444'
  const result = plan(archive({ entities: [{ id, type: 'npc', name: 'Krag' }] }))
  assert.equal(result.entityCreates.length, 1)
  assert.equal(result.entityCreates[0]?.id, id)
})

test('an entry cannot change type under an id it already owns', () => {
  const result = plan(archive({ entities: [{ id: ROOK.id, type: 'npc', name: 'Rook' }] }))
  assert.equal(result.entityCreates.length, 0)
  assert.match(result.preview.errors[0]?.message ?? '', /cannot change type/)
})

test('a type the app does not know is refused rather than quietly stored', () => {
  const result = plan(archive({ entities: [{ type: 'npcs', name: 'Krag' }] }))
  assert.match(result.preview.errors[0]?.message ?? '', /Unknown type "npcs"/)
})

/* ── diffing ──────────────────────────────────────────────────────── */

test('re-importing an export changes nothing', () => {
  const round: ArchiveEntity = {
    id: ROOK.id,
    type: 'player',
    name: 'Rook',
    summary: null,
    bodyMd: null,
    data: { level: 4, avatarUrl: 'https://ddb/rook.png' },
    imageKey: null,
    tags: [],
    knowledge: 'known',
    createdAt: WHEN.toISOString(),
    updatedAt: WHEN.toISOString(),
  }
  const result = plan(archive({ entities: [round] }))
  assert.deepEqual(result.preview.entities.conflicts[0]?.changed, [])
})

test('tag order is not a change', () => {
  const result = plan(
    archive({ entities: [{ type: 'item', name: 'Dagger', tags: ['weapon', 'srd'] }] }),
  )
  assert.deepEqual(result.preview.entities.conflicts[0]?.changed, [])
})

test('data is compared and merged per key, so a sync-written field survives', () => {
  const result = plan(
    archive({ entities: [{ type: 'player', name: 'Rook', data: { level: 5 } }] }),
    db(),
    { [`entity:${ROOK.id}`]: 'replace' },
  )
  assert.deepEqual(result.preview.entities.conflicts[0]?.changed, ['data.level'])
  assert.deepEqual(result.entityReplaces[0]?.fields.data, {
    level: 5,
    avatarUrl: 'https://ddb/rook.png',
  })
})

test('a field the archive leaves out is not written', () => {
  const result = plan(archive({ entities: [{ type: 'player', name: 'Rook' }] }), db(), {
    [`entity:${ROOK.id}`]: 'replace',
  })
  // Only `name`, which every record carries because it is the identity. The
  // point is that `data`, `tags` and `knowledge` are untouched, so a batch that
  // mentions an entry in passing cannot blank what it did not talk about.
  assert.deepEqual(Object.keys(result.entityReplaces[0]?.fields ?? {}), ['name'])
})

test('a conflict carries only the fields that differ', () => {
  const long = 'x'.repeat(400)
  const result = plan(archive({ entities: [{ type: 'item', name: 'Dagger', bodyMd: long }] }))
  const conflict = result.preview.entities.conflicts[0]
  assert.deepEqual(conflict?.changed, ['bodyMd'])
  assert.equal(Object.keys(conflict?.incoming ?? {}).length, 1)
  assert.ok(String(conflict?.incoming.bodyMd).length < 200)
})

/* ── resolutions ──────────────────────────────────────────────────── */

test('a conflict nobody resolved is left alone', () => {
  const result = plan(archive({ entities: [{ type: 'item', name: 'Dagger', summary: 'new' }] }))
  assert.equal(result.entityReplaces.length, 0)
  assert.equal(result.skipped.entities.skipped, 1)
})

/* ── references ───────────────────────────────────────────────────── */

test('a holding may name an item defined in the same file', () => {
  const result = plan(
    archive({
      entities: [{ type: 'item', name: 'Test Blade' }],
      holdings: [{ item: 'Test Blade', owner: 'Rook', quantity: 2 }],
    }),
  )
  assert.deepEqual(result.preview.errors, [])
  assert.equal(result.holdingCreates.length, 1)
  assert.deepEqual(result.holdingCreates[0]?.item, { newKey: 'item:test blade' })
  assert.deepEqual(result.holdingCreates[0]?.owner, { id: ROOK.id })
})

test('the holding shorthand on an entry becomes a holding', () => {
  const normalized = normalizeArchive({
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    entities: [{ type: 'item', name: 'Test Blade', holding: { owner: 'Rook', quantity: 2 } }],
  })
  assert.ok(!('fatal' in normalized))
  const result = plan(normalized.archive)
  assert.deepEqual(result.preview.errors, [])
  assert.equal(result.holdingCreates[0]?.quantity, 2)
})

test('a holding on something that is not an item is refused', () => {
  const result = plan(archive({ holdings: [{ item: 'Red Larch', owner: 'Rook' }] }))
  assert.match(result.preview.errors[0]?.message ?? '', /No item called "Red Larch"/)
})

test('a holding carried by nobody in particular is refused', () => {
  const result = plan(archive({ holdings: [{ item: 'Dagger', owner: 'Nobody' }] }))
  assert.match(result.preview.errors[0]?.message ?? '', /No player called "Nobody"/)
})

test('a holding with no owner is the party stash, not an error', () => {
  const result = plan(archive({ holdings: [{ item: 'Dagger', quantity: 3 }] }))
  assert.deepEqual(result.preview.errors, [])
  assert.equal(result.holdingCreates[0]?.owner, null)
})

test('a stack that is already there is a conflict, and replace sets the count', () => {
  const holding: PrismaHolding = {
    id: '55555555-5555-4555-8555-555555555555',
    itemId: DAGGER.id,
    ownerId: ROOK.id,
    quantity: 1,
    note: null,
    createdAt: WHEN,
    updatedAt: WHEN,
  }
  const a = archive({ holdings: [{ item: 'Dagger', owner: 'Rook', quantity: 4 }] })
  const snapshot = db({ holdings: [holding] })
  assert.deepEqual(plan(a, snapshot).preview.holdings.conflicts[0]?.changed, ['quantity'])
  const replaced = plan(a, snapshot, { [`holding:${holding.id}`]: 'replace' })
  assert.equal(replaced.holdingReplaces[0]?.fields.quantity, 4)
})

/* ── notes ────────────────────────────────────────────────────────── */

test('an entry note resolves its subject by name', () => {
  const result = plan(
    archive({
      notes: [{ author: 'Rook', subject: 'Red Larch', placement: 'entry', bodyMd: 'A note' }],
    }),
  )
  assert.deepEqual(result.preview.errors, [])
  assert.deepEqual(result.noteCreates[0]?.subject, { id: LARCH.id })
})

test('a note shape the database would reject is caught here instead', () => {
  const result = plan(archive({ notes: [{ author: 'Rook', placement: 'entry', bodyMd: 'x' }] }))
  assert.match(result.preview.errors[0]?.message ?? '', /needs a subject/)
})

test('the same note imported twice is a conflict, not a duplicate', () => {
  const note: PrismaNote = {
    id: '66666666-6666-4666-8666-666666666666',
    authorId: ROOK.id,
    subjectId: null,
    placement: 'party',
    visibility: 'shared',
    title: 'Session 1',
    bodyMd: 'We went east.',
    createdAt: WHEN,
    updatedAt: WHEN,
  }
  const result = plan(
    archive({
      notes: [
        { author: 'Rook', placement: 'party', title: 'Session 1', bodyMd: 'We went east.' },
      ],
    }),
    db({ notes: [note] }),
  )
  assert.equal(result.preview.notes.creates.length, 0)
  assert.deepEqual(result.preview.notes.conflicts[0]?.changed, [])
})

/* ── warnings ─────────────────────────────────────────────────────── */

test('a rename says how many entries still link to the old name', () => {
  const result = plan(archive({ entities: [{ id: ROOK.id, type: 'player', name: 'Rooke' }] }))
  const warning = result.preview.warnings.find((w) => w.message.includes('Renames'))
  assert.match(warning?.message ?? '', /1 entry links/)
})

test('renaming onto a name something else answers to is refused', () => {
  const result = plan(
    archive({ entities: [{ id: DAGGER.id, type: 'item', name: 'Dagger' }, { type: 'item', name: 'Dagger' }] }),
  )
  assert.ok(result.preview.errors.length > 0)
})

test('an unknown field is ignored with a warning rather than rejected', () => {
  const normalized = normalizeArchive({
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    entities: [{ type: 'npc', name: 'Krag', imageUrl: 'https://example/x.png' }],
  })
  assert.ok(!('fatal' in normalized))
  assert.match(normalized.warnings[0]?.path ?? '', /imageUrl/)
  assert.equal(plan(normalized.archive).preview.errors.length, 0)
})

/* ── the file itself ──────────────────────────────────────────────── */

test('something that is not an archive is rejected outright', () => {
  assert.ok('fatal' in normalizeArchive({ hello: 'world' }))
  assert.ok('fatal' in normalizeArchive([1, 2, 3]))
  assert.ok('fatal' in normalizeArchive({ format: ARCHIVE_FORMAT, version: 99, entities: [] }))
})

test('knowledge defaults to unknown, so nothing is revealed by accident', () => {
  const result = plan(archive({ entities: [{ type: 'npc', name: 'Krag' }] }))
  assert.equal(result.entityCreates[0]?.knowledge, 'unknown')
})

test('stableStringify ignores key order', () => {
  assert.equal(stableStringify({ a: 1, b: [2, { d: 4, c: 3 }] }), stableStringify({ b: [2, { c: 3, d: 4 }], a: 1 }))
})
