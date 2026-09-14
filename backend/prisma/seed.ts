/**
 * Seeds the sample campaign from the design mockups (The Marrow Coast) so the
 * app is never empty on first run. Wipes the table first — this is a dev seed.
 */
import { PrismaClient, type Prisma } from '@prisma/client'

const prisma = new PrismaClient()

type Seed = {
  type: string
  name: string
  summary?: string
  bodyMd?: string
  data?: Prisma.InputJsonValue
  tags?: string[]
  knowledge?: string
  /**
   * Items only. The entity itself is just the definition; these two describe
   * the holding seeded alongside it. Omit both for a definition the party has
   * catalogued but does not currently own.
   */
  quantity?: number
  /** Name of the player carrying it. Omit for the party stash. */
  ownerName?: string
}

const PLAYERS: Seed[] = [
  {
    type: 'player',
    name: 'Rook',
    summary: 'Lvl 4 | Dragonborn | Paladin / Oath of the Ancients',
    knowledge: 'known',
    tags: ['party'],
    data: {
      level: 4,
      race: 'Dragonborn',
      className: 'Paladin',
      subclass: 'Oath of the Ancients',
      player: 'britto09',
    },
  },
  {
    type: 'player',
    name: 'Salva',
    summary: 'Lvl 4 | Tiefling | Warlock / The Fiend',
    knowledge: 'known',
    tags: ['party'],
    bodyMd: 'Convinced the lamps of [[The Pale Lantern]] are bound elementals. Nobody has tested it.',
    data: {
      level: 4,
      race: 'Tiefling',
      className: 'Warlock',
      subclass: 'The Fiend',
      player: 'tabithabw2004',
    },
  },
  {
    type: 'player',
    name: 'Talion',
    summary: 'Lvl 4 | Elf | Ranger / Gloom Stalker',
    knowledge: 'known',
    tags: ['party'],
    bodyMd:
      'Ran cargo manifests on the [[Ashgate]] quay before all this, which is how he knows [[Mira Thrushbane]].',
    data: {
      level: 4,
      race: 'Elf',
      className: 'Ranger',
      subclass: 'Gloom Stalker',
      player: 'Dunkitay',
    },
  },
  {
    type: 'player',
    name: 'Ted Bundy',
    summary: 'Lvl 4 | Human | Sorcerer / Draconic Bloodline',
    knowledge: 'known',
    tags: ['party'],
    data: {
      level: 4,
      race: 'Human',
      className: 'Sorcerer',
      subclass: 'Draconic Bloodline',
      player: 'someburner19',
    },
  },
]

