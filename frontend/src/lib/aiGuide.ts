/**
 * The instructions the DM pastes into a chat alongside their session notes.
 *
 * Generated rather than written out once, because the two things most likely to
 * make an AI produce a bad batch are both things only the running app knows:
 * the field vocabulary each entry type actually renders, and the names of the
 * entries that already exist. Without the second the AI invents a second
 * "Red Larch" instead of linking to the one that is there.
 */
import { ENTITY_TYPES, KNOWLEDGE_STATES, type EntitySummary } from '@codex/shared'
import { KNOWLEDGE_HELP, TEMPLATES, templateFor } from '../templates'

/** Entries from the SRD library are not campaign knowledge and would bury the list. */
function isCampaign(entity: EntitySummary): boolean {
  return !entity.tags.includes('srd')
}

function fieldLines(type: string): string[] {
  return templateFor(type).fields.map((field) => {
    if (field.kind === 'ingredients') {
      return `  - \`${field.key}\` — ${field.label}, a list of \`{ "name": "<item name>", "qty": <number> }\``
    }
    const kind = field.kind === 'text' ? '' : ` (${field.kind})`
    const example = field.placeholder ? `, e.g. "${field.placeholder}"` : ''
    return `  - \`${field.key}\`${kind} — ${field.label}${example}`
  })
}

export function buildAiGuide(entities: EntitySummary[]): string {
  const campaign = entities.filter(isCampaign)

  const byType = new Map<string, string[]>()
  for (const entity of campaign) {
    const list = byType.get(entity.type)
    if (list) list.push(entity.name)
    else byType.set(entity.type, [entity.name])
  }

  const players = (byType.get('player') ?? []).slice().sort()
  const examplePlayer = players[0] ?? 'a player character'

  const existing = [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, names]) => {
      const label = templateFor(type).plural
      return `**${label}** (${type})\n${names
        .slice()
        .sort((a, b) => a.localeCompare(b))
        .map((name) => `- ${name}`)
        .join('\n')}`
    })
    .join('\n\n')

  const vocab = ENTITY_TYPES.filter((type) => TEMPLATES[type])
    .map((type) => `- **${type}** — ${templateFor(type).label}\n${fieldLines(type).join('\n')}`)
    .join('\n\n')

  const knowledge = KNOWLEDGE_STATES.map((state) => `- \`"${state}"\` — ${KNOWLEDGE_HELP[state]}`).join(
    '\n',
  )

  return `# Writing entries for my D&D campaign codex

I keep a companion app for my table. Read my session notes below and return
**one JSON document** in the format described here. I will import it straight
into the app, so the format has to be exact.

Reply with the JSON in a single fenced code block and nothing else after it.

## The shape

\`\`\`json
{
  "format": "codex-archive",
  "version": 1,
  "entities": [],
  "notes": []
}
\`\`\`

An **entity** is one entry in the codex — a person, a place, a faction, a
creature, a thing, or a crafting recipe:

\`\`\`json
{
  "type": "npc",
  "name": "Krag Bronzebeard",
  "knowledge": "known",
  "summary": "Dwarf scholar · Triboar",
  "data": { "role": "Scholar", "location": "[[Triboar]]" },
  "tags": ["triboar", "ally"],
  "bodyMd": "A friend of [[Pendrel Dornwood]].\\n\\n## The job\\nHe has offered **1,000 gold**."
}
\`\`\`

- \`name\` is the entry's identity. Two entries may not share a name, and an
  entry whose name matches one that already exists will be offered to me as an
  update to that entry rather than added as a second copy.
- \`summary\` is one line, shown under the name in lists. Use \` · \` to separate
  parts of it. Keep it under about 60 characters.
- \`bodyMd\` is Markdown. Headings (\`##\`), bold, bullet lists, \`>\` quotes and
  tables all render. Use \`\\n\` for line breaks inside the JSON string.
- \`tags\` are lower-case and hyphenated, like \`"red-larch"\` or \`"ally"\`.
- \`data\` holds the small labelled facts shown as a spec list. Use only the keys
  listed under "Fields" below for that type — an unlisted key is dropped.

## Linking entries

Write \`[[Name]]\` anywhere in \`bodyMd\`, in \`summary\`, or inside a \`data\` value,
and it becomes a link to that entry. Use \`[[Name|the text to show]]\` when the
sentence needs different wording.

**Always link to an existing entry rather than describing it again.** The
entries that already exist are listed at the end — match their spelling exactly.
Linking to something that does not exist yet is fine; the link goes live when
the entry does.

## What the party knows

Every entry carries a \`knowledge\` state — this is the whole point of the app, so
set it deliberately on every entry you create:

${knowledge}

Rules of thumb: the party experienced it or was told it plainly → \`known\`.
They heard it secondhand, or it is unconfirmed → \`rumoured\`. It exists in the
world but they have no idea → \`unknown\`. **If you leave it out it defaults to
\`unknown\`, so nothing leaks by accident** — but that also means a forgotten
\`knowledge\` hides the entry from my players.

A sealed entry's *name* is as revealing as its page, so do not put a secret in
the name of a \`known\` entry.

## Items the party is carrying

An item entry is the *definition*. To say the party actually has some, add
\`holding\` to it:

\`\`\`json
{
  "type": "item",
  "name": "Moonstone",
  "knowledge": "known",
  "data": { "category": "Gemstone", "cost": "50 gp" },
  "holding": { "quantity": 3, "owner": "${examplePlayer}", "note": "From the barrow" }
}
\`\`\`

- Leave \`owner\` out for the party stash. Otherwise it is a player's name.
- \`quantity\` is the total held, not an amount to add.
- Only put \`holding\` on an \`item\`.

## Notes

A note is something a player wrote, in their voice. Optional — include them only
if my notes clearly contain a player's own log.

\`\`\`json
{
  "author": "${examplePlayer}",
  "placement": "party",
  "title": "Session 12 — the bridge",
  "bodyMd": "We crossed at dawn. [[Krag Bronzebeard]] stayed behind."
}
\`\`\`

- \`placement\` is \`"party"\` for the shared board, or \`"entry"\` pinned to one
  codex entry — which then also needs \`"subject": "<entry name>"\`.
- \`author\` must be one of my players: ${players.length ? players.join(', ') : '(none recorded yet)'}.

## Fields

${vocab}

## Rules

1. Return **only** the JSON document. No commentary around it.
2. Never invent \`id\`, \`createdAt\`, \`updatedAt\`, \`imageKey\`, \`imageUrl\` or a
   \`ddb\` section. They are mine to manage.
3. \`type\` must be one of: ${ENTITY_TYPES.join(', ')}.
4. Do not create an entry for something already in the list below — link to it.
   If my notes genuinely change one, include it with **only the fields that
   changed** plus its \`type\` and \`name\`, and leave \`knowledge\` out so its
   current state is kept.
5. Do not guess at facts my notes do not contain. An entry with a name, a
   \`summary\` and two sentences is better than one padded with invention. If the
   party only heard something, say so and mark it \`rumoured\`.
6. Prefer one entry per real thing, and put the detail in \`bodyMd\` rather than
   splitting it across several entries.

## Entries that already exist

${existing || '(nothing yet — this is a fresh campaign)'}

---

My session notes follow.
`
}
