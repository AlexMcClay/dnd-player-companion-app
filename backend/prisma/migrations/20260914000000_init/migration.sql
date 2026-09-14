-- Single entities table. `search` is a generated tsvector, which Prisma cannot
-- express in schema.prisma, so this migration is hand-written.

CREATE TABLE "entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "body_md" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "image_key" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "knowledge" TEXT NOT NULL DEFAULT 'unknown',
    "owner_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "entities"
    ADD COLUMN "search" tsvector
    GENERATED ALWAYS AS (
        to_tsvector(
            'english',
            coalesce("name", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("body_md", '')
        )
    ) STORED;

CREATE INDEX "entities_search_idx" ON "entities" USING GIN ("search");
CREATE INDEX "entities_tags_idx" ON "entities" USING GIN ("tags");
CREATE INDEX "entities_type_knowledge_idx" ON "entities" ("type", "knowledge");
CREATE INDEX "entities_owner_id_idx" ON "entities" ("owner_id");
CREATE INDEX "entities_name_idx" ON "entities" ("name");

ALTER TABLE "entities"
    ADD CONSTRAINT "entities_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "entities" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
