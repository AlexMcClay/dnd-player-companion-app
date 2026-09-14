import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { LuCheck, LuUserRoundCog } from 'react-icons/lu'
import { api } from '../api/client'
import { setPlayerId, useIsDm, usePlayerId } from '../lib/identity'
import { rowVariants, SPRING } from '../lib/motion'
import { Empty, Loading, Portrait, StaggerList } from './bits'
import { ctaClass, cx, panelClass } from './ui'

/**
 * Switching identity in one place, so the cache invalidation cannot be
 * forgotten: no query key carries the player id, so everything fetched as the
 * previous character has to be thrown away.
 */
export function useChooseCharacter(): (id: string | null) => Promise<void> {
  const queryClient = useQueryClient()
  return async (id: string | null) => {
    setPlayerId(id)
    await queryClient.invalidateQueries()
  }
}

/** Portrait grid of the party. Used on the startup gate, the Me tab and the header. */
export function CharacterPicker({ onPicked }: { onPicked?: () => void }) {
  const currentId = usePlayerId()
  const choose = useChooseCharacter()

  const players = useQuery({
    queryKey: ['entities', { type: 'player' }],
    queryFn: () => api.listEntities({ type: 'player' }),
  })

  if (players.isLoading) return <Loading />
  if (players.isError) return <Empty>Could not reach the codex. Is the API running?</Empty>
  if (players.data?.length === 0) {
    return <Empty>No characters yet — unlock DM mode to add some</Empty>
  }

  async function pick(id: string) {
    await choose(id)
    onPicked?.()
  }

  return (
    <StaggerList className="grid grid-cols-2 gap-3">
      {players.data?.map((player) => {
        const isCurrent = player.id === currentId
        return (
          <motion.button
            key={player.id}
            type="button"
            className={panelClass(
              cx(
                'flex cursor-pointer flex-col items-center gap-2 text-center',
                isCurrent && 'border-gold',
              ),
            )}
            variants={rowVariants}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            onClick={() => void pick(player.id)}
          >
            <Portrait entity={player} size={72} />
            <span className="type-name">{player.name}</span>
            {isCurrent ? (
              <span className="type-meta flex items-center gap-1 text-gold">
                <LuCheck aria-hidden />
                Playing
              </span>
            ) : (
              player.summary && <span className="type-meta">{player.summary}</span>
            )}
          </motion.button>
        )
      })}
    </StaggerList>
  )
}

/** The picker in a modal, for switching mid-session. */
export function CharacterSwitcher({ onClose }: { onClose: () => void }) {
  const isDm = useIsDm()
  const currentId = usePlayerId()
  const choose = useChooseCharacter()

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-5"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        className={panelClass('flex max-h-[85vh] w-full max-w-105 flex-col gap-3 overflow-y-auto')}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={SPRING}
      >
        <div className="type-lab flex items-center gap-1.75">
          <LuUserRoundCog aria-hidden />
          Who is playing?
        </div>

        <CharacterPicker onPicked={onClose} />

        {/* Only the DM has anywhere useful to be without a character. */}
        {isDm && currentId && (
          <button
            type="button"
            className={ctaClass('ghost')}
            onClick={() => void choose(null).then(onClose)}
          >
            Browse as DM only
          </button>
        )}

        <button type="button" className={ctaClass('ghost')} onClick={onClose}>
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}

/** Convenience wrapper so callers do not repeat the AnimatePresence. */
export function CharacterSwitcherPortal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return <AnimatePresence>{open && <CharacterSwitcher onClose={onClose} />}</AnimatePresence>
}
