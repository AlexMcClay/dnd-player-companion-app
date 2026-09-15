import { useQuery } from '@tanstack/react-query'
import type { EntitySummary } from '@codex/shared'
import { useMemo } from 'react'
import { api } from '../api/client'

/**
 * Everything the current viewer can see, in one cached request.
 *
 * Shared by the Codex chooser (which needs a count per type) and the wiki-link
 * name index, so the two do not fetch the same list twice.
 */
export function useAllEntities() {
  return useQuery({
    queryKey: ['entities', {}],
    queryFn: (): Promise<EntitySummary[]> => api.listEntities(),
    staleTime: 60_000,
  })
}

/**
 * Just the items, from that same one request.
 *
 * Every item surface reads this rather than fetching its own list: the codex
 * shelves, the picker, and the D&D Beyond matcher. They used to disagree about
 * which cache entry held the items, so the same rows were fetched twice under
 * two keys.
 *
 * Knowledge gating is already applied server-side, so what comes back is what
 * this viewer may see — a player never learns a sealed item exists by counting.
 */
export function useAllItems() {
  const all = useAllEntities()
  const items = useMemo(
    () => (all.data ?? []).filter((entity) => entity.type === 'item'),
    [all.data],
  )
  return { ...all, items }
}
