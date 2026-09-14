import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { LuLock, LuLockOpen, LuTriangleAlert } from 'react-icons/lu'
import { api } from '../api/client'
import { setDmKey, useIsDm } from '../lib/dm'
import { SPRING } from '../lib/motion'

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
    const ok = await api.verifyDmKey(value).catch(() => false)
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
    onClose()
  }

  return (
    <motion.div
      className="modal-scrim"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        className="modal panel stack gap-12"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={SPRING}
      >
        <div className="lab with-icon">
          {isDm ? <LuLockOpen aria-hidden /> : <LuLock aria-hidden />}
          {isDm ? 'DM mode is on' : 'Unlock DM mode'}
        </div>

        {isDm ? (
          <>
            <p className="body-text" style={{ margin: 0 }}>
              You can see sealed entries and edit anything. Lock up before handing the phone to a
              player.
            </p>
            <motion.button
              type="button"
              className="cta cta-danger with-icon"
              onClick={lock}
              whileTap={{ scale: 0.97 }}
              transition={SPRING}
            >
              <LuLock aria-hidden />
              Lock
            </motion.button>
            <button type="button" className="cta cta-ghost" onClick={onClose}>
              Stay unlocked
            </button>
          </>
        ) : (
          <form className="stack gap-12" onSubmit={submit}>
            <p className="body-text" style={{ margin: 0 }}>
              Players do not need this. It reveals unknown entries and turns on editing.
            </p>
            <input
              className="input"
              type="password"
              autoFocus
              value={value}
              placeholder="Passphrase"
              onChange={(e) => setValue(e.target.value)}
            />
            {error && (
              <motion.div
                className="meta with-icon"
                style={{ color: '#d89494' }}
                initial={{ x: 0 }}
                animate={{ x: [0, -6, 6, -4, 4, 0] }}
                transition={{ duration: 0.35 }}
              >
                <LuTriangleAlert aria-hidden />
                {error}
              </motion.div>
            )}
            <motion.button
              type="submit"
              className="cta with-icon"
              disabled={checking || value.length === 0}
              whileTap={{ scale: 0.97 }}
              transition={SPRING}
            >
              <LuLockOpen aria-hidden />
              {checking ? 'Checking…' : 'Unlock'}
            </motion.button>
            <button type="button" className="cta cta-ghost" onClick={onClose}>
              Cancel
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
