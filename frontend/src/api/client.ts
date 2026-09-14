import type {
  DdbPartySnapshot,
  DdbSnapshot,
  Entity,
  EntityInput,
  EntitySummary,
  Holding,
  HoldingInput,
  Note,
  NoteInput,
  NotePlacement,
  PresignResponse,
} from '@codex/shared'
import { getDmKey, getPlayerId } from '../lib/identity'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const dmKey = getDmKey()
  const playerId = getPlayerId()

  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(dmKey ? { 'x-dm-key': dmKey } : {}),
      ...(playerId ? { 'x-player-id': playerId } : {}),
      ...init.headers,
    },
  })

  if (!res.ok) {
    const message = await res
      .json()
      .then((b: { error?: string }) => b.error)
      .catch(() => null)
    throw new Error(message ?? `${res.status} ${res.statusText}`)
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

function qs(query: object): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (typeof v === 'string' && v) params.set(k, v)
  const s = params.toString()
  return s ? `?${s}` : ''
}

export interface EntityQuery {
  type?: string
  q?: string
  tag?: string
}

export interface HoldingQuery {
  /** A player id, or STASH for the party stash. Omit for everything. */
  owner?: string
  /** Narrow to one item definition — powers "who has this?". */
  item?: string
}

export interface NoteQuery {
  /** Notes pinned to this codex entry. */
  subject?: string
  placement?: NotePlacement
  /** A player id, or 'me' to let the server resolve it from the header. */
  author?: string
}

export const api = {
  /** Lists carry no `bodyMd` — fetch the entry itself when you need the body. */
  listEntities(query: EntityQuery = {}): Promise<EntitySummary[]> {
    return request<EntitySummary[]>(`/entities${qs(query)}`)
  },

  getEntity(id: string): Promise<Entity> {
    return request<Entity>(`/entities/${id}`)
  },

  createEntity(input: EntityInput): Promise<Entity> {
    return request<Entity>('/entities', { method: 'POST', body: JSON.stringify(input) })
  },

  updateEntity(id: string, input: Partial<EntityInput>): Promise<Entity> {
    return request<Entity>(`/entities/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },

  deleteEntity(id: string): Promise<void> {
    return request<void>(`/entities/${id}`, { method: 'DELETE' })
  },

  listHoldings(query: HoldingQuery = {}): Promise<Holding[]> {
    return request<Holding[]>(`/holdings${qs(query)}`)
  },

  createHolding(input: HoldingInput): Promise<Holding> {
    return request<Holding>('/holdings', { method: 'POST', body: JSON.stringify(input) })
  },

  updateHolding(id: string, input: Partial<HoldingInput>): Promise<Holding> {
    return request<Holding>(`/holdings/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },

  deleteHolding(id: string): Promise<void> {
    return request<void>(`/holdings/${id}`, { method: 'DELETE' })
  },

  listNotes(query: NoteQuery = {}): Promise<Note[]> {
    return request<Note[]>(`/notes${qs(query)}`)
  },

  createNote(input: NoteInput): Promise<Note> {
    return request<Note>('/notes', { method: 'POST', body: JSON.stringify(input) })
  },

  updateNote(id: string, input: Partial<NoteInput>): Promise<Note> {
    return request<Note>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },

  deleteNote(id: string): Promise<void> {
    return request<void>(`/notes/${id}`, { method: 'DELETE' })
  },

  /** The D&D Beyond mirror for a character, or null if never synced. */
  getDdb(playerId: string): Promise<DdbSnapshot | null> {
    return request<DdbSnapshot | null>(`/ddb/${playerId}`)
  },

  syncDdb(playerId: string): Promise<DdbSnapshot> {
    return request<DdbSnapshot>(`/ddb/${playerId}/sync`, { method: 'POST' })
  },

  /** The campaign's shared purse and items, or null if never synced. */
  getDdbParty(): Promise<DdbPartySnapshot | null> {
    return request<DdbPartySnapshot | null>('/ddb/party')
  },

  syncDdbParty(): Promise<DdbPartySnapshot> {
    return request<DdbPartySnapshot>('/ddb/party/sync', { method: 'POST' })
  },

  verifyDmKey(key: string): Promise<boolean> {
    return fetch('/api/dm/verify', { method: 'POST', headers: { 'x-dm-key': key } }).then(
      (r) => r.ok,
    )
  },

  /** Presign, then PUT the file straight to storage. Returns the object key. */
  async uploadImage(file: File, entityType: string): Promise<string> {
    const { key, uploadUrl } = await request<PresignResponse>('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, contentType: file.type, entityType }),
    })

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!put.ok) throw new Error(`Upload failed (${put.status})`)

    return key
  },
}
