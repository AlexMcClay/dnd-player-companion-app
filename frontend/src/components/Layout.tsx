import type { ReactNode } from 'react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useIsDm } from '../lib/dm'
import { TABS } from '../templates'
import DmUnlock from './DmUnlock'

export default function Layout({ children }: { children: ReactNode }) {
  const isDm = useIsDm()
  const [unlockOpen, setUnlockOpen] = useState(false)

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">The Marrow Coast</span>
          <button
            type="button"
            className={isDm ? 'pill pill-s' : 'pill pill-n'}
            onClick={() => setUnlockOpen(true)}
          >
            {isDm ? 'DM mode' : 'Locked'}
          </button>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <nav className="tabbar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => (isActive ? 'tab on' : 'tab')}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {unlockOpen && <DmUnlock onClose={() => setUnlockOpen(false)} />}
    </div>
  )
}
