# Ideas

Nice-to-haves for Party Codex, written down so they do not get lost. Nothing here
is committed to. Ordered roughly by value at the table over cost to build.

The `README.md` section **Deferred on purpose** is the short version of why some
of these are not built yet; this file is the longer one.

## Cheap — mostly new templates and existing mechanisms

### Session log as an entity type

A `session` type in `frontend/src/templates/index.ts` with a date and a body. No
migration: `type` is a free string and `data` is JSONB, which is exactly the case
this design was for.

Why it matters more than it looks: recaps written as entries can `[[link]]` to the
NPCs and locations they mention, so an NPC's page can eventually show which
sessions they appeared in. It also gives `frontend/src/lib/aiGuide.ts` somewhere
obvious to put what comes back from pasting session notes into a chat.

### Quests and leads

Same mechanism — a `quest` template with a status (open, done, abandoned) and a
summary card on the Party tab listing the open ones. The design canvas already has
mockups.

### Backlinks on entry pages

"What mentions this?" Either a client-side parse of the bodies already in the
TanStack Query cache, or one `ILIKE '%[[Name]]%'` server-side on `body_md`.

Still no links table — this is the cheap version of the thing the README defers,
and it is what makes a wiki feel like a wiki rather than a list of pages.

### Recently changed

Timestamps are already on every row. A "since you last looked" list on the Party
tab, keyed off a timestamp in browser storage, tells players what the DM revealed
or rewrote between sessions. Knowledge filtering handles itself — a player simply
does not see the sealed rows.

### Give an item to another player

Moving a stack between the stash and a pack is already an `ownerId` change on a
holding. A "give to" action on `HoldingRow`, with a quantity split when the stack
is bigger than what is being handed over, closes the loop for passing potions
around the table without going through the stash.

## Medium — real design work, real payoff

### Per-field reveals

The README defers this and three knowledge states are genuinely enough to start.
But the common case is narrow enough to be worth doing: a monster whose stat block
is known while its weakness stays sealed, an NPC whose name is known while their
faction is not.

A `revealed: string[]` inside `data`, checked in `backend/src/lib/knowledge.ts`
alongside the existing rule so there is still one place the logic lives.

### Recipe discovery

Crafting exists but a recipe is all-or-nothing. Letting the DM reveal reagents one
at a time turns crafting into something the party investigates rather than
something they are handed. Pairs with per-field reveals — likely the same
mechanism.

### A per-character PIN

The README is upfront that a note marked private is private by convention only,
because anyone can send any character's `x-player-id`. A PIN per character, hashed
and checked server-side, is the smallest change that makes the word "private"
true.

Worth doing before the features that lean on it, not after. See the note at the
bottom.

### Campaign timeline

Derived from `session` entries with dates, plus any entity carrying a date. Read
only, sorted, linking back to the entries. Cheap once the session type exists,
which is why it is listed after it.

## Done

- **Print entries as cards.** `/print` picks any number of entries and lays them
  out on A4, ink-light on white. The grid is yours to choose, 2 to 4 columns by
  2 to 6 rows; an entry can span several cells and can print more than one copy.
  Cards are packed to fill holes, and the small ones shed prose rather than
  clipping it. Reached from the Print link on any entry, or opened directly.
  Built 2026-09-22.

## Polish

- **Dice in markdown.** A `{{1d6}}` or roll-table syntax rendered as a tap-to-roll
  chip. Fits in the existing `marked` pipeline in `frontend/src/lib/wikiMarked.ts`.
- **More than one image per entry.** Presigned upload already works; locations and
  NPCs often want a few. Needs a `data` field and a gallery component.
- **Seen-by on party board notes.** A lightweight signal so players know who has
  actually read a lead.

## One ordering caution

Several of these — the PIN, anything leaning on private notes, DM-only reveals —
sit on an identity model that is deliberately not authentication. The README says
to add real auth before this touches the public internet.

If public hosting is ever on the horizon, do the identity work first. Otherwise
the reveal and note features get built twice: once on `x-player-id`, and again on
whatever replaces it.
