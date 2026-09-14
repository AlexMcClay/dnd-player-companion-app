import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Holding } from "@codex/shared";
import { motion } from "framer-motion";
import { useState } from "react";
import type { IconType } from "react-icons";
import { LuCheck, LuMinus, LuPencil, LuPlus, LuTrash2, LuX } from "react-icons/lu";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { rowVariants, SPRING } from "../lib/motion";
import { Portrait } from "./bits";
import { cx, inputClass, rowClass } from "./ui";

/**
 * One stack, with the controls to change it. Quantity edits are optimistic-free
 * — the list refetches — because a stack is small and the round trip is local.
 */
export default function HoldingRow({
  holding,
  onMove,
}: {
  holding: Holding;
  /**
   * Where this stack can be sent, if anywhere. Omitted hides the button.
   *
   * `label` is the accessible name and the tooltip rather than visible text —
   * the button is an icon in the row's control cluster, so the words still have
   * to exist somewhere for anyone not going by the picture.
   */
  onMove?: { label: string; icon: IconType; ownerId: string | null };
}) {
  const queryClient = useQueryClient();
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState(holding.note ?? "");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["holdings"] });

  const setQuantity = useMutation({
    mutationFn: (quantity: number) =>
      quantity <= 0
        ? api.deleteHolding(holding.id)
        : api.updateHolding(holding.id, { quantity }).then(() => undefined),
    onSuccess: invalidate,
  });

  const move = useMutation({
    mutationFn: (ownerId: string | null) =>
      api.updateHolding(holding.id, { ownerId }),
    onSuccess: invalidate,
  });

  const setNote = useMutation({
    mutationFn: (note: string | null) =>
      api.updateHolding(holding.id, { note }),
    onSuccess: async () => {
      await invalidate();
      setEditingNote(false);
    },
  });

  const busy = setQuantity.isPending || move.isPending || setNote.isPending;

  const MoveIcon = onMove?.icon;

  function openEditor() {
    setDraft(holding.note ?? "");
    setEditingNote(true);
  }

  function save() {
    // Blank clears the note rather than storing "", which would leave the stack
    // permanently unmergeable for no visible reason — the API treats a note as
    // the thing that keeps two otherwise identical stacks apart.
    const trimmed = draft.trim();
    setNote.mutate(trimmed === "" ? null : trimmed);
  }

  return (
    <motion.div
      // Only while editing: the editor takes a line of its own, and a row that
      // can wrap the rest of the time is what made stacks two lines tall.
      className={cx(rowClass, editingNote && "flex-wrap")}
      variants={rowVariants}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link to={`/e/${holding.itemId}`} className="shrink-0">
          <Portrait entity={holding.item} size={40} />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={`/e/${holding.itemId}`}
            className="type-name block truncate"
          >
            {holding.item.name}
          </Link>

          {/*
            The second line is the note, and it is also how you edit it — the
            control sits on the thing it changes rather than adding a sixth
            icon to a cluster that already has five.

            The stack's own note wins over the item's generic summary: it is why
            this stack is separate from an otherwise identical one.
          */}
          <button
            type="button"
            title={
              holding.note
                ? "Edit this stack's note"
                : "Add a note about this stack"
            }
            className={cx(
              "type-meta mt-0.5 block w-full cursor-pointer truncate text-left",
              holding.note && "text-gold",
            )}
            onClick={openEditor}
          >
            {holding.note ?? holding.item.summary ?? (
              <span className="inline-flex items-center gap-1 text-ink-muted">
                <LuPencil aria-hidden />
                Add a note
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {/*
          The move used to be a full-width bar below the row, which made every
          stack two lines tall and shouted louder than the item itself. As an
          icon beside the steppers it reads as one more thing you can do to the
          stack, and the row stays one line — which is what lets two of them sit
          side by side on a wide screen.
        */}
        {onMove && MoveIcon && (
          <StepButton
            label={onMove.label}
            tone="gold"
            disabled={busy}
            onClick={() => move.mutate(onMove.ownerId)}
          >
            <MoveIcon aria-hidden />
          </StepButton>
        )}

        <StepButton
          label={`One fewer ${holding.item.name}`}
          disabled={busy}
          onClick={() => setQuantity.mutate(holding.quantity - 1)}
        >
          <LuMinus aria-hidden />
        </StepButton>

        <span className="type-meta w-7 text-center text-ink">
          ×{holding.quantity}
        </span>

        <StepButton
          label={`One more ${holding.item.name}`}
          disabled={busy}
          onClick={() => setQuantity.mutate(holding.quantity + 1)}
        >
          <LuPlus aria-hidden />
        </StepButton>

        <StepButton
          label={`Remove ${holding.item.name}`}
          disabled={busy}
          onClick={() => setQuantity.mutate(0)}
        >
          <LuTrash2 aria-hidden />
        </StepButton>
      </div>

      {editingNote && (
        <form
          className="flex w-full items-center gap-1.5 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <input
            className={cx(inputClass, "min-h-8 py-1.5")}
            value={draft}
            autoFocus
            placeholder="Why this stack is separate…"
            aria-label={`Note on ${holding.item.name}`}
            disabled={setNote.isPending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditingNote(false);
            }}
          />
          <StepButton
            label="Save the note"
            tone="gold"
            disabled={setNote.isPending}
            onClick={save}
            type="submit"
          >
            <LuCheck aria-hidden />
          </StepButton>
          <StepButton
            label="Cancel"
            disabled={setNote.isPending}
            onClick={() => setEditingNote(false)}
          >
            <LuX aria-hidden />
          </StepButton>
        </form>
      )}
    </motion.div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
  tone = "plain",
  type = "button",
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Gold marks the one button that moves the stack somewhere else. */
  tone?: "plain" | "gold";
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      aria-label={label}
      // Same words as the accessible name: an icon-only control needs to be
      // answerable with a hover as well as with a screen reader.
      title={label}
      disabled={disabled}
      className={cx(
        "grid size-7 shrink-0 cursor-pointer place-items-center border disabled:opacity-40 [&>svg]:size-3",
        tone === "gold"
          ? "border-gold-dim bg-gold-tint text-gold"
          : "border-line text-ink-faint",
      )}
      whileTap={{ scale: 0.9 }}
      transition={SPRING}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
