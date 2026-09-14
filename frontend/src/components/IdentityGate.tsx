import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { LuLockOpen } from 'react-icons/lu'
import { api } from '../api/client'
import { setPlayerId, useIsDm, usePlayerId } from '../lib/identity'
import { listVariants, rowVariants, SPRING } from '../lib/motion'
import DmUnlock from './DmUnlock'
import { Empty, Loading, Portrait } from './bits'
import { ctaClass, panelClass } from './ui'

/**
 * Stands in front of the app until the viewer says who they are. A character is
 * just a choice stored in this browser — there is no password behind it.
 */
export default function IdentityGate({ children }: { children: ReactNode }) {
  const playerId = usePlayerId()
  const isDm = useIsDm()

  // The DM may work without being any particular character.
  if (playerId || isDm) return <>{children}</>
  return <CharacterPicker />
}

function CharacterPicker() {
  const queryClient = useQueryClient()
  const [dmOpen, setDmOpen] = useState(false)

  const players = useQuery({
    queryKey: ['entities', { type: 'player' }],
    queryFn: () => api.listEntities({ type: 'player' }),
  })

  async function choose(id: string) {
    setPlayerId(id)
    // No query key carries identity, so everything cached as "nobody" has to go.
    await queryClient.invalidateQueries()
  }

  return (
    <div className="app-ground flex min-h-full flex-col items-center justify-center px-4.5 py-10">
      <div className="flex w-full max-w-105 flex-col gap-4">
        <div className="flex flex-col gap-2 text-center">
          <span className="type-lab">The Marrow Coast</span>
          <h1 className="type-title m-0">Who are you?</h1>
          <p className="type-body m-0">
            Pick your character. This is remembered on this device, and you can change it later.
          </p>
        </div>

        {players.isLoading && <Loading />}
        {players.isError && <Empty>Could not reach the codex. Is the API running?</Empty>}
        {players.data?.length === 0 && <Empty>No characters yet — unlock DM mode to add some</Empty>}

        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {players.data?.map((player) => (
            <motion.button
              key={player.id}
              type="button"
              className={panelClass('flex cursor-pointer flex-col items-center gap-2 text-center')}
              variants={rowVariants}
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              onClick={() => void choose(player.id)}
            >
              <Portrait entity={player} size={72} />
              <span className="type-name">{player.name}</span>
              {player.summary && <span className="type-meta">{player.summary}</span>}
            </motion.button>
          ))}
        </motion.div>

        <button type="button" className={ctaClass('ghost')} onClick={() => setDmOpen(true)}>
          <LuLockOpen aria-hidden />
          I'm the DM
        </button>
      </div>

      <AnimatePresence>{dmOpen && <DmUnlock onClose={() => setDmOpen(false)} />}</AnimatePresence>
    </div>
  )
}
