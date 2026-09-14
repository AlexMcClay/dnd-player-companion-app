import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DdbCurrencies, DdbItem } from '@codex/shared'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { LuCoins, LuRefreshCw, LuSwords, LuTriangleAlert } from 'react-icons/lu'
import { api } from '../api/client'
import { useIsDm, usePlayerId } from '../lib/identity'
import { rowVariants, SPRING } from '../lib/motion'
import { relativeTime } from '../lib/relativeTime'
import { Empty, Loading, SectionHead, StaggerList } from './bits'
import { cx, ctaClass, Panel, panelClass, Pill, rowClass } from './ui'

/** Largest denominations first — gold is what anyone actually asks about. */
const COIN_ORDER: Array<[keyof DdbCurrencies, string]> = [
  ['pp', 'pp'],
  ['gp', 'gp'],
  ['ep', 'ep'],
  ['sp', 'sp'],
  ['cp', 'cp'],
]

/**
 * The character as D&D Beyond last reported it.
 *
 * Read-only by design. This inventory is a mirror, kept deliberately apart from
 * the app's own holdings so the two can never disagree — the app writes to one,
 * D&D Beyond owns the other.
 */
export default function DdbPanel({
  playerId,
  characterName,
}: {
  playerId: string
  /** The app's name for them, to compare against D&D Beyond's. */
  characterName: string
}) {
  const queryClient = useQueryClient()
  const isDm = useIsDm()
  const myId = usePlayerId()
  const [error, setError] = useState<string | null>(null)

  const canSync = isDm || myId === playerId

  const snapshot = useQuery({
    queryKey: ['ddb', playerId],
    queryFn: () => api.getDdb(playerId),
  })

  const sync = useMutation({
    mutationFn: () => api.syncDdb(playerId),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['ddb', playerId] })
      // The sheet fields and the avatar changed too.
      await queryClient.invalidateQueries({ queryKey: ['entity', playerId] })
      await queryClient.invalidateQueries({ queryKey: ['entities'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  if (snapshot.isLoading) return <Loading />

  const data = snapshot.data

  return (
    <div className="flex flex-col gap-2">
      {data ? (
        <>
          <div className="type-meta">Synced {relativeTime(data.syncedAt)}</div>

          {data.name !== characterName && (
            <Panel className="flex items-start gap-2">
              <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <span className="type-body">
                D&amp;D Beyond calls this character <strong>{data.name}</strong>. The app keeps its
                own name so links in your notes keep working — rename it here if you want them to
                match.
              </span>
            </Panel>
          )}

          <Purse currencies={data.currencies} />
          <Inventory items={data.items} />
        </>
      ) : (
        <Empty>Not synced yet</Empty>
      )}

      {error && (
        <motion.div
          className="type-meta flex items-center gap-1.75 text-danger"
          animate={{ x: [0, -6, 6, -4, 4, 0] }}
          transition={{ duration: 0.35 }}
        >
          <LuTriangleAlert aria-hidden />
          {error}
        </motion.div>
      )}

      {canSync && (
        <motion.button
          type="button"
          className={ctaClass('ghost')}
          disabled={sync.isPending}
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          onClick={() => sync.mutate()}
        >
          <motion.span
            className="grid place-items-center"
            animate={sync.isPending ? { rotate: 360 } : { rotate: 0 }}
            transition={
              sync.isPending ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }
            }
          >
            <LuRefreshCw aria-hidden />
          </motion.span>
          {sync.isPending ? 'Syncing…' : data ? 'Sync again' : 'Sync from D&D Beyond'}
        </motion.button>
      )}
    </div>
  )
}

function Purse({ currencies }: { currencies: DdbCurrencies }) {
  const coins = COIN_ORDER.filter(([key]) => (currencies[key] ?? 0) > 0)

  return (
    <div className={panelClass('flex items-center gap-3')}>
      <span className="grid size-9 shrink-0 place-items-center border border-gold-dim bg-gold-tint text-gold">
        <LuCoins className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="type-lab">Purse</div>
        <div className="type-name mt-0.75">
          {coins.length === 0
            ? 'Empty'
            : coins.map(([key, label]) => `${currencies[key]} ${label}`).join(' · ')}
        </div>
      </div>
    </div>
  )
}

function Inventory({ items }: { items: DdbItem[] }) {
  if (items.length === 0) return <Empty>No items on D&amp;D Beyond</Empty>

  const carried = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="flex flex-col gap-2">
      <SectionHead label="Carried on D&D Beyond" note={`${items.length} entries · ${carried}`} />
      <StaggerList>
        {items.map((item, i) => (
          <motion.div
            // D&D Beyond happily lists the same item twice (two daggers), so
            // the index is part of the identity here.
            key={`${item.name}-${i}`}
            className={cx(rowClass, 'gap-2')}
            variants={rowVariants}
          >
            <span className="grid size-7 shrink-0 place-items-center border border-line text-ink-faint">
              <LuSwords className="size-3" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <div className="type-name truncate">{item.name}</div>
              <div className="type-meta mt-0.5 truncate">
                {[item.type, item.rarity !== 'Common' ? item.rarity : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {item.attuned && <Pill tone="solid">Attuned</Pill>}
              {item.equipped && !item.attuned && <Pill tone="neutral">Worn</Pill>}
              {item.quantity > 1 && <span className="type-meta">×{item.quantity}</span>}
            </div>
          </motion.div>
        ))}
      </StaggerList>
    </div>
  )
}
