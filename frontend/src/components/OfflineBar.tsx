/**
 * The two things the app has to be able to say about itself once it is
 * installed: that there is no connection, and that a newer build is waiting.
 *
 * Both are slim strips under the header rather than anything modal. Neither is
 * an emergency — one is a fact about the room's wifi, the other an offer — and
 * a dialog over the party board would be worse than the problem.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { LuCloudOff, LuRefreshCw } from 'react-icons/lu'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useIsOnline } from '../lib/useIsOnline'

const STRIP =
  'flex items-center justify-center gap-1.75 px-4 py-1.5 text-[9.5px] uppercase tracking-[0.15em]'

export default function OfflineBar() {
  const online = useIsOnline()

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // The registration lives here rather than in an injected script, so this
    // component is the only thing that knows about the service worker.
    onRegisterError: (error: unknown) => console.error('service worker', error),
  })

  return (
    <AnimatePresence initial={false}>
      {!online && (
        <motion.div
          key="offline"
          className={`${STRIP} border-b border-line bg-tabbar text-ink-faint`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="status"
        >
          <LuCloudOff aria-hidden />
          Offline — you can read, but not write
        </motion.div>
      )}

      {needRefresh && (
        <motion.button
          key="update"
          type="button"
          className={`${STRIP} w-full cursor-pointer border-b border-gold-dim bg-gold-tint text-gold`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          // Takes over and reloads. Deliberately never automatic: someone is
          // probably part-way through writing a note.
          onClick={() => void updateServiceWorker(true)}
        >
          <LuRefreshCw aria-hidden />
          A new version is ready — tap to reload
        </motion.button>
      )}
    </AnimatePresence>
  )
}
