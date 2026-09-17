/**
 * Per-type templates. This is the extensibility point: the database stores
 * `type` as a plain string and `data` as JSON, so adding "locations" or
 * "spells" later means adding a template here — no migration, no API change.
 */

import type { Knowledge } from '@codex/shared'
import type { IconType } from 'react-icons'

/**
 * What each knowledge state means, in the DM's terms. Lives here beside the
 * templates because the entry form and the AI import guide both describe it,
 * and two wordings would eventually disagree.
 */
export const KNOWLEDGE_HELP: Record<Knowledge, string> = {
  unknown: 'Unknown — hidden from players',
  rumoured: 'Rumoured — visible, flagged',
  known: 'Known — fully visible',
}
import {
  LuBookOpen,
  LuCircleHelp,
  LuFlag,
  LuFlaskConical,
  LuHammer,
  LuMapPin,
  LuPackage,
  LuSearch,
  LuSkull,
  LuUser,
  LuUsers,
} from 'react-icons/lu'

export type FieldKind = 'text' | 'number' | 'boolean' | 'ingredients'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  placeholder?: string
}

export interface EntityTemplate {
  type: string
  label: string
  plural: string
  icon: IconType
  /** Word shown in an empty image box. */
  portraitWord: string
  /** width / height of the hero image on the detail page. */
  heroAspect: string
  fields: FieldDef[]
}

export const TEMPLATES: Record<string, EntityTemplate> = {
  player: {
    type: 'player',
    label: 'Player',
    plural: 'Players',
    icon: LuUser,
    portraitWord: 'Portrait',
    heroAspect: '4 / 5',
    fields: [
      { key: 'level', label: 'Level', kind: 'number' },
      { key: 'race', label: 'Race', kind: 'text', placeholder: 'Dragonborn' },
      { key: 'className', label: 'Class', kind: 'text', placeholder: 'Paladin' },
      { key: 'subclass', label: 'Subclass', kind: 'text', placeholder: 'Oath of the Ancients' },
      // The person at the table, as opposed to the character. Two fields
      // because a name is what you say out loud and a handle is what you type.
      { key: 'player', label: 'Played by', kind: 'text', placeholder: 'Gabe' },
      { key: 'handle', label: 'D&D Beyond', kind: 'text', placeholder: 'britto09' },
      // The number in the character's D&D Beyond URL. Set this and the sheet
      // can be synced from the Me tab.
      {
        key: 'ddbCharacterId',
        label: 'D&D Beyond character id',
        kind: 'text',
        placeholder: '166021024',
      },
    ],
  },
  npc: {
    type: 'npc',
    label: 'NPC',
    plural: 'NPCs',
    icon: LuUsers,
    portraitWord: 'Portrait',
    heroAspect: '4 / 3',
    fields: [
      { key: 'role', label: 'Role', kind: 'text', placeholder: 'Captain of the guard' },
      { key: 'location', label: 'Location', kind: 'text', placeholder: '[[Red Larch]]' },
      { key: 'stance', label: 'Stance', kind: 'text', placeholder: 'Ally' },
      { key: 'firstMet', label: 'First met', kind: 'text', placeholder: 'Session 4' },
    ],
  },
  faction: {
    type: 'faction',
    label: 'Faction',
    plural: 'Factions',
    icon: LuFlag,
    portraitWord: 'Crest',
    heroAspect: '1 / 1',
    fields: [
      { key: 'kind', label: 'Kind', kind: 'text', placeholder: 'Militia' },
      { key: 'reach', label: 'Reach', kind: 'text', placeholder: 'Dessarin Valley' },
      { key: 'stance', label: 'Stance', kind: 'text', placeholder: 'Hostile' },
    ],
  },
  location: {
    type: 'location',
    label: 'Location',
    plural: 'Locations',
    icon: LuMapPin,
    portraitWord: 'View',
    heroAspect: '3 / 2',
    fields: [
      // Deliberately one free-text field rather than a fixed hierarchy: a
      // country, a city and a single inn all live here.
      { key: 'kind', label: 'Kind', kind: 'text', placeholder: 'Town · Inn · Forest' },
      // The placeholders double as a lesson: these fields resolve [[links]],
      // which is not obvious anywhere else in the DM form.
      { key: 'within', label: 'Part of', kind: 'text', placeholder: '[[Red Larch]]' },
      { key: 'ruledBy', label: 'Run by', kind: 'text', placeholder: '[[Captain Harbek Ironwood]]' },
    ],
  },
  monster: {
    type: 'monster',
    label: 'Monster',
    plural: 'Bestiary',
    icon: LuSkull,
    portraitWord: 'Beast plate',
    heroAspect: '3 / 2',
    fields: [
      { key: 'kind', label: 'Kind', kind: 'text', placeholder: 'Aberration' },
      { key: 'habitat', label: 'Habitat', kind: 'text', placeholder: 'Underdark' },
      { key: 'groupSize', label: 'Group size', kind: 'text', placeholder: 'Squads' },
    ],
  },
  item: {
    type: 'item',
    label: 'Item',
    plural: 'Items',
    icon: LuPackage,
    portraitWord: 'Item art',
    heroAspect: '3 / 2',
    fields: [
      // The first group mirrors a 5e equipment entry, so SRD gear imported by
      // `db:seed:srd` renders with its real stats rather than a bare name.
      { key: 'category', label: 'Category', kind: 'text', placeholder: 'Martial Melee' },
      { key: 'rarity', label: 'Rarity', kind: 'text', placeholder: 'Uncommon' },
      { key: 'attunement', label: 'Attunement', kind: 'text', placeholder: 'Requires attunement' },
      { key: 'cost', label: 'Cost', kind: 'text', placeholder: '15 gp' },
      { key: 'weight', label: 'Weight', kind: 'text', placeholder: '3 lb' },
      { key: 'damage', label: 'Damage', kind: 'text', placeholder: '1d8 slashing' },
      { key: 'armorClass', label: 'Armour class', kind: 'text', placeholder: '11 + Dex' },
      { key: 'properties', label: 'Properties', kind: 'text', placeholder: 'Finesse, Light' },
      // The second group is campaign flavour rather than book stats.
      { key: 'effect', label: 'Effect', kind: 'text', placeholder: '2d6 fire in a 10 ft burst' },
      { key: 'attuned', label: 'Attuned', kind: 'boolean' },
      { key: 'charges', label: 'Charges', kind: 'text', placeholder: '1 of 3' },
      { key: 'source', label: 'Source', kind: 'text', placeholder: 'Drow bodies' },
    ],
  },
  recipe: {
    type: 'recipe',
    label: 'Recipe',
    plural: 'Crafting',
    icon: LuFlaskConical,
    portraitWord: 'Item art',
    heroAspect: '3 / 2',
    fields: [
      { key: 'ingredients', label: 'Reagents', kind: 'ingredients' },
      { key: 'output', label: 'Produces', kind: 'text', placeholder: 'Emberdraught' },
      { key: 'skill', label: 'Skill', kind: 'text', placeholder: 'Alchemy (Intelligence)' },
      { key: 'dc', label: 'Target', kind: 'text', placeholder: 'DC 14' },
      { key: 'checks', label: 'Checks', kind: 'text', placeholder: '2 successes' },
      { key: 'time', label: 'Base time', kind: 'text', placeholder: '6 h per check' },
    ],
  },
}

