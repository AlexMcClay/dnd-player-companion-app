/**
 * Types shared by the API and the web app.
 *
 * `type` is deliberately a plain string in the database. These constants are the
 * set the UI currently knows how to render; adding another one means adding a
 * template in the frontend, not a migration.
 */

export const ENTITY_TYPES = ['player', 'npc', 'faction', 'monster', 'item', 'recipe'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export const KNOWLEDGE_STATES = ['unknown', 'rumoured', 'known'] as const
export type Knowledge = (typeof KNOWLEDGE_STATES)[number]

/** What players are allowed to see. The API enforces this; this is the mirror. */
export const PLAYER_VISIBLE_KNOWLEDGE: Knowledge[] = ['rumoured', 'known']

export type EntityData = Record<string, unknown>

/**
 * An entry in the shared codex. Items here are *definitions* — who is carrying
 * how many of one is a Holding.
 */
export interface Entity {
  id: string
  type: string
  name: string
  summary: string | null
  bodyMd: string | null
  data: EntityData
  imageKey: string | null
  /** Absolute URL built by the API from imageKey; null when there is no image. */
  imageUrl: string | null
  tags: string[]
  knowledge: Knowledge
  createdAt: string
  updatedAt: string
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
  item: Entity
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
