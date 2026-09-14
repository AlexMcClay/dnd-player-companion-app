import type { Entity, EntityInput, PresignResponse } from '@codex/shared'
import { getDmKey } from '../lib/dm'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const dmKey = getDmKey()
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(dmKey ? { 'x-dm-key': dmKey } : {}),
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

export interface EntityQuery {
  type?: string
  q?: string
  tag?: string
  /** A player id, or 'none' for the party stash. */
  owner?: string
}

export const api = {
  listEntities(query: EntityQuery = {}): Promise<Entity[]> {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v)
    const qs = params.toString()
    return request<Entity[]>(`/entities${qs ? `?${qs}` : ''}`)
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
