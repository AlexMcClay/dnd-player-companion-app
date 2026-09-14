import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { LuLock, LuLockOpen } from 'react-icons/lu'
import { NavLink } from 'react-router-dom'
import { useIsDm } from '../lib/dm'
import { SPRING } from '../lib/motion'
import { useSwipeNav } from '../lib/useSwipeNav'
import { TABS } from '../templates'
import DmUnlock from './DmUnlock'

export default function Layout({ children }: { children: ReactNode }) {
  const isDm = useIsDm()
  const [unlockOpen, setUnlockOpen] = useState(false)
  const onPanEnd = useSwipeNav()

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">The Marrow Coast</span>
          <motion.button
            type="button"
            className={isDm ? 'pill pill-s with-icon' : 'pill pill-n with-icon'}
            onClick={() => setUnlockOpen(true)}
            whileTap={{ scale: 0.94 }}
            transition={SPRING}
          >
            {isDm ? <LuLockOpen aria-hidden /> : <LuLock aria-hidden />}
            {isDm ? 'DM mode' : 'Locked'}
          </motion.button>
        </div>
      </header>

      {/*
        pan-y lets the browser keep vertical scrolling while framer sees the
        horizontal gesture. onPanEnd only reads the gesture — nothing is dragged.
      */}
      <motion.main className="app-main" style={{ touchAction: 'pan-y' }} onPanEnd={onPanEnd}>
        {children}
      </motion.main>

      <nav className="tabbar">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) => (isActive ? 'tab on' : 'tab')}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-indicator"
                      className="tab-indicator"
                      transition={SPRING}
                    />
                  )}
                  <motion.span
                    className="tab-icon"
                    animate={{ scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }}
                    transition={SPRING}
                  >
                    <Icon aria-hidden />
                  </motion.span>
                  <span className="tab-label">{tab.label}</span>
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
