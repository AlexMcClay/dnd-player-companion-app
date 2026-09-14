import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { LuChevronLeft, LuLink, LuRefreshCw, LuTriangleAlert } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { DdbItemList, isEmptyPurse, Purse } from '../components/DdbPanel'
import { Empty, Loading, PageHead } from '../components/bits'
import { ctaClass, Panel } from '../components/ui'
import { SPRING } from '../lib/motion'
import { relativeTime } from '../lib/relativeTime'

/**
 * The campaign's shared purse and items from D&D Beyond.
 *
 * Read-only, and deliberately a different screen from the party stash: one is
 * the app's, editable by anyone; this one is a mirror.
 */
export default function DdbPartyPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const party = useQuery({ queryKey: ['ddb', 'party'], queryFn: () => api.getDdbParty() })

  const sync = useMutation({
    mutationFn: () => api.syncDdbParty(),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['ddb', 'party'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const data = party.data
  // D&D Beyond answers 200 with an empty party for a campaign that does not
  // exist, so "nothing at all" is the only hint that the id might be wrong.
  const suspiciouslyEmpty = data ? isEmptyPurse(data.currencies, data.items) : false

  return (
    <>
      <PageHead>
        <motion.button
          type="button"
          className="inline-flex w-fit cursor-pointer items-center gap-1.25 py-1 text-[9.5px] tracking-[0.13em] text-ink-faint uppercase"
          whileTap={{ scale: 0.92 }}
          transition={SPRING}
          onClick={() => navigate(-1)}
        >
          <LuChevronLeft aria-hidden />
          The Party
        </motion.button>

        <h1 className="type-title m-0 flex items-center gap-2">
          <LuLink className="size-5 text-gold" aria-hidden />
          D&amp;D Beyond
        </h1>
        <div className="type-meta">
          {data
            ? `${data.campaignName ?? 'Campaign'} · ${data.campaignId} · synced ${relativeTime(data.syncedAt)}`
            : 'The shared party inventory'}
        </div>
      </PageHead>

      <div className="flex flex-col gap-4">
        {party.isLoading ? (
          <Loading />
        ) : data ? (
          <>
            {suspiciouslyEmpty && (
              <Panel className="flex items-start gap-2">
                <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                <span className="type-body">
                  D&amp;D Beyond reports no coin and no items for campaign{' '}
                  <strong>{data.campaignId}</strong>. That is what an unknown campaign id looks
                  like too — it answers normally rather than erroring. Worth checking the id if
                  your party is not genuinely empty.
                </span>
              </Panel>
            )}

            <Purse currencies={data.currencies} />
            <DdbItemList items={data.items} label="Party items on D&D Beyond" />
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
      </div>
    </>
  )
}
