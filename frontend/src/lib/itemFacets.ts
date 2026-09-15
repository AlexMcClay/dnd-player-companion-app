import type { EntitySummary } from '@codex/shared'

/**
 * Sorting the item codex into categories you can pick from, and keeping the
 * party's own things at the top of whichever category they land in.
 *
 * Pure on purpose — no React, no hooks — so the codex and the add-item picker
 * share one definition of what a weapon is, and so this can be checked against
 * the real corpus without a browser.
 */

/* ── whose item is it ─────────────────────────────────────────────── */

/**
 * The tag `db:seed:srd` puts on everything it seeds. Anything without it was
 * written for this campaign, which makes the distinction self-maintaining: an
 * item the DM creates counts as the party's without anyone marking it.
 *
 * This is a property of a row, not a place. Campaign items live in the same
 * categories as everything else — they are only sorted and marked.
 */
export const REFERENCE_TAG = 'srd'

export function isReference(entity: EntitySummary): boolean {
  return entity.tags.includes(REFERENCE_TAG)
}

/**
 * The party's own things first, everything else after.
 *
 * A stable partition rather than a comparator with a name tiebreak: `sort` is
 * stable, so each half keeps the order it arrived in. Alphabetical input stays
 * alphabetical; rank-ordered input stays rank-ordered.
 *
 * Do not use this on search results — see the note where the codex calls it.
 */
export function campaignFirst(items: EntitySummary[]): EntitySummary[] {
  return [...items].sort((a, b) => Number(isReference(a)) - Number(isReference(b)))
}

/* ── categories ───────────────────────────────────────────────────── */

export const CATEGORIES = [
  'weapons',
  'armour',
  'gear',
  'tools',
  'consumables',
  'wondrous',
  'implements',
  'reagents',
  'treasure',
  'mounts',
  'misc',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<Category, string> = {
  weapons: 'Weapons',
  armour: 'Armour',
  gear: 'Gear',
  tools: 'Tools',
  consumables: 'Consumables',
  wondrous: 'Wondrous',
  implements: 'Rings & Wands',
  reagents: 'Reagents',
  treasure: 'Treasure',
  mounts: 'Mounts',
  misc: 'Misc',
}

export const CATEGORY_BLURB: Record<Category, string> = {
  weapons: 'Mundane and magic alike',
  armour: 'Worn protection and shields',
  gear: 'Everything a pack holds',
  tools: 'Kits and instruments',
  consumables: 'Potions, scrolls and poisons',
  wondrous: 'Cloaks, boots, figurines and stranger things',
  implements: 'Rings, wands, staves and rods',
  reagents: 'Harvested parts and crafting stock',
  treasure: 'Gems, art and heraldry',
  mounts: 'Beasts, carts and boats',
  misc: 'Papers, maps and oddments',
}

/**
 * `data.category` is free text, so this maps the values the corpus actually
 * uses and lets anything else fall to `misc`.
 *
 * Note what is deliberately *not* here: magic weapons and magic armour carry
 * `category: Weapon`/`Armor`, so 64 of them land in Weapons and Armour rather
 * than in a magic bucket. That is why "Magic" is split into Wondrous and Rings
 * & Wands — no tile then claims to hold every magic item, which would be a lie.
 */
const CATEGORY_MAP: Readonly<Record<string, Category>> = Object.freeze({
  weapon: 'weapons',
  'martial melee': 'weapons',
  'martial ranged': 'weapons',
  'simple melee': 'weapons',
  'simple ranged': 'weapons',
  ammunition: 'weapons',

  // The SRD files armour by weight, with no "Armor" on the light/medium/heavy
  // rows themselves, so these three are categories rather than a property.
  armor: 'armour',
  armour: 'armour',
  shield: 'armour',
  light: 'armour',
  medium: 'armour',
  heavy: 'armour',

  'standard gear': 'gear',
  'equipment packs': 'gear',
  'arcane foci': 'gear',
  'druidic foci': 'gear',
  'holy symbols': 'gear',

  tools: 'tools',
  kits: 'tools',

  potion: 'consumables',
  scroll: 'consumables',
  poison: 'consumables',

  'wondrous items': 'wondrous',
  // Singular, and not a typo to tidy away: it is how the campaign seed writes
  // it, and the Carved Obsidian Token is the only item using it.
  'wondrous item': 'wondrous',

  ring: 'implements',
  wand: 'implements',
  staff: 'implements',
  rod: 'implements',

  'crafting material': 'reagents',

  gemstone: 'treasure',
  heraldry: 'treasure',

  'mounts and vehicles': 'mounts',

  document: 'misc',
})

export function categoryOf(entity: EntitySummary): Category {
  const raw = String((entity.data as Record<string, unknown>)?.category ?? '')
    .trim()
    .toLowerCase()
  return CATEGORY_MAP[raw] ?? 'misc'
}

export function isCategory(value: string | null): value is Category {
  return value !== null && (CATEGORIES as readonly string[]).includes(value)
}

/** How many items sit in each category, for the tiles. */
export function categoryCounts(items: EntitySummary[]): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const item of items) counts[categoryOf(item)] += 1
  return counts
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
  category: Category | null
  rarity: Rarity | null
}

export const NO_FILTER: ItemFilter = { category: null, rarity: null }

/** Both axes are independent, so they combine with AND. */
export function filterItems(items: EntitySummary[], filter: ItemFilter): EntitySummary[] {
  return items.filter(
    (item) =>
      (filter.category === null || categoryOf(item) === filter.category) &&
      (filter.rarity === null || rarityOf(item) === filter.rarity),
  )
}

export interface FacetCounts {
  categories: Record<Category, number>
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
 * Always call this with the same pool the list is drawn from. A chip reading
 * "Rare 119" that yields four rows is worse than no chip.
 */
export function facetCounts(pool: EntitySummary[], filter: ItemFilter): FacetCounts {
  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  const rarities = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>
  let hasRarities = false

  for (const item of pool) {
    const category = categoryOf(item)
    const rarity = rarityOf(item)
    if (rarity !== null) hasRarities = true

    if (filter.rarity === null || rarity === filter.rarity) categories[category] += 1
    if (rarity !== null && (filter.category === null || category === filter.category)) {
      rarities[rarity] += 1
    }
  }

  return { categories, rarities, total: filterItems(pool, filter).length, hasRarities }
}
