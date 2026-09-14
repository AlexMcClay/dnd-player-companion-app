# Party Codex

A player-facing, edition-agnostic D&D companion. NPCs and player characters, party
items with ownership, a bestiary and faction codex, and custom crafting recipes —
showing only what the party has actually learned.

Mobile-first web app. No player accounts; the DM unlocks editing with a shared
passphrase.

## Running it

You need Node 20+ and Docker.

```bash
cp .env.example .env     # then change DM_KEY
npm run setup            # install, start containers, migrate, seed
npm run dev
```

- App — http://localhost:5173
- API — http://localhost:3001
- MinIO console — http://localhost:9001 (`codexminio` / `codexminio123`)

`npm run dev` binds the Vite server to your LAN, so players can reach it from their
phones at the `Network:` address it prints.

### Images on other devices

Image URLs have to name an address the *viewer's* device can reach. `localhost`
would point every phone at itself, so `S3_PUBLIC_HOST=auto` (the default) makes
the API hand out this machine's LAN address instead. It prints what it picked on
startup:

```
images served from http://192.168.20.39:9000/assets (auto-detected; set S3_PUBLIC_HOST to pin it)
```

If that line says `localhost`, or names a Docker/WSL interface that phones cannot
route to, set `S3_PUBLIC_HOST` in `.env` to the right address. URLs are built when
a record is read, so changing it fixes existing images too — nothing to migrate.

> `npm run db:seed` **wipes the database first.** Once you have entered real
> campaign data, do not run it again — uploaded images stay in MinIO but the
> entries pointing at them are gone.

### The 5e item library

```bash
npm run db:seed:srd
```

Adds ~600 items from the D&D 5e SRD to the Codex item repository:

| | | |
| --- | --- | --- |
| **237 equipment** | weapons, armour, gear, tools, packs, mounts | seeded **known** |
| **361 magic items** | with rarity, attunement and full rules text | seeded **sealed** |

Mundane gear is common knowledge — nobody has to discover a backpack. **Magic
items arrive hidden**, so the repository is not a catalogue for players to shop
from. Unseal one on its page when the party finds it. Re-running the seed will
not re-seal anything you have revealed.

Unlike `db:seed`, this **adds without deleting**. It matches on name, skips
anything already there, and is safe to run against a live campaign. Re-run it any
time; pass `-- --replace` to overwrite existing entries from the data file.

Every imported item is tagged `srd`, so your own items stay distinguishable —
`/codex?group=item&q=` searches both, and the tag chip filters to one.

The data is SRD 5.1, used under CC-BY-4.0. The required attribution lives in
[backend/prisma/data/SRD-ATTRIBUTION.md](backend/prisma/data/SRD-ATTRIBUTION.md)
and must stay with the data. It covers the SRD only — published monsters,
settings and magic items outside it are not licensed for redistribution.

The seed loads the campaign as the party knows it through session 4 — Red Larch,
the drow raid, the Netherese dig, and the four characters. `npm run db:reset`
wipes and re-migrates.

## Who you are

On first load the app asks you to pick a character. That choice is kept in the
browser and sent with every request as `x-player-id`, so the app can show you
your own pack and, later, your own notes.

The character shows in the header on every screen; tap it to switch. Handy when
one phone gets passed around the table. The **Me** tab has the same control.

Players write their own character's description from the **Me** tab — markdown
and `[[links]]`, same as anywhere else. That is the *only* field on a character a
player may change; name, level and everything else stay the DM's. The rule is
`PLAYER_EDITABLE` in `backend/src/routes/entities.ts`, checked fail-closed, so a
field added later is refused for players until it is deliberately listed.

### DM mode

Tap **Locked** in the top right and enter `DM_KEY`. That reveals sealed entries and
turns on every create/edit/delete control. The key is checked server-side on every
write — hiding the buttons is a convenience, not the protection.

## D&D Beyond

A character with a `ddbCharacterId` set — the number in its D&D Beyond URL — can
be pulled across from the **Me** tab. Players sync their own; the DM can sync
anyone. The character has to be public on D&D Beyond; no login is involved.

A sync writes **race, class, subclass, level and the avatar** onto the character
sheet, so editing those in the app is pointless — the next sync wins. Everything
else lands in a separate mirror.

> **The D&D Beyond inventory is deliberately separate from the app's items.**
> It lives in its own table and a sync replaces it whole, with no diffing or
> merging. Two inventories that never meet cannot drift out of step. The party
> stash and what a character carries in-app are untouched by syncing.

