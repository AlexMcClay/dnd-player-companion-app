import { AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { LuLockOpen } from 'react-icons/lu'
import { useIsDm, usePlayerId } from '../lib/identity'
import { CharacterPicker } from './CharacterPicker'
import DmUnlock from './DmUnlock'
import { ctaClass } from './ui'

/**
 * Stands in front of the app until the viewer says who they are. A character is
 * just a choice stored in this browser — there is no password behind it.
 */
export default function IdentityGate({ children }: { children: ReactNode }) {
  const playerId = usePlayerId()
  const isDm = useIsDm()
  const [dmOpen, setDmOpen] = useState(false)

  // The DM may work without being any particular character.
  if (playerId || isDm) return <>{children}</>

  return (
    <div className="app-ground flex min-h-full flex-col items-center justify-center px-4.5 py-10">
      <div className="flex w-full max-w-105 flex-col gap-4">
        <div className="flex flex-col gap-2 text-center">
          <span className="type-lab">Dessarin Valley</span>
          <h1 className="type-title m-0">Who are you?</h1>
          <p className="type-body m-0">
            Pick your character. This is remembered on this device, and you can change it any time
            from the header.
          </p>
        </div>

        <CharacterPicker />

        <button type="button" className={ctaClass('ghost')} onClick={() => setDmOpen(true)}>
          <LuLockOpen aria-hidden />
          I'm the DM
        </button>
      </div>

      <AnimatePresence>{dmOpen && <DmUnlock onClose={() => setDmOpen(false)} />}</AnimatePresence>
    </div>
  )
}
