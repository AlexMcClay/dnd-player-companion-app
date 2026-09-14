import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Holding } from '@codex/shared'
import { motion } from 'framer-motion'
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
  /** Label for the move action, e.g. "To stash". Omitted hides the button. */
  onMove?: { label: string; ownerId: string | null }
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

  return (
    <motion.div className={cx(rowClass, 'flex-wrap')} variants={rowVariants}>
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

      <div className="flex items-center gap-1.5">
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

      {onMove && (
        <motion.button
          type="button"
          className="type-meta w-full cursor-pointer border border-gold-dim py-1.5 text-gold"
          disabled={busy}
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
          onClick={() => move.mutate(onMove.ownerId)}
        >
          {onMove.label}
        </motion.button>
      )}
    </motion.div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="grid size-7 cursor-pointer place-items-center border border-line text-ink-faint disabled:opacity-40 [&>svg]:size-3"
      whileTap={{ scale: 0.9 }}
      transition={SPRING}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}
