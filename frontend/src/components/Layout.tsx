import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { LuChevronDown, LuLock, LuLockOpen, LuUser } from 'react-icons/lu'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import { useIsDm, usePlayerId } from '../lib/identity'
import { SPRING } from '../lib/motion'
import { useSwipeNav } from '../lib/useSwipeNav'
import { TABS } from '../templates'
import { CharacterSwitcherPortal } from './CharacterPicker'
import DmUnlock from './DmUnlock'
import { Portrait } from './bits'
import { cx, PillButton } from './ui'

export default function Layout({ children }: { children: ReactNode }) {
  const isDm = useIsDm()
  const playerId = usePlayerId()
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const onPanEnd = useSwipeNav()

  const me = useQuery({
    queryKey: ['entity', playerId],
    queryFn: () => api.getEntity(playerId!),
    enabled: playerId !== null,
  })

  return (
    <div className="app-ground flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-topbar">
        <div className="mx-auto flex max-w-195 items-center justify-between gap-2 px-4.5 py-2.5">
          <span className="type-lab shrink-0">Dessarin Valley</span>

          <div className="flex min-w-0 items-center gap-2">
            <CharacterButton
              character={me.data ?? null}
              onClick={() => setSwitchOpen(true)}
            />
            <PillButton
              tone={isDm ? 'solid' : 'neutral'}
              aria-label={isDm ? 'DM mode is on' : 'Unlock DM mode'}
              onClick={() => setUnlockOpen(true)}
            >
              {isDm ? <LuLockOpen aria-hidden /> : <LuLock aria-hidden />}
              <span className="hidden sm:inline">{isDm ? 'DM mode' : 'Locked'}</span>
            </PillButton>
          </div>
        </div>
      </header>

      {/*
        pan-y lets the browser keep vertical scrolling while framer sees the
        horizontal gesture. onPanEnd only reads it — nothing is dragged.
      */}
      <motion.main
        className="main-pad mx-auto w-full max-w-195 flex-1 touch-pan-y px-4.5"
        onPanEnd={onPanEnd}
      >
        {children}
      </motion.main>

      {/* Columns derived from TABS so adding a tab cannot silently wreck the bar. */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-tabbar"
        style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `relative flex cursor-pointer flex-col items-center gap-1 px-0.5 pt-2.5 pb-3.25 text-[9.5px] uppercase tracking-[0.15em] ${
                  isActive ? 'text-gold' : 'text-ink-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-indicator"
                      className="absolute inset-x-[18%] top-0 h-0.5 bg-gold"
                      transition={SPRING}
                    />
                  )}
                  <motion.span
                    className="grid place-items-center text-[17px] leading-none"
                    animate={{ scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }}
                    transition={SPRING}
                  >
                    <Icon aria-hidden />
                  </motion.span>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <CharacterSwitcherPortal open={switchOpen} onClose={() => setSwitchOpen(false)} />

      <AnimatePresence>
        {unlockOpen && <DmUnlock onClose={() => setUnlockOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}

/**
 * Shows who you are playing and swaps them. Falls back to a prompt when nobody
 * is chosen, which only happens for a DM browsing without a character.
 */
function CharacterButton({
  character,
  onClick,
}: {
  character: { id: string; name: string; type: string; imageUrl: string | null } | null
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={character ? `Playing ${character.name}. Change character` : 'Pick a character'}
      className={cx(
        'flex min-w-0 cursor-pointer items-center gap-1.75 rounded-full border py-1 pr-2 pl-1',
        character ? 'border-gold-dim text-gold' : 'border-line text-ink-soft',
      )}
      whileTap={{ scale: 0.94 }}
      transition={SPRING}
    >
      {character ? (
        <Portrait entity={character} size={20} className="rounded-full" />
      ) : (
        <span className="grid size-5 place-items-center">
          <LuUser aria-hidden />
        </span>
      )}
      <span className="truncate text-[9.5px] uppercase tracking-[0.11em]">
        {character ? (character.name.split(' ')[0] ?? character.name) : 'Pick one'}
      </span>
      <LuChevronDown className="size-3 shrink-0 opacity-70" aria-hidden />
    </motion.button>
  )
}
