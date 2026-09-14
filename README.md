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

The seed loads the sample campaign from the design mockups (The Marrow Coast) so
nothing is ever empty on first run. `npm run db:reset` wipes and re-migrates.

## Who you are

On first load the app asks you to pick a character. That choice is kept in the
browser and sent with every request as `x-player-id`, so the app can show you
your own pack and, later, your own notes.

The character shows in the header on every screen; tap it to switch. Handy when
one phone gets passed around the table. The **Me** tab has the same control.

### DM mode

Tap **Locked** in the top right and enter `DM_KEY`. That reveals sealed entries and
turns on every create/edit/delete control. The key is checked server-side on every
write — hiding the buttons is a convenience, not the protection.

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
  Items — and each one is searchable. Search runs server-side over name, summary
  and body, so partial words work ("harbour" finds the Harbourmaster). The chosen
  kind and the query both live in the URL, so back works and a search is
  shareable.
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
| `PUT /api/entities/:id` | DM only, partial |
| `DELETE /api/entities/:id` | DM only |
| `GET /api/holdings?owner=&item=` | `owner=none` is the party stash. Hidden if the item is sealed. |
| `POST /api/holdings` | Any player or the DM |
| `PUT /api/holdings/:id` | Any player or the DM. Moving between stash and pack is an `ownerId` change. |
| `DELETE /api/holdings/:id` | Any player or the DM |
| `GET /api/notes?subject=&placement=&author=` | `author=me` resolves from the header. Filtered by `noteVisibility`. |
| `POST /api/notes` | The author is taken from the header, never the body |
| `PUT /api/notes/:id` | Author only |
| `DELETE /api/notes/:id` | Author, or the DM |
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
