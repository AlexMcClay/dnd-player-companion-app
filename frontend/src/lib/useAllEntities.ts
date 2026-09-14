import { useQuery } from '@tanstack/react-query'
import type { EntitySummary } from '@codex/shared'
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
