-- Player-authored notes, in three places: pinned to a codex entry, in a
-- personal vault, or on the party board.
--
-- `placement` is where a note lives, `visibility` is who may read it. They are
-- independent, so a vault note can be shared and an entry note can be private.

CREATE TABLE "notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_id" UUID NOT NULL,
    "subject_id" UUID,
    "placement" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'shared',
    "title" TEXT,
    "body_md" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- A subject is exactly what makes a note an entry note, so the two must agree
-- or the vault and the board become indistinguishable.
ALTER TABLE "notes"
    ADD CONSTRAINT "notes_placement_subject_check"
    CHECK (("placement" = 'entry') = ("subject_id" IS NOT NULL));

ALTER TABLE "notes"
    ADD CONSTRAINT "notes_placement_values_check"
    CHECK ("placement" IN ('entry', 'vault', 'party'));

ALTER TABLE "notes"
    ADD CONSTRAINT "notes_visibility_values_check"
    CHECK ("visibility" IN ('private', 'shared'));

-- A private note on a shared board is a contradiction.
ALTER TABLE "notes"
    ADD CONSTRAINT "notes_party_is_shared_check"
    CHECK ("placement" <> 'party' OR "visibility" = 'shared');

CREATE INDEX "notes_subject_id_idx" ON "notes" ("subject_id");
CREATE INDEX "notes_author_id_idx" ON "notes" ("author_id");
CREATE INDEX "notes_placement_visibility_idx" ON "notes" ("placement", "visibility");

ALTER TABLE "notes"
    ADD CONSTRAINT "notes_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "entities" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notes"
    ADD CONSTRAINT "notes_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "entities" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