/** Falls back to a generic template so an unrecognised type still renders. */
export function templateFor(type: string): EntityTemplate {
  return (
    TEMPLATES[type] ?? {
      type,
      label: type,
      plural: type,
      icon: LuCircleHelp,
      portraitWord: 'Image',
      heroAspect: '3 / 2',
      fields: [],
    }
  )
}

/**
 * Bottom tab bar. Order here also drives swipe navigation and the direction a
 * page transition slides, so it is the one place the app's shape is declared.
 *
 * `types` is what the DM can create from that tab — DmCreateBar reads it, so
 * the lists are not repeated on each page.
 */
export interface TabDef {
  path: string
  label: string
  icon: IconType
  types: string[]
  /**
   * The search param that means "you have drilled into this tab".
   *
   * A tab whose sub-views live in the query string is still the same pathname,
   * so without this a swipe back from one of them reads as being on the tab
   * itself and lands on the neighbouring tab instead of stepping back out.
   *
   * Only the param that *pushes* history belongs here — a filter applied
   * sideways with `replace` is not a level you can go back from.
   */
  depthParam?: string
}

export const TABS: TabDef[] = [
  { path: '/party', label: 'Party', icon: LuUsers, types: ['player'] },
  { path: '/me', label: 'Me', icon: LuUser, types: [] },
  // The whole shared pool of knowledge: people, factions, beasts, and the
  // item repository players draw from.
  {
    path: '/codex',
    label: 'Codex',
    icon: LuBookOpen,
    types: ['npc', 'faction', 'location', 'monster', 'item'],
    // A group is always set once you leave the chooser grid — including in the
    // item categories, which sit one level below it.
    depthParam: 'group',
  },
  { path: '/craft', label: 'Craft', icon: LuHammer, types: ['recipe'] },
  { path: '/search', label: 'Search', icon: LuSearch, types: [] },
]

/** The Codex groups, in the order the chooser grid shows them. */
export const CODEX_TYPES = ['npc', 'faction', 'location', 'monster', 'item'] as const

export function tabFor(path: string): TabDef | undefined {
  return TABS.find((tab) => tab.path === path)
}
