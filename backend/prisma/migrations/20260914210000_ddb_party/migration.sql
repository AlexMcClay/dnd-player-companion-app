-- The campaign's shared coin and items from D&D Beyond.
--
-- No foreign key: the party is not an entity. Kept apart from `holdings` for
-- the same reason as ddb_snapshots — a sync replaces this row whole, so the
-- mirror and the app's own party stash never need reconciling.

CREATE TABLE "ddb_party_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" TEXT NOT NULL,
    "campaign_name" TEXT,
    "currencies" JSONB NOT NULL DEFAULT '{}',
    "items" JSONB NOT NULL DEFAULT '[]',
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "ddb_party_snapshots_pkey" PRIMARY KEY ("id")
);

-- One snapshot per campaign, which is what makes a sync an upsert.
CREATE UNIQUE INDEX "ddb_party_snapshots_campaign_id_key"
    ON "ddb_party_snapshots" ("campaign_id");
