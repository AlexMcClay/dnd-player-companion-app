/**
 * Per-type templates. This is the extensibility point: the database stores
 * `type` as a plain string and `data` as JSON, so adding "locations" or
 * "spells" later means adding a template here — no migration, no API change.
 */

import type { IconType } from 'react-icons'
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
      /** The person at the table, as opposed to the character. */
      { key: 'player', label: 'Played by', kind: 'text', placeholder: 'britto09' },
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
      { key: 'role', label: 'Role', kind: 'text', placeholder: 'Harbourmaster' },
      { key: 'location', label: 'Location', kind: 'text', placeholder: 'Ashgate' },
      { key: 'stance', label: 'Stance', kind: 'text', placeholder: 'Uneasy ally' },
      { key: 'firstMet', label: 'First met', kind: 'text', placeholder: 'Session 9' },
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
      { key: 'kind', label: 'Kind', kind: 'text', placeholder: 'Militant order' },
      { key: 'reach', label: 'Reach', kind: 'text', placeholder: 'Coastwide' },
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
      { key: 'kind', label: 'Kind', kind: 'text', placeholder: 'City · Inn · Region' },
      // The placeholders double as a lesson: these fields resolve [[links]],
      // which is not obvious anywhere else in the DM form.
      { key: 'within', label: 'Part of', kind: 'text', placeholder: '[[The Marrow Coast]]' },
      { key: 'ruledBy', label: 'Run by', kind: 'text', placeholder: '[[Mira Thrushbane]]' },
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
      { key: 'habitat', label: 'Habitat', kind: 'text', placeholder: 'Marrow shallows' },
      { key: 'groupSize', label: 'Group size', kind: 'text', placeholder: 'Pack of 3–6' },
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
      { key: 'effect', label: 'Effect', kind: 'text', placeholder: '2d6 fire in a 10 ft burst' },
      { key: 'attuned', label: 'Attuned', kind: 'boolean' },
      { key: 'charges', label: 'Charges', kind: 'text', placeholder: '1 of 3' },
      { key: 'source', label: 'Source', kind: 'text', placeholder: 'Tidewretch' },
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
  },
  { path: '/craft', label: 'Craft', icon: LuHammer, types: ['recipe'] },
  { path: '/search', label: 'Search', icon: LuSearch, types: [] },
]

/** The Codex groups, in the order the chooser grid shows them. */
export const CODEX_TYPES = ['npc', 'faction', 'location', 'monster', 'item'] as const

export function tabFor(path: string): TabDef | undefined {
  return TABS.find((tab) => tab.path === path)
}
