-- Split item definitions from item holdings.
--
-- Entities of type 'item' become pure definitions (the Codex repository) and a
-- holdings row records who carries how many. Copies before it drops, so the
-- table's current inventory survives intact.

CREATE TABLE "holdings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "owner_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "holdings_owner_id_idx" ON "holdings" ("owner_id");
CREATE INDEX "holdings_item_id_idx" ON "holdings" ("item_id");

ALTER TABLE "holdings"
    ADD CONSTRAINT "holdings_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "entities" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "holdings"
    ADD CONSTRAINT "holdings_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "entities" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing item row is an instance, so one holding each preserves the
-- current state exactly while the entity row stays behind as the definition.
INSERT INTO "holdings" ("item_id", "owner_id", "quantity")
SELECT "id", "owner_id", "quantity"
FROM "entities"
WHERE "type" = 'item';

-- owner_id and quantity existed only to express item ownership, which holdings
-- now owns. Keeping them would leave two answers to the same question.
DROP INDEX IF EXISTS "entities_owner_id_idx";
ALTER TABLE "entities" DROP CONSTRAINT IF EXISTS "entities_owner_id_fkey";
ALTER TABLE "entities" DROP COLUMN "owner_id";
ALTER TABLE "entities" DROP COLUMN "quantity";
