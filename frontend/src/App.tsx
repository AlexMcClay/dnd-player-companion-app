import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { EASE, PAGE_TRANSITION } from './lib/motion'
import { useNavDirection } from './lib/useSwipeNav'
import CodexPage from './pages/CodexPage'
import CraftPage from './pages/CraftPage'
import EntityDetailPage from './pages/EntityDetailPage'
import EntityEditPage from './pages/EntityEditPage'
import ItemsPage from './pages/ItemsPage'
import PartyPage from './pages/PartyPage'
import SearchPage from './pages/SearchPage'

/** Sideways for tab-to-tab, a plain crossfade for anything else. */
const SHIFT = 26

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
  const location = useLocation()
  const direction = useNavDirection()

  return (
    // reducedMotion="user" honours the OS setting: transform and layout
    // animation is dropped, opacity fades stay.
    <MotionConfig reducedMotion="user" transition={{ ease: EASE }}>
      <Layout>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: direction * SHIFT }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -SHIFT }}
            transition={PAGE_TRANSITION}
          >
            <ScrollToTop />
            {/*
              AnimatePresence renders the cached outgoing element, so passing
              `location` explicitly keeps it showing the page it came from.
            */}
            <Routes location={location}>
              <Route path="/" element={<Navigate to="/party" replace />} />
              <Route path="/party" element={<PartyPage />} />
              <Route path="/codex" element={<CodexPage />} />
              <Route path="/items" element={<ItemsPage />} />
              <Route path="/craft" element={<CraftPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/e/:id" element={<EntityDetailPage />} />
              <Route path="/e/:id/edit" element={<EntityEditPage />} />
              <Route path="/new" element={<EntityEditPage />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <div className="meta">Nothing here</div>
                  </div>
                }
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Layout>
    </MotionConfig>
  )
}