The character is **never renamed** to match D&D Beyond. A rename there would
silently turn every `[[link]]` to that character into dead text, so the app keeps
its own name and the panel points out any mismatch.

Avatars are linked from dndbeyond.com rather than copied. A portrait uploaded in
the app always wins over the synced avatar.

A D&D Beyond item whose name matches a Codex item is a link — tap it for the
rules text. Matching is tiered and deterministic, never fuzzy, because a wrong
entry is worse than no link: exact name, then ignoring a parenthetical ("Oil" →
"Oil (flask)"), then singular ("Arrows" → "Arrow"), and finally an `Armor`
suffix, but only when D&D Beyond itself types the item as armour ("Leather" →
"Leather Armor"). Across the party's real inventories that resolves 77 of 80.
Anything left over stays plain text — a magic variant like "Longbow, +1" has no
Codex entry to open.

### The party inventory

D&D Beyond also keeps a shared party purse and item list, synced from its own
card on the **Party** tab. Any player can sync it, like the app's stash.

The campaign id is worked out from whichever character is linked, so there is
nothing to configure. `DDB_CAMPAIGN_ID` overrides it if you ever need to.

> D&D Beyond answers a campaign that does not exist with `success: true` and an
> **empty** party rather than a 404, so a mistyped id looks identical to a party
> that owns nothing. Snapshots are keyed by campaign id, so a wrong one cannot
> overwrite the real mirror — and the panel warns when a sync returns no coin and
> no items at all.

## Notes

Players write notes in three places. Where a note lives and who may read it are
separate things.

| | |
| --- | --- |
| **On a codex entry** | Pinned to an NPC, monster, item or anything else, with the author's name and face on it. |
| **Your vault** | Your own notebook, on the **Me** tab. |
| **The party board** | The group's shared scratchpad on the **Party** tab. Always shared. |

Vault and entry notes can be **private** or **shared**. A shared vault note also
appears on your character's page, so it is how you publish something to the table
without posting it to the board.

Notes take markdown and `[[Their Name]]` links, same as DM-authored entries.

You edit your own notes. The DM can delete any note, but cannot rewrite one — a
byline you cannot trust would be worse than a note nobody can tidy.

> **The DM can read private notes.** This is deliberate for this app, but your
> players will not assume it. Tell them, or change `noteVisibility()` in
> `backend/src/lib/notes.ts` — it is a two-line change and the one place the rule
> lives.

### What this is not

Neither identity is authentication.

The DM passphrase is a shared secret. Picking a character has **no password at
all**: anyone can send any character's id and the server will believe them. Both
are sized for one table of people who trust each other.

This matters for the notes feature that is coming. **A note marked private will
be private only by convention** — another player could read it by claiming to be
you. Genuinely private notes would need a per-character PIN checked server-side,
which is a deliberate future choice, not an oversight.

Add real auth before putting this on the public internet.

## How it is built

| | |
| --- | --- |
| `frontend/` | React + Vite + TypeScript, React Router, TanStack Query. Hand-rolled CSS ported from the design canvas. |
| `backend/` | Express + Prisma + TypeScript, run with `tsx`. No build step. |
| `shared/` | Types used by both sides. |
| Storage | Postgres 16 and MinIO via `docker-compose.yml`. |

npm workspaces, one repo. Not submodules: hosts like Railway, Render and Fly deploy
from a subdirectory, so `frontend/` and `backend/` can still ship as separate
services later without losing shared types or atomic commits.

### Three tables

Almost everything lives in `entities`. `type` is a plain string and `data` is
JSONB, so adding locations, spells or quests later means adding a template in
`frontend/src/templates/index.ts` — no migration, no API change.

```
entities
  id · type · name · summary · body_md · data(jsonb) · image_key · tags[]
  knowledge · search(tsvector) · timestamps

holdings
  id · item_id → entities.id · owner_id → entities.id (null = party stash)
  quantity · note · timestamps

notes
  id · author_id → entities.id · subject_id → entities.id (null unless pinned)
  placement ('entry' | 'vault' | 'party') · visibility ('private' | 'shared')
  title · body_md · timestamps
```

- **knowledge** is `unknown` | `rumoured` | `known`. Players see rumoured and known;
  the DM sees everything. The rule lives in `backend/src/lib/knowledge.ts` in two
  shapes — a Prisma filter and a SQL fragment, because full-text search cannot use
  the former — both reading one list from `@codex/shared`. Nothing else in the
  codebase compares against `knowledge`.
