import { useSyncExternalStore } from 'react'

/**
 * Who the app thinks you are: a chosen character, a DM passphrase, or both.
 *
 * Neither is authentication. The player id is just a choice stored in this
 * browser — anyone can claim to be any character, exactly as anyone holding the
 * passphrase is the DM. See the README.
 */

type Key = 'codex.dmKey' | 'codex.playerId'

/**
 * One tiny store per key. Snapshots must be primitives: useSyncExternalStore
 * compares them by identity, so returning a fresh object would re-render forever.
 */
function createStore(key: Key) {
  const listeners = new Set<() => void>()

  function read(): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      // Private browsing — the choice just won't survive a reload.
      return null
    }
  }

  let current = read()

  const get = () => current

  const set = (value: string | null) => {
    current = value
    try {
      if (value) localStorage.setItem(key, value)
      else localStorage.removeItem(key)
    } catch {
      // As above: nothing to do, the in-memory value still works this session.
    }
    for (const fn of listeners) fn()
  }

  // Stable identity, which useSyncExternalStore requires of its subscribe arg.
  const subscribe = (fn: () => void) => {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }

  const use = () => useSyncExternalStore(subscribe, get, () => null)

  return { get, set, subscribe, use }
}

const dmStore = createStore('codex.dmKey')
const playerStore = createStore('codex.playerId')

/** Read outside React, for the API client's header injection. */
export const getDmKey = dmStore.get
export const getPlayerId = playerStore.get

export const setDmKey = dmStore.set
export const setPlayerId = playerStore.set

/** True when a DM passphrase is stored. The server is what actually enforces it. */
export function useIsDm(): boolean {
  return dmStore.use() !== null
}

/** The chosen character's id, or null if nobody has been picked yet. */
export function usePlayerId(): string | null {
  return playerStore.use()
}

/** Clears the character but leaves DM mode alone. */
export function forgetPlayer(): void {
  setPlayerId(null)
}
