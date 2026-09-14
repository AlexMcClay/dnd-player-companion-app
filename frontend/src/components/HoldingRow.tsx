import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Holding } from '@codex/shared'
import { motion } from 'framer-motion'
import type { IconType } from 'react-icons'
import { LuMinus, LuPlus, LuTrash2 } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { rowVariants, SPRING } from '../lib/motion'
import { Portrait } from './bits'
import { cx, rowClass } from './ui'

/**
 * One stack, with the controls to change it. Quantity edits are optimistic-free
 * — the list refetches — because a stack is small and the round trip is local.
 */
export default function HoldingRow({
  holding,
  onMove,
}: {
  holding: Holding
  /**
   * Where this stack can be sent, if anywhere. Omitted hides the button.
   *
   * `label` is the accessible name and the tooltip rather than visible text —
   * the button is an icon in the row's control cluster, so the words still have
   * to exist somewhere for anyone not going by the picture.
   */
  onMove?: { label: string; icon: IconType; ownerId: string | null }
}) {
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['holdings'] })

  const setQuantity = useMutation({
    mutationFn: (quantity: number) =>
      quantity <= 0
        ? api.deleteHolding(holding.id)
        : api.updateHolding(holding.id, { quantity }).then(() => undefined),
    onSuccess: invalidate,
  })

  const move = useMutation({
    mutationFn: (ownerId: string | null) => api.updateHolding(holding.id, { ownerId }),
    onSuccess: invalidate,
  })

  const busy = setQuantity.isPending || move.isPending

  const MoveIcon = onMove?.icon

  return (
    <motion.div className={rowClass} variants={rowVariants}>
      <Link to={`/e/${holding.itemId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Portrait entity={holding.item} size={40} />
        <div className="min-w-0 flex-1">
          <div className="type-name truncate">{holding.item.name}</div>
          {/*
            The stack's own note wins over the item's generic summary: it is why
            this stack is separate from an otherwise identical one.
          */}
          {holding.note ? (
            <div className="type-meta mt-0.5 truncate text-gold">{holding.note}</div>
          ) : (
            holding.item.summary && (
              <div className="type-meta mt-0.5 truncate">{holding.item.summary}</div>
            )
          )}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5">
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

        <span className="type-meta w-7 text-center text-ink">×{holding.quantity}</span>

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

    </motion.div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
  tone = 'plain',
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
  /** Gold marks the one button that moves the stack somewhere else. */
  tone?: 'plain' | 'gold'
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      // Same words as the accessible name: an icon-only control needs to be
      // answerable with a hover as well as with a screen reader.
      title={label}
      disabled={disabled}
      className={cx(
        'grid size-7 cursor-pointer place-items-center border disabled:opacity-40 [&>svg]:size-3',
        tone === 'gold' ? 'border-gold-dim bg-gold-tint text-gold' : 'border-line text-ink-faint',
      )}
      whileTap={{ scale: 0.9 }}
      transition={SPRING}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}
