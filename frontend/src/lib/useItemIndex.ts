import { useMemo } from 'react'
import type { DdbItem } from '@codex/shared'
import { normalise } from './textMatch'
import { useAllItems } from './useAllEntities'

/**
 * Matches a D&D Beyond item name to a codex item, so a row in the mirror can
 * open the real entry with its rules text.
 *
 * Built from the same cached request as the wiki-link index, so it costs
 * nothing extra. Only `item` entities are considered — an NPC that happens to
 * share a name must never be what opens.
 *
 * Matching is deterministic and tiered, never fuzzy: a wrong entry is worse
 * than no link, because a player would read the wrong rules and not know it.
 * Measured across the party's real inventories, the tiers below resolve 77 of
 * 80 items.
 */

/** "arrows" -> "arrow". Naive on purpose; only ever a last resort. */
function singular(name: string): string {
  return name.replace(/s$/, '')
}

export type ResolveItem = (item: Pick<DdbItem, 'name' | 'type'>) => string | undefined

export function useItemIndex(): ResolveItem {
  // The whole item list, both shelves. The codex splits campaign items from the
  // SRD reference for browsing; matching must not, or a D&D Beyond longsword
  // would stop resolving.
  const { items } = useAllItems()

  return useMemo(() => {
    const exact = new Map<string, string>()
    const loose = new Map<string, string>()
    const stems = new Map<string, string>()

    for (const entity of items) {
      // First one wins, so an earlier (alphabetically) entry is stable rather
      // than depending on iteration order changing under us.
      const name = entity.name.toLowerCase()
      if (!exact.has(name)) exact.set(name, entity.id)

      const key = normalise(entity.name)
      if (!loose.has(key)) loose.set(key, entity.id)

      const stem = singular(key)
      if (!stems.has(stem)) stems.set(stem, entity.id)
    }

    return (item) => {
      const hit = exact.get(item.name.toLowerCase())
      if (hit) return hit

      const key = normalise(item.name)
      const looseHit = loose.get(key)
      if (looseHit) return looseHit

      const stemHit = stems.get(singular(key))
      if (stemHit) return stemHit

      // D&D Beyond calls it "Leather"; the books call it "Leather Armor". Only
      // tried when D&D Beyond itself classes the item as armour, so this is
      // reading its own type rather than guessing from the name.
      if (/armor$/i.test(item.type ?? '') && !/armor$/.test(key)) {
        return loose.get(`${key} armor`)
      }

      return undefined
    }
  }, [items])
}
