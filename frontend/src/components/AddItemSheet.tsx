import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LuPackage, LuPlus, LuSearch } from 'react-icons/lu'
import { api } from '../api/client'
import { rowVariants, SPRING } from '../lib/motion'
import { Empty, Loading, Portrait, StaggerList } from './bits'
import { cx, ctaClass, inputClass, panelClass, rowClass } from './ui'

/**
 * Pick an item definition from the Codex repository and add a stack of it.
 * Shared by the party stash and a character's pack — only `ownerId` differs.
 */
export default function AddItemSheet({
  ownerId,
  destination,
}: {
  /** Who receives the stack. Null is the party stash. */
  ownerId: string | null
  /** Named in the button and heading, e.g. "the stash" or "Vessa Dunn". */
  destination: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <motion.button
        type="button"
        className={ctaClass('ghost')}
        whileTap={{ scale: 0.98 }}
        transition={SPRING}
        onClick={() => setOpen(true)}
      >
        <LuPlus aria-hidden />
        Add an item
      </motion.button>

      <AnimatePresence>
        {open && (
          <Picker ownerId={ownerId} destination={destination} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

function Picker({
  ownerId,
  destination,
  onClose,
}: {
  ownerId: string | null
  destination: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const items = useQuery({
    queryKey: ['entities', { type: 'item' }],
    queryFn: () => api.listEntities({ type: 'item' }),
  })

  const add = useMutation({
    mutationFn: (itemId: string) => api.createHolding({ itemId, ownerId, quantity: 1 }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holdings'] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const needle = query.trim().toLowerCase()
  const matches = (items.data ?? []).filter((item) =>
    needle ? item.name.toLowerCase().includes(needle) : true,
  )

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 sm:items-center"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        className={panelClass('flex max-h-[80vh] w-full max-w-105 flex-col gap-3')}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={SPRING}
      >
        <div className="type-lab flex items-center gap-1.75">
          <LuPackage aria-hidden />
          Add to {destination}
        </div>

        <div className="relative flex items-center">
          <LuSearch
            className="pointer-events-none absolute left-3.25 size-3.75 text-ink-faint"
            aria-hidden
          />
          <input
            className={cx(inputClass, 'pl-9.5')}
            autoFocus
            value={query}
            placeholder="Search the repository…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {items.isLoading && <Loading />}
        {!items.isLoading && matches.length === 0 && (
          <Empty>
            {needle ? 'Nothing matches' : 'The repository is empty — the DM adds items to it'}
          </Empty>
        )}

        <StaggerList className="-mx-1 flex-1 overflow-y-auto px-1">
          {matches.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              className={cx(rowClass, 'cursor-pointer')}
              variants={rowVariants}
              whileTap={{ scale: 0.985 }}
              transition={SPRING}
              disabled={add.isPending}
              onClick={() => add.mutate(item.id)}
            >
              <Portrait entity={item} size={36} />
              <div className="min-w-0 flex-1">
                <div className="type-name truncate">{item.name}</div>
                {item.summary && <div className="type-meta mt-0.5 truncate">{item.summary}</div>}
              </div>
              <LuPlus className="size-4 text-gold" aria-hidden />
            </motion.button>
          ))}
        </StaggerList>

        {error && <div className="type-meta text-danger">{error}</div>}

        <button type="button" className={ctaClass('ghost')} onClick={onClose}>
          Done
        </button>
      </motion.div>
    </motion.div>
  )
}