- **The party stash** has its own screen at `/party/stash`, reached from a summary
  card on the Party tab. A real campaign's stash is long enough to bury
  everything under it, and a separate screen also keeps the "add an item" sheet
  from opening on top of another overlay.
- **Items are definitions.** An `entities` row of type `item` is the catalogue
  entry shown in the Codex; a `holdings` row is a stack of it that somebody
  carries. That split is what lets the same item sit in the stash and in two packs
  at once, lets a typo be fixed in one place, and makes "who has this?" answerable.
- **The Codex** opens on a grid of kinds — NPCs, Factions, Locations, Monsters,
  Items — and each one is searchable. Search runs server-side over name, summary,
  body **and tags**, so partial words work ("harbour" finds the Harbourmaster,
  "martial" finds every martial weapon). The chosen kind and the query both live
  in the URL, so back works and a search is shareable.
- **Long lists are virtualised** above 40 rows, and list responses omit `bodyMd` —
  rules text is more than half the weight of an item list once the SRD is in, and
  no list renders it. `EntitySummary` is the type without it, so the compiler
  stops anyone reading a body off a list row.
- **Locations** hold a country, a city, a district or a single inn. One free-text
  `kind` field rather than a hierarchy, so nobody has to maintain a tree at the
  table.
- **Notes** are one table for all three placements. Two CHECK constraints keep the
  shape honest: `placement='entry'` exactly when a subject is set, and a board
  note is always shared. Who may read one is decided in
  `backend/src/lib/notes.ts`, which also refuses to show a note whose subject the
  viewer cannot see — otherwise a note would announce that a sealed NPC exists.
- **search** is a generated `tsvector`. Prisma cannot express generated columns, so
  it lives in the hand-written migration and is queried with `$queryRaw`.

### Links between entries

Write `[[Their Name]]` in any body. It resolves to a link at render time against
the entries the viewer can see; an unresolved name renders as dimmed plain text
rather than a dead link. No links table — if one is ever wanted, it can be
backfilled by parsing the markdown already written.

### Images

The browser asks the API for a presigned PUT and uploads straight to storage, so
image bytes never pass through Express. The bucket is public-read locally and the
API returns a ready-to-use `imageUrl`.

## API

| | |
| --- | --- |
| `GET /api/entities?type=&q=&tag=` | List. Knowledge-filtered unless DM. |
| `GET /api/entities/:id` | 404s for players on sealed entries — a 403 would confirm something is there. |
| `POST /api/entities` | DM only |
| `PUT /api/entities/:id` | DM, or a player editing `bodyMd` on their own character |
| `DELETE /api/entities/:id` | DM only |
| `GET /api/holdings?owner=&item=` | `owner=none` is the party stash. Hidden if the item is sealed. |
| `POST /api/holdings` | Any player or the DM |
| `PUT /api/holdings/:id` | Any player or the DM. Moving between stash and pack is an `ownerId` change. |
| `DELETE /api/holdings/:id` | Any player or the DM |
| `GET /api/notes?subject=&placement=&author=` | `author=me` resolves from the header. Filtered by `noteVisibility`. |
| `POST /api/notes` | The author is taken from the header, never the body |
| `PUT /api/notes/:id` | Author only |
| `DELETE /api/notes/:id` | Author, or the DM |
| `GET /api/ddb/party` | The shared party mirror, or null |
| `POST /api/ddb/party/sync` | Any player, or the DM |
| `GET /api/ddb/:playerId` | A character's D&D Beyond mirror, or null |
| `POST /api/ddb/:playerId/sync` | The DM, or the player whose character it is |
| `POST /api/uploads/presign` | DM only |
| `POST /api/dm/verify` | Checks a passphrase before the UI stores it |

Authoring the catalogue is the DM's. Moving things around in it is everyone's.

## Deferred on purpose

- A links table — `[[wiki-links]]` cover it for now.
- Per-field reveals and partial recipe discovery — three knowledge states are
  enough to start.
- Session log, quests, leads, notes, PWA/offline. All additive; the design canvas
  has mockups for several of them.

## Deploying later

Point one service at `backend/` and one at `frontend/`. Swap `DATABASE_URL` for
managed Postgres and the `S3_*` vars for real S3, Cloudflare R2 or Backblaze B2 —
no code changes. Two things to do first: put real auth in front of it, and serve
the frontend with an SPA fallback so deep links like `/e/<id>` resolve.
