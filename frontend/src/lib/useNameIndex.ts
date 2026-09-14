import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '../api/client'

/**
 * Lowercased name -> id for everything the current viewer can see. Backs
 * [[wiki-link]] resolution at render time, which stands in for a links table.
 *
 * Memoized because <Markdown> keys its own parse/sanitise memo on this Map. A
 * fresh Map each render would defeat that memo, and a page full of notes renders
 * a Markdown block per note.
 */
export function useNameIndex(): Map<string, string> {
  const { data } = useQuery({
    queryKey: ['entities', 'name-index'],
    queryFn: () => api.listEntities(),
    staleTime: 60_000,
  })

  return useMemo(() => {
    const index = new Map<string, string>()
    for (const entity of data ?? []) index.set(entity.name.toLowerCase(), entity.id)
    return index
  }, [data])
}
