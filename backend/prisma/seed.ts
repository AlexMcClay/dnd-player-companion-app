/**
 * Seeds the campaign as the party knows it, through session 4.
 *
 * **This wipes every entity first**, and holdings and notes cascade from them.
 * It is for setting up, not for topping up: once real content is being written
 * in the app, add it there rather than here. Re-run `db:seed:srd` afterwards to
 * put the SRD item library back.
 *
 * Knowledge states follow the campaign notes exactly:
 *   known    — directly experienced, been told, or confirmed
 *   rumoured — heard secondhand, partial, unconfirmed
 *   unknown  — exists in the world, but the party has no idea; DM eyes only
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
   * Items only. The entity itself is just the definition; these describe the
   * holding seeded alongside it. Omit all three for a definition the party has
   * catalogued but does not currently own.
   */
  quantity?: number
  /** Name of the player carrying it. Omit for the party stash. */
  ownerName?: string
  /** Per-stack note, shown on the row. */
  holdingNote?: string
}

/**
 * The party. Descriptions are left empty on purpose: a player writes their own
 * from the Me tab, and an empty section is the invitation to do it.
 */
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
      player: 'Gabe',
      handle: 'britto09',
    },
  },
  {
    type: 'player',
    name: 'Salva',
    summary: 'Lvl 4 | Tiefling | Warlock / The Fiend',
    knowledge: 'known',
    tags: ['party'],
    data: {
      level: 4,
      race: 'Tiefling',
      className: 'Warlock',
      subclass: 'The Fiend',
      player: 'Tabitha',
      handle: 'tabithabw2004',
    },
  },
  {
    type: 'player',
    name: 'Talion',
    summary: 'Lvl 4 | Elf | Ranger / Gloom Stalker',
    knowledge: 'known',
    tags: ['party'],
    data: {
      level: 4,
      race: 'Elf',
      className: 'Ranger',
      subclass: 'Gloom Stalker',
      // Real name not recorded anywhere yet — fill it in on the character page.
      handle: 'Dunkitay',
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
      player: 'Mahan',
      handle: 'someburner19',
    },
  },
]

