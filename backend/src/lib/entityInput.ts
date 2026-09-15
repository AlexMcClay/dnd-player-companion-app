import { KNOWLEDGE_STATES, type EntityInput, type Knowledge } from '@codex/shared'

/**
 * Validates and narrows an untrusted entity body, returning either the input or
 * a message saying what is wrong with it.
 *
 * `partial` allows PUT — and the importer — to omit fields. Lives here rather
 * than in the entities route because the archive importer validates the same
 * shape, and two copies of this would drift.
 */

export function isKnowledge(value: unknown): value is Knowledge {
  return typeof value === 'string' && (KNOWLEDGE_STATES as readonly string[]).includes(value)
}

export function parseEntityInput(body: unknown, partial: boolean): EntityInput | string {
  if (typeof body !== 'object' || body === null) return 'Body must be an object'
  const b = body as Record<string, unknown>
  const out: Partial<EntityInput> = {}

  if (b.type !== undefined) {
    if (typeof b.type !== 'string' || !/^[a-z0-9_-]{1,32}$/i.test(b.type)) {
      return 'type must be a short slug (letters, digits, _ or -)'
    }
    out.type = b.type
  } else if (!partial) {
    return 'type is required'
  }

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || b.name.trim().length === 0) return 'name is required'
    out.name = b.name.trim()
  } else if (!partial) {
    return 'name is required'
  }

  if (b.summary !== undefined) {
    if (b.summary !== null && typeof b.summary !== 'string') return 'summary must be a string'
    out.summary = b.summary as string | null
  }
  if (b.bodyMd !== undefined) {
    if (b.bodyMd !== null && typeof b.bodyMd !== 'string') return 'bodyMd must be a string'
    out.bodyMd = b.bodyMd as string | null
  }
  if (b.data !== undefined) {
    if (typeof b.data !== 'object' || b.data === null || Array.isArray(b.data)) {
      return 'data must be an object'
    }
    out.data = b.data as Record<string, unknown>
  }
  if (b.imageKey !== undefined) {
    if (b.imageKey !== null && typeof b.imageKey !== 'string') return 'imageKey must be a string'
    out.imageKey = b.imageKey as string | null
  }
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags) || b.tags.some((t) => typeof t !== 'string')) {
      return 'tags must be an array of strings'
    }
    out.tags = (b.tags as string[]).map((t) => t.trim()).filter(Boolean)
  }
  if (b.knowledge !== undefined) {
    if (!isKnowledge(b.knowledge)) return `knowledge must be one of ${KNOWLEDGE_STATES.join(', ')}`
    out.knowledge = b.knowledge
  }
  return out as EntityInput
}
