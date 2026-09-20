/**
 * Types shared by the API and the web app.
 *
 * `type` is deliberately a plain string in the database. These constants are the
 * set the UI currently knows how to render; adding another one means adding a
 * template in the frontend, not a migration.
 */

export const ENTITY_TYPES = [
  'player',
  'npc',
  'faction',
  'location',
  'monster',
  'item',
  'recipe',
] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export const KNOWLEDGE_STATES = ['unknown', 'rumoured', 'known'] as const
export type Knowledge = (typeof KNOWLEDGE_STATES)[number]

/** What players are allowed to see. The API enforces this; this is the mirror. */
export const PLAYER_VISIBLE_KNOWLEDGE: Knowledge[] = ['rumoured', 'known']

export type EntityData = Record<string, unknown>

/**
 * An entry as it appears in a list.
 *
 * Deliberately without `bodyMd`: rules text is over half the weight of a list
 * response once the SRD is loaded, and no list renders it. Fetch the entry
 * itself when you need the body.
 */
export interface EntitySummary {
  id: string
  type: string
  name: string
  summary: string | null
  data: EntityData
  imageKey: string | null
  /** Absolute URL built by the API from imageKey; null when there is no image. */
  imageUrl: string | null
  tags: string[]
  knowledge: Knowledge
  createdAt: string
  updatedAt: string
}

/**
 * A single entry, body included. Items here are *definitions* — who is carrying
 * how many of one is a Holding.
 */
export interface Entity extends EntitySummary {
  bodyMd: string | null
}

export interface EntityInput {
  type: string
  name: string
  summary?: string | null
  bodyMd?: string | null
  data?: EntityData
  imageKey?: string | null
  tags?: string[]
  knowledge?: Knowledge
}

/** A stack of one item, carried by a player or sitting in the party stash. */
export interface Holding {
  id: string
  itemId: string
  /** The player carrying it. Null means the party stash. */
  ownerId: string | null
  quantity: number
  note: string | null
  /** The item definition, expanded by the API so lists need one request. */
  item: EntitySummary
  createdAt: string
  updatedAt: string
}

export interface HoldingInput {
  itemId: string
  ownerId?: string | null
  quantity?: number
  note?: string | null
}

/** `owner=none` means the party stash, as opposed to omitting owner entirely. */
export const STASH = 'none'

/**
 * Where a note lives. Independent of who may read it.
 *  - entry: pinned to a codex entry
 *  - vault: the author's personal notebook
 *  - party: the shared board
 */
export const NOTE_PLACEMENTS = ['entry', 'vault', 'party'] as const
export type NotePlacement = (typeof NOTE_PLACEMENTS)[number]

export const NOTE_VISIBILITIES = ['private', 'shared'] as const
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number]

/**
 * Just enough of the author to put a face and a name on a note. Deliberately
 * not a whole Entity: a board of thirty notes would otherwise carry thirty
 * copies of a character sheet.
 */
export interface NoteAuthor {
  id: string
  name: string
  imageUrl: string | null
}

export interface Note {
  id: string
  authorId: string
  author: NoteAuthor
  /** The codex entry this is pinned to. Null for vault and party notes. */
  subjectId: string | null
  placement: NotePlacement
  visibility: NoteVisibility
  title: string | null
  bodyMd: string
  createdAt: string
  updatedAt: string
}

/**
 * A character as D&D Beyond last reported it.
 *
 * Separate from Holding on purpose: this is a mirror, replaced whole on each
 * sync, and nothing in the app writes to it.
 */
export interface DdbItem {
  name: string
  quantity: number
  /** D&D Beyond's own type string: "Longbow", "Light Armor", "Gear"… */
  type: string | null
  rarity: string | null
  magic: boolean
  equipped: boolean
  attuned: boolean
  /** Pounds, per unit. */
  weight: number | null
  /** Gold pieces, per unit. */
  cost: number | null
}

export interface DdbClass {
  name: string
  level: number
  subclass: string | null
}

export interface DdbCurrencies {
  cp?: number
  sp?: number
  ep?: number
  gp?: number
  pp?: number
}

export interface DdbSnapshot {
  playerId: string
  ddbCharacterId: string
  /** Their name on D&D Beyond. The app's entity is never renamed to match. */
  name: string
  race: string | null
  classes: DdbClass[]
  avatarUrl: string | null
  currencies: DdbCurrencies
  items: DdbItem[]
  syncedAt: string
}

/**
 * The campaign's shared purse and items. Separate from every character's own
 * pocket — and from the app's party stash, which players edit themselves.
 */
export interface DdbPartySnapshot {
  campaignId: string
  campaignName: string | null
  currencies: DdbCurrencies
  items: DdbItem[]
  syncedAt: string
}

/** The author is taken from the request, so it is deliberately absent here. */
export interface NoteInput {
  placement: NotePlacement
  subjectId?: string | null
  visibility?: NoteVisibility
  title?: string | null
  bodyMd: string
}

export interface PresignRequest {
  filename: string
  contentType: string
}

export interface PresignResponse {
  /** Object key to store on the entity. */
  key: string
  /** Presigned PUT URL, short-lived. */
  uploadUrl: string
  /** Where the object will be readable once uploaded. */
  publicUrl: string
}

export interface ApiError {
  error: string
}

/* ── backup archive ─────────────────────────────────────────────────── */

/**
 * One format serves two jobs: the DM's backup, and a batch of entries written
 * by an AI from session notes. That is why every cross-reference is an entity
 * **name** rather than an id — the same way the seed, `[[wiki-links]]` and
 * recipe reagents already refer to things, and the only way an AI can write a
 * reference at all.
 *
 * An export carries ids as well, so restoring into the same database matches
 * rows exactly rather than by name.
 */
