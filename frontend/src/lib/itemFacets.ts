import type { EntitySummary } from '@codex/shared'

/**
 * Splitting the item codex into the party's own things and the SRD reference,
 * and faceting the reference by category and rarity.
 *
 * Pure on purpose — no React, no hooks — so both the codex and the add-item
 * picker share one definition of what a "weapon" is, and so this can be checked
 * against the real corpus without a browser.
 */

/* ── shelves ──────────────────────────────────────────────────────── */

/**
 * The tag `db:seed:srd` puts on everything it seeds. Anything without it was
 * written for this campaign, which makes the split self-maintaining: an item the
 * DM creates lands on the campaign shelf without anyone remembering to mark it.
 */
export const REFERENCE_TAG = 'srd'

export type Shelf = 'campaign' | 'reference'

export const SHELVES: readonly Shelf[] = ['campaign', 'reference']

export function isShelf(value: string | null): value is Shelf {
  return value !== null && (SHELVES as readonly string[]).includes(value)
}

export function shelfOf(entity: EntitySummary): Shelf {
  return entity.tags.includes(REFERENCE_TAG) ? 'reference' : 'campaign'
}

/* ── categories ───────────────────────────────────────────────────── */

export const CATEGORY_GROUPS = [
  'weapon',
  'armour',
  'gear',
  'magic',
  'wondrous',
  'tools',
  'mounts',
  'other',
] as const

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  weapon: 'Weapons',
  armour: 'Armour',
  gear: 'Gear',
  magic: 'Magic',
  wondrous: 'Wondrous',
  tools: 'Tools',
  mounts: 'Mounts',
  other: 'Other',
}

/**
 * `data.category` is free text, so this maps the values the SRD actually uses
 * and lets everything else fall to `other`.
 *
 * A default of `gear` would be tidier and wrong: 12 of the 14 campaign items use
 * a category the SRD never does — Crafting material, Gemstone, Document, Poison,
 * Heraldry — and quietly filing them under Gear would claim a precision this
 * does not have. `other` says "uncategorised" honestly.
 */
const CATEGORY_MAP: Readonly<Record<string, CategoryGroup>> = Object.freeze({
  'martial melee': 'weapon',
  'martial ranged': 'weapon',
  'simple melee': 'weapon',
  'simple ranged': 'weapon',
  weapon: 'weapon',
  ammunition: 'weapon',

  // The SRD files armour by weight, with no "Armor" on the light/medium/heavy
  // rows themselves, so these three are categories rather than a property.
  light: 'armour',
  medium: 'armour',
  heavy: 'armour',
  shield: 'armour',
  armor: 'armour',
  armour: 'armour',

  'standard gear': 'gear',
  'adventuring gear': 'gear',
  'equipment packs': 'gear',
  'arcane foci': 'gear',
  'druidic foci': 'gear',
  'holy symbols': 'gear',

  potion: 'magic',
  scroll: 'magic',
  ring: 'magic',
  rod: 'magic',
  staff: 'magic',
  wand: 'magic',

  'wondrous items': 'wondrous',
  'wondrous item': 'wondrous',

  tools: 'tools',
  kits: 'tools',

  'mounts and vehicles': 'mounts',
})

export function groupOf(entity: EntitySummary): CategoryGroup {
  const raw = String((entity.data as Record<string, unknown>)?.category ?? '')
    .trim()
    .toLowerCase()
  return CATEGORY_MAP[raw] ?? 'other'
}

/* ── rarity ───────────────────────────────────────────────────────── */

/** Ascending, so the chips read in the order a player thinks about them. */
export const RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
  'Artifact',
  'Varies',
] as const

export type Rarity = (typeof RARITIES)[number]

const RARITY_BY_KEY = new Map<string, Rarity>(
  RARITIES.map((rarity) => [rarity.toLowerCase(), rarity]),
)

/** Null for anything with no rarity at all, which is every mundane item. */
export function rarityOf(entity: EntitySummary): Rarity | null {
  const raw = String((entity.data as Record<string, unknown>)?.rarity ?? '')
    .trim()
    .toLowerCase()
  return RARITY_BY_KEY.get(raw) ?? null
}

/* ── filtering ────────────────────────────────────────────────────── */

export interface ItemFilter {
  group: CategoryGroup | null
  rarity: Rarity | null
}

export const NO_FILTER: ItemFilter = { group: null, rarity: null }

export function isFiltered(filter: ItemFilter): boolean {
  return filter.group !== null || filter.rarity !== null
}

/** Both axes are independent, so they combine with AND. */
export function filterItems(items: EntitySummary[], filter: ItemFilter): EntitySummary[] {
  return items.filter(
    (item) =>
      (filter.group === null || groupOf(item) === filter.group) &&
      (filter.rarity === null || rarityOf(item) === filter.rarity),
  )
}

export interface FacetCounts {
  groups: Record<CategoryGroup, number>
  rarities: Record<Rarity, number>
  /** How many rows the current filter actually yields. */
  total: number
  /** True when anything in the pool carries a rarity at all. */
  hasRarities: boolean
}

/**
 * Counts for the chip bar.
 *
 * Each axis is counted with *its own* selection lifted but the other still
 * applied. That is what makes the numbers mean "what you would get if you
 * clicked this" — count with everything applied and every unselected chip reads
 * zero, so there is no way to see where to go next.
 *
 * Always call this with the same pool the list is drawn from, search results
 * included. A chip reading "Rare 119" that yields 4 rows is worse than no chip.
 */
export function facetCounts(pool: EntitySummary[], filter: ItemFilter): FacetCounts {
  const groups = Object.fromEntries(CATEGORY_GROUPS.map((g) => [g, 0])) as Record<
    CategoryGroup,
    number
  >
  const rarities = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>
  let hasRarities = false

  for (const item of pool) {
    const group = groupOf(item)
    const rarity = rarityOf(item)
    if (rarity !== null) hasRarities = true

    if (filter.rarity === null || rarity === filter.rarity) groups[group] += 1
    if (rarity !== null && (filter.group === null || group === filter.group)) {
      rarities[rarity] += 1
    }
  }

  return { groups, rarities, total: filterItems(pool, filter).length, hasRarities }
}