const REST: Seed[] = [
  // — NPCs —
  {
    type: 'npc',
    name: 'Mira Thrushbane',
    summary: 'Harbourmaster · Ashgate · she/her',
    knowledge: 'known',
    tags: ['ashgate', 'ally'],
    data: { role: 'Harbourmaster', location: 'Ashgate', stance: 'Uneasy ally', firstMet: 'Session 9' },
    bodyMd: [
      '## First met',
      "Session 9, on the Ashgate quay. She waved off the Lantern's writ and let the party's cargo through unopened.",
      '',
      '## Appearance',
      'Fifties, salt-burned, a brass tally-ring on every finger. Speaks in shipping weights.',
      '',
      '## What she wants',
      'Her brother\'s ship back. She has not said from whom.',
      '',
      'Salva noted she flinched when Odric said "Saltbone".',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Ser Odric Vale',
    summary: 'Knight · The Pale Lantern · he/him',
    knowledge: 'known',
    tags: ['pale-lantern', 'hostile'],
    data: { role: 'Knight', location: 'Coastwide', stance: 'Hostile', firstMet: 'Session 9' },
    bodyMd: 'Carries the writ of [[The Pale Lantern]] and reads it aloud at every opportunity. Supper with him in session 12 went badly.',
  },
  {
    type: 'npc',
    name: 'Grym the Ledger',
    summary: 'Fence · Drowned Quarter · he/him',
    knowledge: 'known',
    tags: ['drowned-quarter'],
    data: { role: 'Fence', location: 'Drowned Quarter', stance: 'Business only', firstMet: 'Session 11' },
    bodyMd: 'Offered 300 gp for the [[Saltbone Charm]] without looking at it twice. Pays in Lantern coin — nobody has asked him where he gets it.',
  },
  {
    type: 'npc',
    name: 'Sister Ive',
    summary: 'Lamp-keeper · The Pale Lantern',
    knowledge: 'rumoured',
    tags: ['pale-lantern'],
    data: { role: 'Lamp-keeper', location: 'Unknown', stance: 'Unknown' },
    bodyMd: 'A name on the quay ledger. The party has not met her.',
  },
  {
    type: 'npc',
    name: 'The Salt Cantor',
    summary: 'Unknown',
    knowledge: 'unknown',
    tags: ['pale-lantern'],
    bodyMd: 'Who actually funds the Lantern. Not for player eyes yet.',
  },

  // — Factions —
  {
    type: 'faction',
    name: 'The Pale Lantern',
    summary: 'Militant order · Coastwide',
    knowledge: 'known',
    tags: ['hostile'],
    data: { kind: 'Militant order', reach: 'Coastwide', stance: 'Hostile' },
    bodyMd: [
      '## What they are',
      'Lamp-bearers who claim writ over every harbour from Ashgate to the Marrow. They inspect, they tally, they burn what they cannot tally.',
      '',
      '## How the party learned this',
      "[[Ser Odric Vale]]'s own telling, session 9. Confirmed by the quay ledger, session 11.",
    ].join('\n'),
  },
  {
    type: 'faction',
    name: 'Thrushbane Shipping',
    summary: 'Family concern · Ashgate',
    knowledge: 'known',
    tags: ['ashgate', 'ally'],
    data: { kind: 'Family concern', reach: 'Ashgate', stance: 'Uneasy ally' },
    bodyMd: 'Two hulls and a warehouse, run by [[Mira Thrushbane]] since her brother stopped coming back.',
  },

  // — Locations —
  // One free-text `kind` covers a whole region, a city and a single taproom,
  // rather than a fixed hierarchy nobody wants to maintain at the table.
  {
    type: 'location',
    name: 'The Marrow Coast',
    summary: 'Region · the whole campaign',
    knowledge: 'known',
    tags: ['region'],
    data: { kind: 'Region', within: 'The western reach', ruledBy: 'Nominally the Lantern' },
    bodyMd:
      'Cold water, bad harbours and a tide that takes more than it gives. Everything from [[Ashgate]] south belongs to it.',
  },
  {
    type: 'location',
    name: 'Ashgate',
    summary: 'City · the party\'s base',
    knowledge: 'known',
    tags: ['ashgate'],
    data: { kind: 'Port city', within: 'The Marrow Coast', ruledBy: '[[Mira Thrushbane]] on the quay' },
    bodyMd: [
      '## What you know',
      'Stone piers, a grain exchange, and more Lantern lamps every month. The party made landfall here in session 9.',
      '',
      'The [[Drowned Quarter]] is technically part of it, though nobody official says so.',
    ].join('\n'),
  },
  {
    type: 'location',
    name: 'The Drowned Quarter',
    summary: 'District · below the tide line',
    knowledge: 'known',
    tags: ['ashgate', 'drowned-quarter'],
    data: { kind: 'District', within: 'Ashgate', ruledBy: 'Whoever [[Grym the Ledger]] answers to' },
    bodyMd: 'Floods twice a day and is rebuilt twice a week. Where you go to sell something that should not exist.',
  },
  {
    type: 'location',
    name: 'The Gutted Lamp',
    summary: 'Inn · Drowned Quarter',
    knowledge: 'known',
    tags: ['drowned-quarter', 'inn'],
    data: { kind: 'Inn', within: 'The Drowned Quarter', ruledBy: 'A woman called Pell' },
    bodyMd: 'Four rooms, no windows, and a Lantern helm nailed above the bar with its glass prised out. Ask Pell about that and she changes the subject.',
  },
  {
    type: 'location',
    name: 'The Saltbone Reach',
    summary: 'Unknown',
    knowledge: 'rumoured',
    tags: ['marrow-coast'],
    data: { kind: 'Unknown', within: 'The Marrow Coast' },
    bodyMd: 'A name off the quay ledger. Somewhere south, past where the charts stop being useful.',
  },

  // — Monsters —
  {
    type: 'monster',
    name: 'Tidewretch',
    summary: 'Drowned humanoid · Marrow shallows',
    knowledge: 'known',
    tags: ['aberration', 'marrow-coast'],
    data: { kind: 'Aberration', habitat: 'Marrow shallows', groupSize: 'Pack of 3–6' },
    bodyMd: [
      '## What you have seen',
      'Comes up the tide-line at dusk. Grapples, then drags toward deep water. Rook\'s light did not slow them.',
      '',
      '## Confirmed in play',
      '- Fire hurts them badly — session 11',
      '- Cannot cross dry sand — session 13',
      '- Blunt weapons barely mark them — session 13',
      '',
      'A kill yields [[Tidewretch Ichor]].',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Marrow-hound',
    summary: 'Scavenger pack · the dunes above Ashgate',
    knowledge: 'known',
    tags: ['beast', 'marrow-coast'],
    data: { kind: 'Beast', habitat: 'Dunes', groupSize: 'Pack of 4–8' },
    bodyMd: 'Fast, thin, and unbothered by fire. The pelt is worth taking — see [[Marrow-hound Pelt]].',
  },
  {
    type: 'monster',
    name: 'The Thing Under Ashgate',
    summary: 'Unknown',
    knowledge: 'unknown',
    tags: ['ashgate'],
    bodyMd: 'Reserved. Players should not see this yet.',
  },

  // — Items —
  {
    type: 'item',
    name: 'Lanternglass Lens',
    summary: 'Attuned · 1 charge left',
    knowledge: 'known',
    quantity: 1,
    tags: ['attuned', 'magic'],
    ownerName: 'Salva',
    data: { attuned: true, charges: '1 of 3' },
    bodyMd: 'Prised out of a Lantern helm. Shows what the lamp saw last.',
  },
  {
    type: 'item',
    name: 'Emberdraught',
    summary: 'Crafted · quality: fine',
    knowledge: 'known',
    quantity: 3,
    tags: ['consumable', 'crafted'],
    data: { effect: 'Thrown · 2d6 fire in a 10 ft burst', quality: 'Fine' },
    bodyMd: 'Made at the bench in session 13. See the [[Emberdraught]] recipe.',
  },
  {
    type: 'item',
    name: 'Saltbone Charm',
    summary: 'Unidentified · found session 13',
    knowledge: 'rumoured',
    quantity: 1,
    tags: ['unidentified', 'lead'],
    bodyMd: 'Taken from the Thrushbane counting house. [[Grym the Ledger]] wants it badly.',
  },
  {
    type: 'item',
    name: 'Marrow-hound Pelt',
    summary: 'Reagent · used by 2 recipes',
    knowledge: 'known',
    quantity: 4,
    tags: ['reagent'],
    data: { source: 'Marrow-hound' },
  },
  {
    type: 'item',
    name: 'Tidewretch Ichor',
    summary: 'Reagent · spoils session 16',
    knowledge: 'known',
    quantity: 2,
    tags: ['reagent', 'perishable'],
    data: { source: 'Tidewretch' },
  },
  {
    type: 'item',
    name: 'Ashgate Firesalt',
    summary: 'Reagent · bought by the crate',
    knowledge: 'known',
    quantity: 6,
    tags: ['reagent'],
  },
  {
    type: 'item',
    name: 'Greenwhistle Bow',
    summary: 'Attuned since session 10',
    knowledge: 'known',
    quantity: 1,
    tags: ['attuned', 'weapon'],
    ownerName: 'Talion',
    data: { attuned: true },
  },
  {
    type: 'item',
    name: 'Glasswing Arrow',
    summary: 'Crafted · keen',
    knowledge: 'known',
    quantity: 6,
    tags: ['crafted', 'ammunition'],
    ownerName: 'Talion',
  },
  {
    type: 'item',
    name: 'Ring of the Quiet Step',
    summary: 'Attuned since session 12',
    knowledge: 'known',
    quantity: 1,
    tags: ['attuned', 'magic'],
    ownerName: 'Talion',
  },
  {
    // Catalogued but not held — shows the repository holding entries the party
    // knows of but does not own, and keeps the Glasswing Arrow recipe short.
    type: 'item',
    name: 'Glass Shard',
    summary: 'Reagent · scavenged from Lantern glass',
    knowledge: 'known',
    tags: ['reagent'],
  },

  // — Recipes —
  {
    type: 'recipe',
    name: 'Emberdraught',
    summary: 'Consumable · alchemy · learned session 10',
    knowledge: 'known',
    tags: ['alchemy'],
    data: {
      ingredients: [
        { name: 'Marrow-hound Pelt', qty: 1 },
        { name: 'Tidewretch Ichor', qty: 2 },
        { name: 'Ashgate Firesalt', qty: 3 },
      ],
      output: 'Emberdraught',
      skill: 'Alchemy (Intelligence)',
      dc: 'DC 14',
      checks: '2 successes',
      time: '6 h per check',
    },
    bodyMd: [
      '| Roll | Result |',
      '| --- | --- |',
      '| Fail by 5+ | Ruined — reagents lost |',
      '| 14–18 | Crude — 1 use, 6 h |',
      '| 19–23 | Fine — 2 uses, 5 h |',
      '| 24+ | Masterwork — 3 uses, 3 h |',
      '',
      'Produces [[Emberdraught]] — thrown, 2d6 fire in a 10 ft burst.',
    ].join('\n'),
  },
  {
    type: 'recipe',
    name: 'Glasswing Arrow',
    summary: 'Ammunition · smithing · learned session 8',
    knowledge: 'known',
    tags: ['smithing'],
    data: {
      ingredients: [
        { name: 'Ashgate Firesalt', qty: 1 },
        { name: 'Glass shard', qty: 3 },
      ],
      output: 'Glasswing Arrow',
      skill: 'Smithing (Dexterity)',
      dc: 'DC 12',
      checks: '1 success',
      time: '2 h',
    },
  },
  {
    type: 'recipe',
    name: 'Tidewretch Salve',
    summary: 'Half-heard from a Drowned Quarter hedge-witch',
    knowledge: 'rumoured',
    tags: ['alchemy'],
    data: {
      ingredients: [{ name: 'Tidewretch Ichor', qty: 3 }],
      output: 'Unknown',
      skill: 'Alchemy (Intelligence)',
      dc: 'Unknown',
    },
    bodyMd: 'The party knows this exists. They do not know the method.',
  },
  {
    type: 'recipe',
    name: 'Saltbone Ward',
    summary: 'Unknown',
    knowledge: 'unknown',
    tags: ['alchemy'],
    data: {
      ingredients: [{ name: 'Saltbone Charm', qty: 1 }],
      output: 'Saltbone Ward',
      skill: 'Arcana (Intelligence)',
      dc: 'DC 18',
      checks: '3 successes',
      time: '1 day per check',
    },
    bodyMd: 'Unlock this once they work out what the charm is.',
  },
]

function toCreate(seed: Seed): Prisma.EntityCreateManyInput {
  return {
    type: seed.type,
    name: seed.name,
    summary: seed.summary ?? null,
    bodyMd: seed.bodyMd ?? null,
    data: seed.data ?? {},
    tags: seed.tags ?? [],
    knowledge: seed.knowledge ?? 'unknown',
  }
}

async function main() {
  // Holdings cascade from entities, so this clears both.
  await prisma.entity.deleteMany()

  await prisma.entity.createMany({ data: PLAYERS.map(toCreate) })

  const players = await prisma.entity.findMany({ where: { type: 'player' } })
  const playerByName = new Map(players.map((p) => [p.name, p.id]))

  await prisma.entity.createMany({ data: REST.map(toCreate) })

  // Items are definitions; what the party actually carries is a holding.
  const items = await prisma.entity.findMany({ where: { type: 'item' } })
  const itemByName = new Map(items.map((i) => [i.name, i.id]))

  const holdings = REST.filter((s) => s.type === 'item' && s.quantity !== undefined).map((s) => ({
    itemId: itemByName.get(s.name)!,
    ownerId: s.ownerName ? (playerByName.get(s.ownerName) ?? null) : null,
    quantity: s.quantity!,
  }))
  await prisma.holding.createMany({ data: holdings })

  await seedNotes(playerByName)

  const entities = await prisma.entity.count()
  const held = await prisma.holding.count()
  const notes = await prisma.note.count()
  console.log(`seeded ${entities} entities, ${held} holdings and ${notes} notes`)
}

/** A note of each kind, so none of the three surfaces starts empty. */
async function seedNotes(playerByName: Map<string, string>) {
  const byName = new Map(
    (await prisma.entity.findMany({ select: { id: true, name: true } })).map((e) => [e.name, e.id]),
  )

  const talion = playerByName.get('Talion')
  const salva = playerByName.get('Salva')
  if (!talion || !salva) return

  await prisma.note.createMany({
    data: [
      {
        authorId: salva,
        subjectId: byName.get('Mira Thrushbane') ?? null,
        placement: 'entry',
        visibility: 'shared',
        bodyMd: 'She flinched when Odric said "Saltbone". Worth a push.',
      },
      {
        authorId: talion,
        subjectId: byName.get('Tidewretch') ?? null,
        placement: 'entry',
        visibility: 'shared',
        bodyMd: 'Fire works. Do not let them get a grip near deep water.',
      },
      {
        authorId: talion,
        placement: 'vault',
        visibility: 'private',
        title: 'On Grym',
        bodyMd: 'Pays in Lantern coin. Ask where he gets it. Do not mention this to [[Ted Bundy]].',
      },
      {
        authorId: talion,
        placement: 'vault',
        visibility: 'shared',
        title: 'The charm',
        bodyMd: 'Do not let Ted wear the [[Saltbone Charm]] until we know what it does.',
      },
      {
        authorId: salva,
        placement: 'party',
        visibility: 'shared',
        title: 'Before session 15',
        bodyMd: [
          '- Sell the ledger copy to [[Grym the Ledger]], or not?',
          '- Someone needs to talk to [[Mira Thrushbane]] about her brother.',
          '- We are low on Tidewretch ichor and it spoils session 16.',
        ].join('\n'),
      },
    ],
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
