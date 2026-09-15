import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { LuPackage, LuPlus, LuSearch } from 'react-icons/lu'
import { api } from '../api/client'
import { filterItems, NO_FILTER, shelfOf, type ItemFilter, type Shelf } from '../lib/itemFacets'
import { rowVariants, SPRING } from '../lib/motion'
import { tokenMatch } from '../lib/textMatch'
import { useAllItems } from '../lib/useAllEntities'
import { Empty, Loading, Portrait } from './bits'
import ItemFilterBar, { ShelfChips } from './ItemFilterBar'
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
  const [shelf, setShelf] = useState<Shelf>('campaign')
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

  const counts = useMemo(
    () => ({
      campaign: items.filter((item) => shelfOf(item) === 'campaign').length,
      reference: items.filter((item) => shelfOf(item) === 'reference').length,
    }),
    [items],
  )

  const needle = query.trim()
  const pool = useMemo(() => items.filter((item) => shelfOf(item) === shelf), [items, shelf])

  /*
    Name-only, client-side, unlike the codex — and deliberately so. By the time
    you are adding an item you know what it is called, so matching body text
    would bury "Rope, hempen" under every magic item whose rules mention rope.

    Token-AND rather than a substring test, because the books write names
    back-to-front: "Rope, hempen" and "Potion of Healing" both fail `includes`
    for the "hempen rope" and "potion healing" someone actually types.
  */
  const matches = useMemo(() => {
    const named = needle ? pool.filter((item) => tokenMatch(item.name, needle)) : pool
    return shelf === 'reference' ? filterItems(named, filter) : named
  }, [pool, needle, shelf, filter])

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
          A drill-down does not fit a panel capped at 80vh, and adding "Rope,
          hempen" to the stash needs the reference constantly — so the shelf is
          two chips here rather than a door. Same split, same default.
        */}
        <ShelfChips
          value={shelf}
          counts={counts}
          onChange={(next) => {
            setShelf(next)
            setFilter(NO_FILTER)
            scrollRef.current?.scrollTo({ top: 0 })
          }}
        />

        {shelf === 'reference' && (
          <ItemFilterBar
            pool={pool}
            value={filter}
            onChange={(next) => {
              setFilter(next)
              scrollRef.current?.scrollTo({ top: 0 })
            }}
          />
        )}

        {isLoading && <Loading />}
        {!isLoading && matches.length === 0 && (
          <Empty>
            {needle ? 'Nothing matches' : 'The repository is empty — the DM adds items to it'}
          </Empty>
        )}

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
                  <div className="type-name truncate">{item.name}</div>
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