const REST: Seed[] = [
  // ── NPCs ────────────────────────────────────────────────────────────────
  {
    type: 'npc',
    name: 'Luckbringer Bress',
    summary: 'Cleric of Tymora · Red Larch',
    knowledge: 'known',
    tags: ['red-larch', 'ally', 'patron'],
    data: {
      role: 'Cleric of Tymora',
      location: 'Red Larch',
      stance: 'Ally',
      firstMet: 'Session 1',
    },
    bodyMd: [
      'Serves the shrine of Tymora in [[Red Larch]] — see [[The Shrine of Tymora]].',
      '',
      'Hired the party to look into a string of disappearances: deliveries and couriers not coming back from the trade routes. That job is what started all of this.',
      '',
      'Introduced the party to [[Pendrel Dornwood]].',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Pendrel Dornwood',
    summary: 'Travelling merchant and antiquities dealer · Neverwinter',
    knowledge: 'known',
    tags: ['ally', 'patron', 'merchant'],
    data: {
      role: 'Antiquities dealer',
      location: '[[Neverwinter]]',
      stance: 'Ally, and owed a favour',
      firstMet: 'Session 1',
    },
    bodyMd: [
      'Hired the party to recover a stolen silver griffon statuette, 50 gp each.',
      '',
      '## What he has told you',
      'Examined the [[Carved Obsidian Token]] and confirmed they are drow-made and magical. He could not read the [[Sealed Drow Dispatch]] — outside his experience — so he brought the party to his contact [[Krag Bronzebeard]] in [[Triboar]].',
      '',
      'He is tagging along, and he is collecting on that favour eventually.',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Captain Harbek Ironwood',
    summary: 'Captain of the guard · Red Larch',
    knowledge: 'known',
    tags: ['red-larch', 'ally', 'patron'],
    data: {
      role: 'Captain of the guard',
      location: '[[Red Larch]]',
      stance: 'Ally',
      firstMet: 'Session 2',
    },
    bodyMd: [
      'Leads [[Red Larch Town Guard]] — a volunteer militia, not a garrison.',
      '',
      '## The raid',
      "Led the town's defence when the drow struck. His militia forced a retreat but could not stop dozens of townsfolk being taken.",
      '',
      'Hired the party to recover the captives. The town had nothing to spare but horses.',
      '',
      '## After',
      'Debriefed the party on their return and paid out 500 gold and the [[Ring of Magic Missiles]].',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Mayor Jaina Silvermoor',
    summary: 'Mayor of Red Larch · not yet met',
    knowledge: 'rumoured',
    tags: ['red-larch'],
    data: { role: 'Mayor', location: '[[Red Larch]]', stance: 'Unknown' },
    bodyMd: [
      'Away in [[Goldenfields]] negotiating grain and food supply when the raid happened.',
      '',
      "Approved the party's reward through [[Captain Harbek Ironwood]]. The party knows her name and her office and nothing else — they have never been in a room with her.",
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Skeld Wagonwright',
    summary: 'Quarry worker · Red Larch',
    knowledge: 'known',
    tags: ['red-larch'],
    data: { role: 'Quarry worker', location: '[[Red Larch]]', firstMet: 'Session 1' },
    bodyMd: [
      'The only one of his delivery crew to come back.',
      '',
      'He has no memory of how he got home. Only a vague recollection of "talking to someone".',
      '',
      'Led the party to [[The Quarry]], where they found the first [[Carved Obsidian Token]].',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Garun',
    summary: 'Red Larch citizen · escaped the tunnels',
    knowledge: 'known',
    tags: ['red-larch'],
    data: { role: 'Citizen', location: '[[Red Larch]]', firstMet: 'Session 3' },
    bodyMd: [
      "Got himself out of the drow tunnels under [[Kryptgarden Forest]] alone.",
      '',
      'Told the party the captives were being marched deeper underground, and that only a few were left in the next chamber.',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Ondrel Kest',
    summary: 'Wagonwright · rescued from the column',
    knowledge: 'known',
    tags: ['red-larch'],
    data: { role: 'Wagonwright', location: '[[Red Larch]]', firstMet: 'Session 3' },
    bodyMd: [
      'A wagonwright in his fifties. Found injured and left behind by the retreating drow column, and carried out by the party.',
      '',
      '## What he said',
      '> They aren\'t being sold... they want us digging.',
      '',
      'He does not know what for.',
      '',
      'Sent ahead to [[Red Larch]] on horseback. Recovering there now.',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Krag Bronzebeard',
    summary: 'Dwarf · translating the dispatches · Triboar',
    knowledge: 'known',
    tags: ['triboar', 'ally', 'patron'],
    data: {
      role: 'Scholar of sorts',
      location: '[[Triboar]]',
      stance: 'Ally',
      firstMet: 'Session 4',
    },
    bodyMd: [
      'A friend of [[Pendrel Dornwood]], met at [[The Laughing Hollow]].',
      '',
      'Red hair and beard with gold rings braided into it, stocky, green eyes, dressed well.',
      '',
      '## The dispatches',
      'He can translate the [[Sealed Drow Dispatch]], but he needs time with his notes first.',
      '',
      '## The job',
      'While the party waits, he has offered **1,000 gold total** to deal with the [[Large Winged Creature]] that has been hitting caravans from the north.',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'Abigail',
    summary: 'Tavernmaster · The Everwyvern House',
    knowledge: 'known',
    tags: ['triboar'],
    data: {
      role: 'Tavernmaster',
      location: '[[The Everwyvern House]]',
      stance: 'Friendly',
      firstMet: 'Session 4',
    },
    bodyMd: [
      'Runs [[The Everwyvern House]], the fancier inn in [[Triboar]] — mostly Waterdhavian nobles.',
      '',
      'Blonde, blue eyes. Talked the room rate down from 20 gp to 12 gp a night for [[Salva]].',
    ].join('\n'),
  },
  {
    type: 'npc',
    name: 'The Drow Priestess',
    summary: 'Carried the second sealed letter',
    knowledge: 'known',
    tags: ['drow', 'lead'],
    data: { role: 'Priestess', location: '[[The Gallery]]', stance: 'Hostile', firstMet: 'Session 3' },
    bodyMd:
      'Seen at the dig. She was carrying a [[Sealed Drow Dispatch]] — and the party noted it looked **different from the other one**.',
  },
  {
    type: 'npc',
    name: 'Captain Felenar',
    summary: 'Unknown',
    knowledge: 'unknown',
    tags: ['drow'],
    bodyMd:
      'The true name and identity behind "the Captain". The party has never seen his face or heard this name spoken. Do not reveal until they do.',
  },

  // ── Factions ────────────────────────────────────────────────────────────
  {
    type: 'faction',
    name: 'The Drow Raiders',
    summary: 'Organised drow force · the excavation',
    knowledge: 'known',
    tags: ['drow', 'hostile'],
    data: { kind: 'Raiding force', reach: 'Dessarin Valley', stance: 'Hostile' },
    bodyMd: [
      '## What they did',
      'Struck [[Red Larch]] during its founding festival and took dozens of townsfolk captive instead of looting goods. Before that they had been quietly taking people one or two at a time, using the [[Carved Obsidian Token]].',
      '',
      '## What the party worked out',
      'This is not a slave-trading operation. The captives are forced labour on an excavation — [[The Gallery]] — and the drow are behind schedule.',
      '',
      '> They\'re late.',
      '',
      'Overheard more than once.',
    ].join('\n'),
  },
  {
    type: 'faction',
    name: 'Red Larch Town Guard',
    summary: 'Volunteer militia · Red Larch',
    knowledge: 'known',
    tags: ['red-larch', 'ally'],
    data: { kind: 'Militia', reach: '[[Red Larch]]', stance: 'Ally' },
    bodyMd:
      'Not a standing garrison — wagonwrights, quarrymen and farmhands, led by [[Captain Harbek Ironwood]]. Held the line during the raid at heavy cost.',
  },
  {
    type: 'faction',
    name: 'The Shrine of Tymora',
    summary: 'Local temple · Red Larch',
    knowledge: 'known',
    tags: ['red-larch', 'ally'],
    data: { kind: 'Temple', reach: '[[Red Larch]]', stance: 'Ally' },
    bodyMd:
      'The local temple, represented by [[Luckbringer Bress]]. First hired the party over the pattern of disappearances.',
  },
  {
    type: 'faction',
    name: 'Netheril',
    summary: 'Ancient fallen empire of wizards',
    knowledge: 'known',
    tags: ['ancient'],
    data: { kind: 'Fallen empire', reach: 'Long gone', stance: 'Historical' },
    bodyMd: [
      'An ancient, powerful, long-fallen empire of wizards.',
      '',
      'The party got the name off the engravings at the dig face in [[The Gallery]], and confirmed the same worked stone at [[The Ruined Watchtower]].',
      '',
      '**That is genuinely all they have** — a name and a one-line description. What Netheril has to do with what the drow are digging for is still a mystery to them.',
    ].join('\n'),
  },
  {
    type: 'faction',
    name: 'House Celofraie',
    summary: 'Unknown',
    knowledge: 'unknown',
    tags: ['drow'],
    bodyMd:
      'The noble drow house behind the silver spider heraldry. The party has the brooches and knows they mark *some* house — not which one.',
  },
  {
    type: 'faction',
    name: 'The Jaezred Chaulssin',
    summary: 'Unknown',
    knowledge: 'unknown',
    tags: ['drow'],
    bodyMd:
      'A secret order the party has no inkling exists at all. The true power behind the drow operation.',
  },

  // ── Locations ───────────────────────────────────────────────────────────
  {
    type: 'location',
    name: 'Red Larch',
    summary: "Trade town · the party's home base",
    knowledge: 'known',
    tags: ['red-larch'],
    data: {
      kind: 'Trade town',
      within: 'Dessarin Valley',
      ruledBy: '[[Mayor Jaina Silvermoor]]',
    },
    bodyMd: [
      'Roughly 600 people. Known for its farmers\' market, wagon works, buckle-and-lock factory and cattle market.',
      '',
      '## The raid',
      'Site of the founding festival and the drow raid. Several buildings burned; others were left completely untouched, and nobody has explained why.',
    ].join('\n'),
  },
  {
    type: 'location',
    name: 'The Blackbutter Inn',
    summary: 'Inn · Red Larch',
    knowledge: 'known',
    tags: ['red-larch', 'inn'],
    data: { kind: 'Inn', within: '[[Red Larch]]' },
    bodyMd: 'Where the party first stayed in [[Red Larch]].',
  },
  {
    type: 'location',
    name: 'The Red Larch Rambler',
    summary: 'Public gathering hall · Red Larch',
    knowledge: 'known',
    tags: ['red-larch'],
    data: { kind: 'Gathering hall', within: '[[Red Larch]]' },
    bodyMd: "Large and well lit. Red Larch's public hall.",
  },
  {
    type: 'location',
    name: 'The Stockades',
    summary: 'Guardhouse · Red Larch',
    knowledge: 'known',
    tags: ['red-larch'],
    data: {
      kind: 'Guardhouse',
      within: '[[Red Larch]]',
      ruledBy: '[[Captain Harbek Ironwood]]',
    },
    bodyMd:
      'A few holding cells, a questioning room, and the captain\'s private office. Where the party has been briefed, contracted and debriefed.',
  },
  {
    type: 'location',
    name: 'The Quarry',
    summary: 'Abandoned quarry camp · east of Red Larch',
    knowledge: 'known',
    tags: ['red-larch'],
    data: { kind: 'Abandoned camp', within: 'East of [[Red Larch]]' },
    bodyMd:
      'The goblin and bugbear camp where the party recovered the first [[Carved Obsidian Token]]. [[Skeld Wagonwright]] led them here.',
  },
  {
    type: 'location',
    name: 'The Ruined Watchtower',
    summary: 'Three-storey ruin · forest clearing',
    knowledge: 'known',
    tags: ['drow', 'netherese'],
    data: { kind: 'Ruin', within: 'Outside [[Red Larch]]' },
    bodyMd: [
      'A crumbling three-storey tower in a forest clearing. The party fought drow here and looted the [[Silver Spider Brooch]].',
      '',
      'On a second look, it carries the same worked-stone engravings as the dig face far below [[Kryptgarden Forest]] — [[Netheril]] make.',
    ].join('\n'),
  },
  {
    type: 'location',
    name: 'Kryptgarden Forest',
    summary: 'Forest northwest of Red Larch',
    knowledge: 'known',
    tags: ['drow'],
    data: { kind: 'Forest', within: 'Dessarin Valley' },
    bodyMd:
      'The party rode in here pursuing the drow column. The cave entrance to the tunnels lies beneath it.',
  },
  {
    type: 'location',
    name: 'The Gallery',
    summary: 'The dig site · deep under Kryptgarden Forest',
    knowledge: 'known',
    tags: ['drow', 'netherese'],
    data: { kind: 'Excavation', within: 'Beneath [[Kryptgarden Forest]]' },
    bodyMd: [
      'An overlook above a large excavation. Dozens of townsfolk hauling cut stone away from a wall of worked, fitted stone — confirmed [[Netheril]].',
      '',
      '## What happened here',
      'The party arrived too late to stop the main column of captives being sealed behind a collapsing passage, and fought to save eight stragglers. Most survived.',
      '',
      '**What is actually being dug for is still unknown.**',
    ].join('\n'),
  },
  {
    type: 'location',
    name: 'Neverwinter',
    summary: 'Coastal city',
    knowledge: 'known',
    tags: [],
    data: { kind: 'City', within: 'The Sword Coast' },
    bodyMd:
      '[[Pendrel Dornwood]] calls it home, and his network of antiquities contacts is there.',
  },
  {
    type: 'location',
    name: 'Goldenfields',
    summary: 'Farming settlement',
    knowledge: 'known',
    tags: [],
    data: { kind: 'Settlement', within: 'Dessarin Valley' },
    bodyMd:
      'Where [[Mayor Jaina Silvermoor]] was conducting grain and supply business during the raid.',
  },
  {
    type: 'location',
    name: 'Triboar',
    summary: 'Town north of Red Larch · the party is here',
    knowledge: 'known',
    tags: ['triboar'],
    data: { kind: 'Town', within: 'Dessarin Valley' },
    bodyMd:
      'The party has arrived. Home to [[Krag Bronzebeard]], who is translating the dispatches.',
  },
  {
    type: 'location',
    name: 'The Laughing Hollow',
    summary: 'Tavern · Triboar',
    knowledge: 'known',
    tags: ['triboar', 'inn'],
    data: { kind: 'Tavern', within: '[[Triboar]]' },
    bodyMd: 'Where [[Pendrel Dornwood]] introduced the party to [[Krag Bronzebeard]].',
  },
  {
    type: 'location',
    name: 'The Everwyvern House',
    summary: 'Inn · Triboar · 12 gp a night',
    knowledge: 'known',
    tags: ['triboar', 'inn'],
    data: { kind: 'Inn', within: '[[Triboar]]', ruledBy: '[[Abigail]]' },
    bodyMd:
      'The fancier Triboar inn, catering mostly to Waterdhavian nobles. The party is staying here — 12 gp a night, talked down from 20.',
  },
  {
    type: 'location',
    name: 'The Six Windows',
    summary: 'Inn · Triboar · the cheaper option',
    knowledge: 'known',
    tags: ['triboar', 'inn'],
    data: { kind: 'Inn', within: '[[Triboar]]' },
    bodyMd:
      'The other lodging offered in [[Triboar]]. Something small for the room, against 12 gp a night at [[The Everwyvern House]]. The party went with the expensive one.',
  },
  {
    type: 'location',
    name: 'Jhachalkhyn',
    summary: 'Unknown',
    knowledge: 'unknown',
    tags: ['drow'],
    bodyMd:
      'Drow city beneath the southern Neverwinter Wood. Home of [[House Celofraie]]. The party has never heard of it.',
  },
  {
    type: 'location',
    name: 'Chaulssin',
    summary: 'Unknown',
    knowledge: 'unknown',
    tags: ['drow'],
    bodyMd:
      'Ruined drow city beneath the northern Rauvin Mountains. Base of [[The Jaezred Chaulssin]]. Completely unknown to the party.',
  },

  // ── Bestiary ────────────────────────────────────────────────────────────
  // Each body keeps the campaign notes' split: what any adventurer would know,
  // then what this party actually saw.
  {
    type: 'monster',
    name: 'Goblins',
    summary: 'Small humanoids · ambushers',
    knowledge: 'known',
    tags: ['goblinoid'],
    data: { kind: 'Humanoid', habitat: 'Caves and camps', groupSize: 'Packs' },
    bodyMd: [
      '## What is commonly known',
      'Small, cowardly in groups without backup, notorious for ambushes and traps. Frequently found serving stronger creatures as muscle or cannon fodder.',
      '',
      '## What the party saw',
      'Guarded [[The Quarry]] alongside a bugbear and a goblin boss carrying the first [[Carved Obsidian Token]].',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Bugbear',
    summary: 'Large goblinoid · surprise attacker',
    knowledge: 'known',
    tags: ['goblinoid'],
    data: { kind: 'Humanoid', habitat: 'Caves and camps', groupSize: 'Leads goblin bands' },
    bodyMd: [
      '## What is commonly known',
      'Large, surprisingly stealthy goblinoids that favour surprise attacks with heavy weapons. Usually found leading or bullying smaller goblin bands.',
      '',
      '## What the party saw',
      "Fought in the boss room at [[The Quarry]].",
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Giant Spiders',
    summary: 'Web predators · found harnessed',
    knowledge: 'known',
    tags: ['beast', 'drow'],
    data: { kind: 'Beast', habitat: 'Forests and caves', groupSize: 'Nests' },
    bodyMd: [
      '## What is commonly known',
      'Web-slinging forest and cave predators with a painful, poisonous bite. They move through their own webbing easily and climb almost any surface.',
      '',
      '## What the party saw',
      'Ambushed the party near [[The Ruined Watchtower]] — and were **wearing strange harnesses**.',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Phase Spider',
    summary: 'Underdark native · shifts out of reach',
    knowledge: 'known',
    tags: ['drow', 'underdark'],
    data: { kind: 'Monstrosity', habitat: 'Underdark', groupSize: 'Solitary or few' },
    bodyMd: [
      '## What is commonly known',
      'Underdark natives that briefly shift into the Ethereal Plane, appearing and vanishing without warning. Poisonous bite that can put a victim to sleep.',
      '',
      '## What the party saw',
      'Fought during the drow raid on the festival at [[Red Larch]].',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Drow',
    summary: 'Dark elves of the Underdark',
    knowledge: 'known',
    tags: ['drow', 'underdark'],
    data: { kind: 'Humanoid', habitat: 'Underdark', groupSize: 'Squads' },
    bodyMd: [
      '## What is commonly known',
      'Dark elves with keen darkvision and minor innate magic, vulnerable to bright sunlight. Most surface folk associate them with the spider-goddess Lolth and treat any sighting as an ill omen.',
      '',
      '## What the party saw',
      "The raiders' rank and file. Tougher and faster in a fight than expected, every time.",
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Drow Elite Warrior',
    summary: 'Veteran drow soldier',
    knowledge: 'known',
    tags: ['drow', 'underdark'],
    data: { kind: 'Humanoid', habitat: 'Underdark', groupSize: 'Leads squads' },
    bodyMd: [
      '## What is commonly known',
      'Veteran, disciplined drow soldiers. Considerably more dangerous in melee than common drow.',
      '',
      '## What the party saw',
      'Led the ambush at [[The Ruined Watchtower]].',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Drow Apprentice Wizard',
    summary: 'Drow arcanist',
    knowledge: 'known',
    tags: ['drow', 'underdark'],
    data: { kind: 'Humanoid', habitat: 'Underdark', groupSize: 'With squads' },
    bodyMd: [
      '## What is commonly known',
      'Drow who study arcane magic on top of their innate abilities.',
      '',
      '## What the party saw',
      'Fought at the [[The Ruined Watchtower]] ambush.',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Umber Hulk',
    summary: 'Burrowing monstrosity · confounding gaze',
    knowledge: 'known',
    tags: ['underdark'],
    data: { kind: 'Monstrosity', habitat: 'Underdark', groupSize: 'Solitary' },
    bodyMd: [
      '## What is commonly known',
      'Burrowing subterranean monstrosities strong enough to tunnel through solid rock. Infamous for a confounding gaze.',
      '',
      '## What the party saw',
      'Burst up out of the cavern floor in the fungi cavern. Several of the party briefly felt **a calm, certain thought in their heads that was not their own** after meeting its eyes.',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Quaggoths',
    summary: 'Feral Underdark humanoids · slave-drivers',
    knowledge: 'known',
    tags: ['drow', 'underdark'],
    data: { kind: 'Humanoid', habitat: 'Underdark', groupSize: 'Packs' },
    bodyMd: [
      '## What is commonly known',
      'Feral, white-furred Underdark humanoids. Immensely strong and savage in melee. Sometimes kept as muscle by drow and other Underdark powers.',
      '',
      '## What the party saw',
      'Serving as slave-drivers at [[The Gallery]].',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Bandits',
    summary: 'Highway thieves · the road to Triboar',
    knowledge: 'known',
    tags: ['humanoid'],
    data: { kind: 'Humanoid', habitat: 'Trade roads', groupSize: 'Gangs with a captain' },
    bodyMd: [
      '## What is commonly known',
      'Common highway thieves found on most major trade roads. Usually after coin rather than blood, and quick to scatter once a fight turns against them.',
      '',
      '## What the party saw',
      'Stopped the party and [[Pendrel Dornwood]] on the road to [[Triboar]], demanding a toll.',
    ].join('\n'),
  },
  {
    type: 'monster',
    name: 'Large Winged Creature',
    summary: 'Unidentified · attacking caravans north of Triboar',
    knowledge: 'rumoured',
    tags: ['triboar', 'unconfirmed'],
    data: { kind: 'Unknown', habitat: 'North of [[Triboar]]', groupSize: 'Unknown' },
    bodyMd: [
      '## What the party has heard',
      'Caravan survivors describe a huge creature with bat-like wings. One account says it lifted an entire caravan off the ground.',
      '',
      '[[Krag Bronzebeard]] suspects a dragon, possibly black or green. **Nothing is confirmed** — nobody in the party has seen it.',
      '',
      '## If it is a dragon',
      'Black dragons favour swamps and acid breath. Green dragons favour forests and poison breath. Either would be capable of exactly this kind of raiding.',
      '',
      'Worth 1,000 gold to deal with.',
    ].join('\n'),
  },

  // ── Items the party holds ───────────────────────────────────────────────
  {
    type: 'item',
    name: 'Silver Spider Brooch',
    summary: 'Drow heraldry · unidentified house',
    knowledge: 'known',
    quantity: 4,
    holdingNote: 'Looted from drow bodies',
    tags: ['drow', 'lead'],
    data: { category: 'Heraldry', source: 'Drow bodies' },
    // Deliberately does not name the house: this entry is player-visible, and a
    // sealed entry's *name* leaks just as badly as its page would.
    bodyMd:
      'Worn by every drow the party has fought. Marks a noble drow house — **which one is still unknown**.',
  },
  {
    type: 'item',
    name: 'Carved Obsidian Token',
    summary: 'Enchanted · compels ordinary people',
    knowledge: 'known',
    quantity: 2,
    holdingNote: 'Function still unknown',
    tags: ['drow', 'magic', 'lead'],
    data: { category: 'Wondrous item', source: 'Drow' },
    bodyMd: [
      'Used to psychically compel ordinary people — the thief, [[Skeld Wagonwright]], the vanished couriers.',
      '',
      '[[Pendrel Dornwood]] confirmed they are drow-made and magical. **Exactly how they work is still unknown.**',
    ].join('\n'),
  },
  {
    type: 'item',
    name: 'Sealed Drow Dispatch',
    summary: 'Written orders in Drow · sealed in black wax',
    knowledge: 'known',
    quantity: 2,
    holdingNote: 'With Krag Bronzebeard for translation',
    tags: ['drow', 'lead'],
    data: { category: 'Document', source: 'Drow courier' },
    bodyMd:
      'Sealed in black wax with a spider sigil. Nobody in the party reads Drow. [[Krag Bronzebeard]] is working on them now.',
  },
  {
    type: 'item',
    name: 'The Drow Tunnel Map',
    summary: "Recovered from a courier's satchel",
    knowledge: 'known',
    quantity: 1,
    tags: ['drow', 'lead'],
    data: { category: 'Document', source: 'Drow courier' },
    bodyMd:
      'Marked with three points along the route: the waystation, the ledge chokepoint, and [[The Gallery]].',
  },
  {
    type: 'item',
    name: 'Ring of Magic Missiles',
    summary: 'Ring, uncommon (requires attunement)',
    knowledge: 'known',
    quantity: 1,
    ownerName: 'Salva',
    holdingNote: 'Attuned',
    tags: ['magic', 'attuned', 'reward'],
    data: {
      category: 'Ring',
      rarity: 'Uncommon',
      attunement: 'Requires attunement',
      charges: '3',
      effect: 'Cast magic missile — three darts, 1d4+1 force each',
    },
    bodyMd: [
      'Expend 1 charge as an action to cast *magic missile*: three darts, 1d4+1 force damage each, automatically hitting.',
      '',
      'Regains 1d3 charges at dawn.',
      '',
      '**Minor property:** advantage on saving throws against being blinded.',
      '',
      'Given by [[Captain Harbek Ironwood]] as part of the reward for the captives.',
    ].join('\n'),
  },
  {
    type: 'item',
    name: 'Moonstone',
    summary: 'Gemstone',
    knowledge: 'known',
    quantity: 3,
    tags: ['treasure'],
    data: { category: 'Gemstone', cost: '50 gp' },
  },
  {
    type: 'item',
    name: 'Tiger Eye Gemstone',
    summary: 'Gemstone',
    knowledge: 'known',
    quantity: 1,
    tags: ['treasure'],
    data: { category: 'Gemstone', cost: '10 gp' },
  },
  {
    type: 'item',
    name: 'Silvered Crossbow Bolts',
    summary: 'Ammunition · silvered',
    knowledge: 'known',
    // Three, per the players' own count.
    quantity: 3,
    tags: ['ammunition'],
    data: { category: 'Ammunition' },
  },
  {
    type: 'item',
    name: 'Vial of Drow Poison',
    summary: 'Poison · 2 doses',
    knowledge: 'known',
    quantity: 1,
    holdingNote: '2 doses',
    tags: ['consumable', 'drow'],
    data: { category: 'Poison', source: 'Drow bodies' },
    bodyMd: 'Taken off drow bodies. Two doses left.',
  },

  // Harvested parts, from the players' own inventory list. These are exactly
  // what a crafting recipe consumes, and reagents match on item name — so
  // having them here is what will make a future recipe resolve.
  {
    type: 'item',
    name: 'Phase Spider Fang',
    summary: 'Harvested part · reagent',
    knowledge: 'known',
    quantity: 4,
    tags: ['reagent', 'harvested'],
    data: { category: 'Crafting material', source: '[[Phase Spider]]' },
  },
  {
    type: 'item',
    name: 'Phase Spider Eye',
    summary: 'Harvested part · reagent',
    knowledge: 'known',
    quantity: 4,
    tags: ['reagent', 'harvested'],
    data: { category: 'Crafting material', source: '[[Phase Spider]]' },
  },
  {
    type: 'item',
    name: 'Vial of Phase Spider Poison',
    summary: 'Poison · harvested',
    knowledge: 'known',
    quantity: 1,
    tags: ['consumable', 'harvested'],
    data: { category: 'Poison', source: '[[Phase Spider]]' },
  },
  {
    type: 'item',
    name: 'Umber Hulk Chitin',
    summary: 'Harvested part · sold and used by the pound',
    knowledge: 'known',
    quantity: 20,
    holdingNote: '20 pounds',
    tags: ['reagent', 'harvested'],
    data: { category: 'Crafting material', source: '[[Umber Hulk]]', weight: '1 lb each' },
  },
  {
    type: 'item',
    name: 'Umber Hulk Mandible',
    summary: 'Harvested part · reagent',
    knowledge: 'known',
    quantity: 2,
    tags: ['reagent', 'harvested'],
    data: { category: 'Crafting material', source: '[[Umber Hulk]]' },
  },

  // ── Recipes ─────────────────────────────────────────────────────────────
  // None yet — the Craft tab shows its empty state until real ones exist.
  //
  // Kept below purely as a shape reference for writing your own. The one
  // non-obvious part: `ingredients[].name` is matched against *item names*, so
  // "Ashgate Firesalt" only counts as in-stock if an item is literally called
  // that and somebody holds it. Everything else is free text.
  //
  // {
  //   type: 'recipe',
  //   name: 'Emberdraught',
  //   summary: 'Consumable · alchemy · learned session 10',
  //   knowledge: 'known',
  //   tags: ['alchemy'],
  //   data: {
  //     ingredients: [
  //       { name: 'Marrow-hound Pelt', qty: 1 },
  //       { name: 'Tidewretch Ichor', qty: 2 },
  //       { name: 'Ashgate Firesalt', qty: 3 },
  //     ],
  //     output: 'Emberdraught',
  //     skill: 'Alchemy (Intelligence)',
  //     dc: 'DC 14',
  //     checks: '2 successes',
  //     time: '6 h per check',
  //   },
  //   bodyMd: [
  //     '| Roll | Result |',
  //     '| --- | --- |',
  //     '| Fail by 5+ | Ruined — reagents lost |',
  //     '| 14–18 | Crude — 1 use, 6 h |',
  //     '| 19–23 | Fine — 2 uses, 5 h |',
  //     '| 24+ | Masterwork — 3 uses, 3 h |',
  //   ].join('\n'),
  // },
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
  // Holdings and notes cascade from entities, so this clears everything.
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
    note: s.holdingNote ?? null,
  }))
  await prisma.holding.createMany({ data: holdings })

  await seedNotes(playerByName)

  const entities = await prisma.entity.count()
  const held = await prisma.holding.count()
  const notes = await prisma.note.count()
  console.log(`seeded ${entities} entities, ${held} holdings and ${notes} notes`)
  console.log('run `npm run db:seed:srd` to put the SRD item library back')
}

/**
 * The party's own running log, from the players' notes.
 *
 * Attributed to Talion: the log introduces the other three by name ("Mahan:
 * Ted, Tabitha: Salva, Gabe: Rook") and a note-taker does not introduce
 * themselves. Reassign on any note if that turns out to be wrong.
 *
 * Names are corrected to the codex spelling — the log had Cryptguard, Crag,
 * Doornwood, tribor — so every mention is a working link.
 */
async function seedNotes(playerByName: Map<string, string>) {
  const authorId = playerByName.get('Talion') ?? [...playerByName.values()][0]
  if (!authorId) return

  const board = (title: string, lines: string[]) => ({
    authorId,
    placement: 'party',
    visibility: 'shared',
    title,
    bodyMd: lines.join('\n'),
  })

  await prisma.note.createMany({
    data: [
      board('Session 1 — the festival', [
        'Staying at [[The Blackbutter Inn]]. The town\'s founding festival is starting.',
        '',
        '[[Luckbringer Bress]] tells us someone can give us more info — a man with a special interest in rare curiosities, [[Pendrel Dornwood]].',
        '',
        'Picked up 3 silver-tipped crossbow bolts.',
        '',
        'The drow seem to have come from [[Kryptgarden Forest]]. An ancient green dragon lives near the forest — probably not related. Two and a half days northwest of [[Red Larch]].',
        '',
        'Guard captain [[Captain Harbek Ironwood]] tells us roughly **50 citizens** have gone missing. When we come back we should be rewarded fairly. The mayor is in [[Goldenfields]].',
        '',
        'The town has provided 4 riding horses.',
      ]),

      board('Session 2 — the tower and the outcrop', [
        'Encountered a dilapidated tower near the forest entrance — [[The Ruined Watchtower]].',
        '',
        'Found a piece of parchment on one of the bodies with a rough outline of a map. A tower marked, and a trail leading to a cavern. Heavy traffic slightly westward from our location.',
        '',
        'The drow had [[Silver Spider Brooch|silver spider brooches]].',
        '',
        'Then a rocky outcrop on the side of a hill, with an entrance going inside. Sounds of iron shackles coming from it. The drow seem to be sending the prisoners into the tunnels for "work".',
      ]),

      board('Session 3 — under the forest', [
        'Saved a dozen citizens, then went through a deep tunnel. Found a cavern with bioluminescent fungi — possibly the Underdark.',
        '',
        'Fought an [[Umber Hulk]], then found a group of 4 dead drow carrying [[The Drow Tunnel Map]] and a note we cannot read.',
        '',
        '## The first marked location',
        'A small camp. 6–8 drow stayed here. Columns with iron rings and shackles for keeping humanoid slaves. Each column has tally marks — **one of them has a lot more than the rest**.',
        '',
        'Found an old man, [[Ondrel Kest]], who said the drow wanted to use the slaves to *dig*. Sent him back.',
        '',
        '## The ledge and the gallery',
        'Confronted some drow on a ledge. Saw someone observing us, and then they disappeared.',
        '',
        'Followed the path forward and the cave opened up into a drow settlement — roughly **40 slaves** digging for something. Not ore; they are digging into the dirt. Storing stone slabs in a heap.',
        '',
        '[[The Drow Priestess]] has a sealed letter, different from the other one.',
        '',
        'They were late for the timeline to find whatever they are digging for. The slaves say **someone was waiting for it**.',
        '',
        'The structure is [[Netheril]].',
      ]),

      board('Session 4 — Triboar', [
        'Went to [[Triboar]] to get info on the stuff, with [[Pendrel Dornwood]] helping us gather it.',
        '',
        'Went to a tavern called [[The Laughing Hollow]]. Pendrel introduces us to [[Krag Bronzebeard]], a dwarf who runs the place. He will decipher the letters, but he has a job for us while we wait.',
        '',
        '## The job',
        'Caravans have been attacked in the north by a [[Large Winged Creature]] — a young dragon? Two conflicting stories on the colour: **black, or green**. One account said it picked a whole caravan up by itself.',
        '',
        '**1,000 gold** if we do it.',
        '',
        '## Lodging',
        'We can stay at [[The Six Windows]] for something small, or spend more at [[The Everwyvern House]], which mainly caters to nobles.',
      ]),
    ],
  })

  // Observations pinned to the entry they are actually about, so they are found
  // where someone would look for them rather than three taps away in a log.
  const byName = new Map(
    (await prisma.entity.findMany({ select: { id: true, name: true } })).map((e) => [e.name, e.id]),
  )

  const pinned: Array<[string, string]> = [
    [
      'Large Winged Creature',
      'Two conflicting stories on the colour — black, or green. One account said it picked a whole caravan up by itself.',
    ],
    [
      'The Drow Tunnel Map',
      'The first marked location was a small camp, 6–8 drow. Columns with iron rings and shackles, and tally marks on each one. **One column has a lot more than the rest.**',
    ],
    [
      'Phase Spider',
      'Took 4 fangs, 4 eyes and a vial of poison off them. See [[Phase Spider Fang]].',
    ],
    ['Umber Hulk', 'Harvested 20 pounds of chitin and 2 mandibles.'],
    ['The Laughing Hollow', '[[Krag Bronzebeard]] runs the place.'],
    [
      'Sealed Drow Dispatch',
      'The second one came off [[The Drow Priestess]] at the dig, and it is **different from the other one**.',
    ],
  ]

  await prisma.note.createMany({
    data: pinned.flatMap(([subject, bodyMd]) => {
      const subjectId = byName.get(subject)
      if (!subjectId) return []
      return [{ authorId, subjectId, placement: 'entry', visibility: 'shared', bodyMd }]
    }),
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
