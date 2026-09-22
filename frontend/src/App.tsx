import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import IdentityGate from './components/IdentityGate'
import Layout from './components/Layout'
import { EASE, pageVariants } from './lib/motion'
import { useNavDirection } from './lib/useSwipeNav'
import CodexPage from './pages/CodexPage'
import DdbPartyPage from './pages/DdbPartyPage'
import DmPage from './pages/DmPage'
import CraftPage from './pages/CraftPage'
import EntityDetailPage from './pages/EntityDetailPage'
import EntityEditPage from './pages/EntityEditPage'
import MePage from './pages/MePage'
import PartyPage from './pages/PartyPage'
import PrintPage from './pages/PrintPage'
import SearchPage from './pages/SearchPage'
import StashPage from './pages/StashPage'

/**
 * Mounts with the incoming page. Resetting scroll on the location change
 * instead would yank the outgoing page to the top mid-fade.
 */
function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])
  return null
}

export default function App() {
  return (
    // reducedMotion="user" honours the OS setting: transform and layout
    // animation is dropped, opacity fades stay.
    <MotionConfig reducedMotion="user" transition={{ ease: EASE }}>
      <IdentityGate>
        {/*
          The print sheet is the one route outside the app chrome.

          Layout is sticky, full-height and dark, and AnimatePresence writes an
          inline `opacity: 0` that a print stylesheet cannot override without an
          !important on every animated node. Both have to be above the split
          rather than hidden by a media query. IdentityGate stays above it:
          knowledge filtering reads the chosen character.
        */}
        <Routes>
          <Route path="/print" element={<PrintPage />} />
          <Route path="*" element={<AppShell />} />
        </Routes>
      </IdentityGate>
    </MotionConfig>
  )
}

/** Every route that wears the app's chrome, which is all but one. */
function AppShell() {
  const location = useLocation()
  const direction = useNavDirection()

  return (
    <Layout>
      {/*
        `custom` on the AnimatePresence is what makes the exit directional.
        Without it the outgoing page animates with the direction from the
        previous navigation, because AnimatePresence re-renders the element
        it cached rather than a fresh one.
      */}
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <ScrollToTop />
          {/*
            AnimatePresence renders the cached outgoing element, so passing
            `location` explicitly keeps it showing the page it came from.
          */}
          <Routes location={location}>
            <Route path="/" element={<Navigate to="/party" replace />} />
            <Route path="/party" element={<PartyPage />} />
            {/* Own screens so neither inventory can bury the Party tab. */}
            <Route path="/party/stash" element={<StashPage />} />
            <Route path="/party/ddb" element={<DdbPartyPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/codex" element={<CodexPage />} />
            {/* The Items tab folded into Party and Me; keep old links alive. */}
            <Route path="/items" element={<Navigate to="/party" replace />} />
            <Route path="/craft" element={<CraftPage />} />
            <Route path="/search" element={<SearchPage />} />
            {/* DM-only, and gated by the page itself rather than the route:
                every other route here is public too. */}
            <Route path="/dm" element={<DmPage />} />
            <Route path="/e/:id" element={<EntityDetailPage />} />
            <Route path="/e/:id/edit" element={<EntityEditPage />} />
            <Route path="/new" element={<EntityEditPage />} />
            <Route
              path="*"
              element={
                <div className="px-3 py-10 text-center">
                  <div className="type-meta">Nothing here</div>
                </div>
              }
            />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Layout>
  )
}
