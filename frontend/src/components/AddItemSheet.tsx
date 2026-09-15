import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { LuPackage, LuPlus, LuSearch } from 'react-icons/lu'
import { api } from '../api/client'
import { campaignFirst, filterItems, isReference, NO_FILTER, type ItemFilter } from '../lib/itemFacets'
import { rowVariants, SPRING } from '../lib/motion'
import { tokenMatch } from '../lib/textMatch'
import { useAllItems } from '../lib/useAllEntities'
import { Empty, Loading, Portrait } from './bits'
import ItemFilterBar from './ItemFilterBar'
import VirtualList from './VirtualList'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ItemFilter>(NO_FILTER)
  const [error, setError] = useState<string | null>(null)

  const { items, isLoading } = useAllItems()

  const add = useMutation({
    mutationFn: (itemId: string) => api.createHolding({ itemId, ownerId, quantity: 1 }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holdings'] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const needle = query.trim()

  /*
    Name-only, client-side, unlike the codex — and deliberately so. By the time
    you are adding an item you know what it is called, so matching body text
    would bury "Rope, hempen" under every magic item whose rules mention rope.

    Token-AND rather than a substring test, because the books write names
    back-to-front: "Rope, hempen" and "Potion of Healing" both fail `includes`
    for the "hempen rope" and "potion healing" someone actually types.

    The party's own items lead. There is no relevance order to destroy here —
    a token match is a yes or no — and the commonest reason to open this is
    something the party just found.
  */
  const matches = useMemo(() => {
    const named = needle ? items.filter((item) => tokenMatch(item.name, needle)) : items
    return campaignFirst(filterItems(named, filter))
  }, [items, needle, filter])

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

        {/*
          Chips rather than the codex's category grid: a panel capped at 80vh
          has no room for a grid, and you usually know the name of what you are
          adding, so search is the first tool here and the chips only narrow.
        */}
        <ItemFilterBar
          pool={items}
          value={filter}
          onChange={(next) => {
            setFilter(next)
            scrollRef.current?.scrollTo({ top: 0 })
          }}
        />

        {isLoading && <Loading />}
        {!isLoading && matches.length === 0 && <Empty>Nothing matches</Empty>}

        {/* The repository is hundreds of items, so this list scrolls itself
            and only renders what is on screen. */}
        <div ref={scrollRef} className="-mx-1 flex-1 overflow-y-auto px-1">
          <VirtualList
            items={matches}
            scrollRef={scrollRef}
            estimate={58}
            getKey={(item) => item.id}
            renderItem={(item) => (
              <motion.button
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
                  <div className={cx('type-name truncate', !isReference(item) && 'text-gold')}>
                    {item.name}
                  </div>
                  {item.summary && <div className="type-meta mt-0.5 truncate">{item.summary}</div>}
                </div>
                <LuPlus className="size-4 shrink-0 text-gold" aria-hidden />
              </motion.button>
            )}
          />
        </div>

        {error && <div className="type-meta text-danger">{error}</div>}

        <button type="button" className={ctaClass('ghost')} onClick={onClose}>
          Done
        </button>
      </motion.div>
    </motion.div>
  )
}
