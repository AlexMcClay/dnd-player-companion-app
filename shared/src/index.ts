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
  ownerId: string | null
  quantity: number
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
  ownerId?: string | null
  quantity?: number
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
