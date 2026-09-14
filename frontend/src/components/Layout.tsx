import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { LuLock, LuLockOpen } from 'react-icons/lu'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import { useIsDm, usePlayerId } from '../lib/identity'
import { SPRING } from '../lib/motion'
import { useSwipeNav } from '../lib/useSwipeNav'
import { TABS } from '../templates'
import DmUnlock from './DmUnlock'
import { PillButton } from './ui'

export default function Layout({ children }: { children: ReactNode }) {
  const isDm = useIsDm()
  const playerId = usePlayerId()
  const [unlockOpen, setUnlockOpen] = useState(false)
  const onPanEnd = useSwipeNav()

  const me = useQuery({
    queryKey: ['entity', playerId],
    queryFn: () => api.getEntity(playerId!),
    enabled: playerId !== null,
  })

  return (
    <div className="app-ground flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-topbar">
        <div className="mx-auto flex max-w-195 items-center justify-between gap-3 px-4.5 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="type-lab">The Marrow Coast</span>
            {me.data && <span className="type-meta truncate">Playing {me.data.name}</span>}
          </div>
          <PillButton tone={isDm ? 'solid' : 'neutral'} onClick={() => setUnlockOpen(true)}>
            {isDm ? <LuLockOpen aria-hidden /> : <LuLock aria-hidden />}
            {isDm ? 'DM mode' : 'Locked'}
          </PillButton>
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

      <AnimatePresence>
        {unlockOpen && <DmUnlock onClose={() => setUnlockOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
