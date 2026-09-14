import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { setDmKey, useIsDm } from '../lib/dm'

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
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal panel stack gap-12" onClick={(e) => e.stopPropagation()}>
        <div className="lab">{isDm ? 'DM mode is on' : 'Unlock DM mode'}</div>

        {isDm ? (
          <>
            <p className="body-text" style={{ margin: 0 }}>
              You can see sealed entries and edit anything. Lock up before handing the phone to a
              player.
            </p>
            <button type="button" className="cta cta-danger" onClick={lock}>
              Lock
            </button>
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
              <div className="meta" style={{ color: '#d89494' }}>
                {error}
              </div>
            )}
            <button type="submit" className="cta" disabled={checking || value.length === 0}>
              {checking ? 'Checking…' : 'Unlock'}
            </button>
            <button type="button" className="cta cta-ghost" onClick={onClose}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
