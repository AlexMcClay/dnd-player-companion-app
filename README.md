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

The seed loads the sample campaign from the design mockups (The Marrow Coast) so
nothing is ever empty on first run. `npm run db:reset` wipes and re-migrates.

## DM mode

Tap **Locked** in the top right and enter `DM_KEY`. That reveals sealed entries and
turns on every create/edit/delete control. The key is checked server-side on every
write — hiding the buttons is a convenience, not the protection.

This is a shared passphrase, not authentication. It is sized for one table of
people who trust each other. Add real auth before putting this on the public
internet.

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

### One table

Everything lives in `entities`. `type` is a plain string and `data` is JSONB, so
adding locations, spells or quests later means adding a template in
`frontend/src/templates/index.ts` — no migration, no API change.

```
id · type · name · summary · body_md · data(jsonb) · image_key · tags[]
knowledge · owner_id → entities.id · quantity · search(tsvector) · timestamps
```

- **knowledge** is `unknown` | `rumoured` | `known`. Players see rumoured and known;
  the DM sees everything. This is enforced in exactly one place —
  `knowledgeFilter()` in `backend/src/routes/entities.ts` — and every read goes
  through it.
- **owner_id** points back at the same table, so "who is carrying this" needs no
  second concept. Null means the party stash.
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
| `GET /api/entities?type=&q=&tag=&owner=` | List. Knowledge-filtered unless DM. `owner=none` is the stash. |
| `GET /api/entities/:id` | 404s for players on sealed entries — a 403 would confirm something is there. |
| `POST /api/entities` | DM only |
| `PUT /api/entities/:id` | DM only, partial |
| `DELETE /api/entities/:id` | DM only |
| `POST /api/uploads/presign` | DM only |
| `POST /api/dm/verify` | Checks a passphrase before the UI stores it |

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
