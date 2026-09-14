import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

/**
 * Lowercased name -> id for everything the current viewer can see. Backs
 * [[wiki-link]] resolution at render time, which stands in for a links table.
 */
export function useNameIndex(): Map<string, string> {
  const { data } = useQuery({
    queryKey: ['entities', 'name-index'],
    queryFn: () => api.listEntities(),
    staleTime: 60_000,
  })

  const index = new Map<string, string>()
  for (const entity of data ?? []) index.set(entity.name.toLowerCase(), entity.id)
  return index
}
