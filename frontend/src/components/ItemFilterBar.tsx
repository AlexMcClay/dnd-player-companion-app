import type { EntitySummary } from '@codex/shared'
import { useMemo } from 'react'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  RARITIES,
  facetCounts,
  type ItemFilter,
} from '../lib/itemFacets'
import { Chip } from './ui'

/**
 * Chips for narrowing a pool of items.
 *
 * Two named rows rather than one component with a visibility flag, because the
 * rows are not interchangeable: the codex picks a category by navigating to it
 * and so needs rarity alone, while the picker has no grid and needs both.
 *
 * `pool` must be the same list the rows are drawn from. Counting against
 * anything else lets a chip read "Rare 119" and then yield four rows, which is
 * the one thing that makes chips not worth having.
 */

export function CategoryChips({
  pool,
  value,
  onChange,
}: {
  pool: EntitySummary[]
  value: ItemFilter
  onChange: (next: ItemFilter) => void
}) {
  const counts = useMemo(() => facetCounts(pool, value), [pool, value])

  return (
    <div className="flex flex-wrap gap-1.75">
      {/*
        "All" counts what the *rest* of the filter yields, not the raw pool —
        with a rarity selected, pool.length would disagree with the sum of every
        other chip on the row.
      */}
      <Chip
        label="All"
        count={value.category === null ? counts.total : facetCounts(pool, { ...value, category: null }).total}
        selected={value.category === null}
        onClick={() => onChange({ ...value, category: null })}
      />
      {CATEGORIES.filter(
        (category) => counts.categories[category] > 0 || value.category === category,
      ).map((category) => (
        <Chip
          key={category}
          label={CATEGORY_LABEL[category]}
          count={counts.categories[category]}
          selected={value.category === category}
          onClick={() =>
            onChange({ ...value, category: value.category === category ? null : category })
          }
        />
      ))}
    </div>
  )
}

/**
 * Rarity only exists on magic items, so this renders nothing at all for Gear,
 * Tools and Mounts. That is most of what keeps the bar from wrapping to three
 * lines on a phone.
 */
export function RarityChips({
  pool,
  value,
  onChange,
}: {
  pool: EntitySummary[]
  value: ItemFilter
  onChange: (next: ItemFilter) => void
}) {
  const counts = useMemo(() => facetCounts(pool, value), [pool, value])

  if (!counts.hasRarities) return null

  return (
    <div className="flex flex-wrap gap-1.75">
      <Chip
        label="Any"
        count={value.rarity === null ? counts.total : facetCounts(pool, { ...value, rarity: null }).total}
        selected={value.rarity === null}
        onClick={() => onChange({ ...value, rarity: null })}
      />
      {RARITIES.filter((rarity) => counts.rarities[rarity] > 0 || value.rarity === rarity).map(
        (rarity) => (
          <Chip
            key={rarity}
            label={rarity}
            count={counts.rarities[rarity]}
            selected={value.rarity === rarity}
            onClick={() => onChange({ ...value, rarity: value.rarity === rarity ? null : rarity })}
          />
        ),
      )}
    </div>
  )
}

/** Both rows, for a surface with no category grid to navigate. */
export default function ItemFilterBar(props: {
  pool: EntitySummary[]
  value: ItemFilter
  onChange: (next: ItemFilter) => void
}) {
  return (
    <div className="flex flex-col gap-1.75">
      <CategoryChips {...props} />
      <RarityChips {...props} />
    </div>
  )
}
