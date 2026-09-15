import type { EntitySummary } from '@codex/shared'
import { useMemo } from 'react'
import {
  CATEGORY_GROUPS,
  GROUP_LABEL,
  RARITIES,
  facetCounts,
  type CategoryGroup,
  type ItemFilter,
  type Rarity,
} from '../lib/itemFacets'
import { cx, PillButton } from './ui'

/**
 * Category and rarity chips for a pool of items.
 *
 * Shared UI, not just shared predicates: the codex and the add-item picker both
 * render this one component, so they cannot drift into two different ideas of
 * what a weapon is or what the counts mean.
 *
 * `pool` must be the same list the rows are drawn from — search results
 * included. Counting against the whole shelf instead would let a chip read
 * "Rare 119" and then yield four rows, which is the one thing that makes chips
 * not worth having.
 */
export default function ItemFilterBar({
  pool,
  value,
  onChange,
}: {
  pool: EntitySummary[]
  value: ItemFilter
  onChange: (next: ItemFilter) => void
}) {
  const counts = useMemo(() => facetCounts(pool, value), [pool, value])

  const groups = CATEGORY_GROUPS.filter(
    // An empty bucket is worth showing only if it is the one you are standing
    // in — otherwise "Other" would appear on a shelf that has none.
    (group) => counts.groups[group] > 0 || value.group === group,
  )

  return (
    <div className="flex flex-col gap-1.75">
      <div className="flex flex-wrap gap-1.75">
        <Chip
          label="All"
          count={pool.length}
          selected={value.group === null}
          onClick={() => onChange({ ...value, group: null })}
        />
        {groups.map((group) => (
          <Chip
            key={group}
            label={GROUP_LABEL[group]}
            count={counts.groups[group]}
            selected={value.group === group}
            onClick={() =>
              onChange({ ...value, group: value.group === group ? null : group })
            }
          />
        ))}
      </div>

      {/*
        Rarity only exists on magic items, so this row disappears entirely for
        Gear, Tools and Mounts. That is most of what keeps the bar from becoming
        three wrapped lines on a phone.
      */}
      {counts.hasRarities && (
        <div className="flex flex-wrap gap-1.75">
          {RARITIES.filter((r) => counts.rarities[r] > 0 || value.rarity === r).map((rarity) => (
            <Chip
              key={rarity}
              label={rarity}
              count={counts.rarities[rarity]}
              selected={value.rarity === rarity}
              onClick={() =>
                onChange({ ...value, rarity: value.rarity === rarity ? null : rarity })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}) {
  // Zero-count chips stay put but go dead, rather than vanishing — a bar that
  // reflows on every keystroke during a search is worse than a dim chip.
  const empty = count === 0 && !selected

  return (
    <PillButton
      tone={selected ? 'solid' : 'neutral'}
      disabled={empty}
      aria-pressed={selected}
      className={cx(empty && 'opacity-45')}
      onClick={onClick}
    >
      {label}
      <span className={cx('tabular-nums', selected ? 'opacity-70' : 'text-ink-faint')}>
        {count}
      </span>
    </PillButton>
  )
}

/** Campaign / Reference, for surfaces with no room to drill into a shelf. */
export function ShelfChips({
  value,
  counts,
  onChange,
}: {
  value: 'campaign' | 'reference'
  counts: { campaign: number; reference: number }
  onChange: (next: 'campaign' | 'reference') => void
}) {
  return (
    <div className="flex flex-wrap gap-1.75">
      <Chip
        label="Campaign"
        count={counts.campaign}
        selected={value === 'campaign'}
        onClick={() => onChange('campaign')}
      />
      <Chip
        label="Reference"
        count={counts.reference}
        selected={value === 'reference'}
        onClick={() => onChange('reference')}
      />
    </div>
  )
}

export type { CategoryGroup, Rarity }
