import { useQuery } from '@tanstack/react-query'
import { STASH } from '@codex/shared'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { LuChevronLeft, LuSearch, LuVault, LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import AddItemSheet from '../components/AddItemSheet'
import HoldingRow from '../components/HoldingRow'
import { Empty, Loading, PageHead, StaggerList } from '../components/bits'
import { cx, inputClass } from '../components/ui'
import { usePlayerId } from '../lib/identity'
import { SPRING } from '../lib/motion'

/**
 * Everything the party owns collectively, on its own screen. It lives here
 * rather than inline on the Party tab because a real campaign's stash is long
 * enough to bury everything below it.
 */
export default function StashPage() {
  const navigate = useNavigate()
  const playerId = usePlayerId()
  const [filter, setFilter] = useState('')

  const stash = useQuery({
    queryKey: ['holdings', { owner: STASH }],
    queryFn: () => api.listHoldings({ owner: STASH }),
  })

  const stacks = stash.data ?? []
  const total = stacks.reduce((sum, holding) => sum + holding.quantity, 0)

  // Filtering client-side: the whole stash is already loaded, and a name match
  // is what people mean when they type into a bag.
  const needle = filter.trim().toLowerCase()
  const shown = needle
    ? stacks.filter((holding) => holding.item.name.toLowerCase().includes(needle))
    : stacks

  return (
    <>
      <PageHead>
        <motion.button
          type="button"
          className="inline-flex w-fit cursor-pointer items-center gap-1.25 py-1 text-[9.5px] uppercase tracking-[0.13em] text-ink-faint"
          whileTap={{ scale: 0.92 }}
          transition={SPRING}
          onClick={() => navigate(-1)}
        >
          <LuChevronLeft aria-hidden />
          The Party
        </motion.button>

        <h1 className="type-title m-0 flex items-center gap-2">
          <LuVault className="size-6 text-gold" aria-hidden />
          Party stash
        </h1>
        <div className="type-meta">
          {stacks.length} entries · {total} items
        </div>

        {stacks.length > 0 && (
          <div className="relative flex items-center">
            <LuSearch
              className="pointer-events-none absolute left-3.25 size-3.75 text-ink-faint"
              aria-hidden
            />
            <input
              className={cx(inputClass, 'pl-9.5', filter && 'pr-10')}
              type="search"
              value={filter}
              placeholder="Find something in the stash…"
              onChange={(e) => setFilter(e.target.value)}
            />
            {filter && (
              <button
                type="button"
                aria-label="Clear filter"
                className="absolute right-3 grid size-5 cursor-pointer place-items-center text-ink-faint"
                onClick={() => setFilter('')}
              >
                <LuX aria-hidden />
              </button>
            )}
          </div>
        )}
      </PageHead>

      <div className="flex flex-col gap-4">
        {stash.isLoading ? (
          <Loading />
        ) : (
          <StaggerList>
            {shown.map((holding) => (
              <HoldingRow
                key={holding.id}
                holding={holding}
                // Anyone browsing as a character can pull from the stash.
                onMove={playerId ? { label: 'Take it', ownerId: playerId } : undefined}
              />
            ))}
          </StaggerList>
        )}

        {!stash.isLoading && stacks.length === 0 && <Empty>The stash is empty</Empty>}
        {!stash.isLoading && stacks.length > 0 && shown.length === 0 && (
          <Empty>Nothing in the stash matches “{filter}”</Empty>
        )}

        <AddItemSheet ownerId={null} destination="the party stash" />
      </div>
    </>
  )
}