export const ARCHIVE_FORMAT = 'codex-archive'
export const ARCHIVE_VERSION = 1

export interface ArchiveEntity {
  id?: string
  type: string
  name: string
  summary?: string | null
  bodyMd?: string | null
  data?: EntityData
  imageKey?: string | null
  tags?: string[]
  knowledge?: Knowledge
  createdAt?: string
  updatedAt?: string
  /**
   * Items only. Shorthand for one holding of this item, so a batch can say
   * "and the party has two of these" without a separate array. Lifted into
   * `holdings` before anything is planned.
   */
  holding?: { quantity?: number; owner?: string | null; note?: string | null }
}

export interface ArchiveHolding {
  id?: string
  /** Item name. */
  item: string
  /** Player name. Null or omitted means the party stash. */
  owner?: string | null
  quantity?: number
  note?: string | null
}

export interface ArchiveNote {
  id?: string
  /** Player name. */
  author: string
  /** Entity name for an entry note; null otherwise. */
  subject?: string | null
  placement: NotePlacement
  visibility?: NoteVisibility
  title?: string | null
  bodyMd: string
  createdAt?: string
}

export interface ArchiveDdbSnapshot extends Omit<DdbSnapshot, 'playerId'> {
  /** Player name. */
  player: string
}

export interface Archive {
  format: typeof ARCHIVE_FORMAT
  version: typeof ARCHIVE_VERSION
  exportedAt?: string
  entities: ArchiveEntity[]
  holdings?: ArchiveHolding[]
  notes?: ArchiveNote[]
  ddb?: { snapshots?: ArchiveDdbSnapshot[]; party?: DdbPartySnapshot | null }
}

/** What to do with a record that already exists. Anything unlisted is skipped. */
export type ArchiveResolution = 'skip' | 'replace'

/** A problem with one record, located by a path into the archive. */
export interface ArchiveIssue {
  /** `entities[3].type` */
  path: string
  message: string
}

export interface ArchiveConflict {
  /**
   * Echoed back in `resolutions`. Built from the *existing* row's id, so a
   * preview cannot be applied against a database that has moved on.
   */
  key: string
  path: string
  /** The entry's type, so it can be shown as what it is. See `ArchiveCreate`. */
  type?: string
  /** `Krag Bronzebeard` */
  label: string
  /**
   * Fields present in the archive whose value differs, with `data.level` for a
   * key inside `data`. Empty means the record is already identical.
   */
  changed: string[]
  existing: Record<string, unknown>
  incoming: Record<string, unknown>
}

/**
 * One record the import would add.
 *
 * Carries no decision — a new record overwrites nothing, so there is nothing to
 * consent to. It is listed so the DM can see *what* is arriving before they
 * commit to a batch someone else's AI wrote.
 */
export interface ArchiveCreate {
  /** `entities[3]` — the same locator the issues use. */
  path: string
  /**
   * The entry's type. Absent for holdings, notes and sheets, which are not
   * entries and have no type of their own.
   *
   * Separate from `label` rather than written into it, so the reader can be
   * shown the type as the app draws it everywhere else — its own word and its
   * own icon — instead of a slug spliced into a sentence.
   */
  type?: string
  /** The record's own name: `Wren Applesmith`, or `Rook · Moonstone ×3`. */
  label: string
  /** What would be written, shaped exactly like a conflict's `incoming`. */
  incoming: Record<string, unknown>
}

export interface ArchiveKindPlan {
  creates: ArchiveCreate[]
  conflicts: ArchiveConflict[]
}

export interface ArchivePreview {
  entities: ArchiveKindPlan
  holdings: ArchiveKindPlan
  notes: ArchiveKindPlan
  ddb: ArchiveKindPlan
  /** Blocking: the import refuses while any of these exist. */
  errors: ArchiveIssue[]
  /** Advisory: renames that break links, images not carried, fields ignored. */
  warnings: ArchiveIssue[]
}

export interface ImportRequest {
  archive: Archive
  resolutions: Record<string, ArchiveResolution>
}

export interface ImportCounts {
  created: number
  replaced: number
  skipped: number
}

export interface ImportResult {
  entities: ImportCounts
  holdings: ImportCounts
  notes: ImportCounts
  ddb: ImportCounts
}

/** What is in the database right now, for the DM's own screen. */
export interface DbStats {
  entities: number
  /** Entries tagged `srd` — the reference library, not this campaign. */
  srd: number
  /** Everything else: the campaign as it has actually been written. */
  campaign: number
  holdings: number
  notes: number
  ddbSnapshots: number
  ddbParty: boolean
}

/**
 * How much of the database to throw away.
 *  - all: every row, the SRD library included
 *  - campaign: everything except entries tagged `srd`, so the item library
 *    survives and only this campaign's content goes
 */
export const CLEAR_SCOPES = ['all', 'campaign'] as const
export type ClearScope = (typeof CLEAR_SCOPES)[number]

/** `confirm` must be CLEAR_PHRASE. Deleting everything should take intent. */
export const CLEAR_PHRASE = 'CLEAR'

export interface ClearRequest {
  scope: ClearScope
  confirm: string
}

export interface ClearResult {
  entities: number
  holdings: number
  notes: number
  ddbSnapshots: number
}

/** Shape of `data` for recipes. Rendered by the recipe template. */
export interface RecipeIngredient {
  name: string
  qty: number
}

export interface RecipeData extends EntityData {
  ingredients?: RecipeIngredient[]
  output?: string
  skill?: string
  dc?: string
  checks?: string
  time?: string
}
