-- A character as D&D Beyond last reported it.
--
-- Kept entirely apart from `holdings`: a sync replaces this row whole, so the
-- app's inventory and the D&D Beyond one never have to be reconciled.

CREATE TABLE "ddb_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "ddb_character_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "race" TEXT,
    "classes" JSONB NOT NULL DEFAULT '[]',
    "avatar_url" TEXT,
    "currencies" JSONB NOT NULL DEFAULT '{}',
    "items" JSONB NOT NULL DEFAULT '[]',
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "ddb_snapshots_pkey" PRIMARY KEY ("id")
);

-- One snapshot per character. This is what makes a sync an upsert rather than
-- an ever-growing pile of stale rows.
CREATE UNIQUE INDEX "ddb_snapshots_player_id_key" ON "ddb_snapshots" ("player_id");

ALTER TABLE "ddb_snapshots"
    ADD CONSTRAINT "ddb_snapshots_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "entities" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
