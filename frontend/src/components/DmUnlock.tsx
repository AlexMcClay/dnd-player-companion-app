import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { LuLock, LuLockOpen, LuTriangleAlert, LuWrench } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { setDmKey, useIsDm } from '../lib/identity'
import { SPRING } from '../lib/motion'
import { Cta, ctaClass, inputClass, panelClass } from './ui'

export default function DmUnlock({ onClose }: { onClose: () => void }) {
  const isDm = useIsDm()
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setError(null)
    // Verified server-side first so a typo doesn't leave the UI in a state
    // where every write silently 401s.
    //
    // A rejection is reported as itself rather than folded into "not accepted":
    // being offline and being wrong are different problems, and telling someone
    // their correct passphrase was refused sends them looking in the wrong place.
    let ok = false
    try {
      ok = await api.verifyDmKey(value)
    } catch (err) {
      setChecking(false)
      setError(err instanceof Error ? err.message : 'Could not reach the server.')
      return
    }
    setChecking(false)
    if (!ok) {
      setError('That passphrase was not accepted.')
      return
    }
    setDmKey(value)
    await queryClient.invalidateQueries()
    onClose()
  }

  function lock() {
    setDmKey(null)
    void queryClient.invalidateQueries()
    // "Lock up before handing the phone to a player" has to be true of what is
    // stored offline as well as what is on screen — the service worker keeps a
    // copy of everything the DM read, sealed entries included.
    navigator.serviceWorker?.controller?.postMessage({ type: 'FORGET_DM' })
    onClose()
  }

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
        className={panelClass('flex w-full max-w-90 flex-col gap-3')}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={SPRING}
      >
        <div className="type-lab flex items-center gap-1.75">
          {isDm ? <LuLockOpen aria-hidden /> : <LuLock aria-hidden />}
          {isDm ? 'DM mode is on' : 'Unlock DM mode'}
        </div>

        {isDm ? (
          <>
            <p className="type-body m-0">
              You can see sealed entries and edit anything. Lock up before handing the phone to a
              player.
            </p>
            <Link to="/dm" className={ctaClass('ghost')} onClick={onClose}>
              <LuWrench aria-hidden />
              DM tools
            </Link>
            <Cta tone="danger" onClick={lock}>
              <LuLock aria-hidden />
              Lock
            </Cta>
            <button type="button" className={ctaClass('ghost')} onClick={onClose}>
              Stay unlocked
            </button>
          </>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <p className="type-body m-0">
              Players do not need this. It reveals unknown entries and turns on editing.
            </p>
            <input
              className={inputClass}
              type="password"
              autoFocus
              value={value}
              placeholder="Passphrase"
              onChange={(e) => setValue(e.target.value)}
            />
            {error && (
              <motion.div
                className="type-meta flex items-center gap-1.75 text-danger"
                initial={{ x: 0 }}
                animate={{ x: [0, -6, 6, -4, 4, 0] }}
                transition={{ duration: 0.35 }}
              >
                <LuTriangleAlert aria-hidden />
                {error}
              </motion.div>
            )}
            <Cta type="submit" disabled={checking || value.length === 0}>
              <LuLockOpen aria-hidden />
              {checking ? 'Checking…' : 'Unlock'}
            </Cta>
            <button type="button" className={ctaClass('ghost')} onClick={onClose}>
              Cancel
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
