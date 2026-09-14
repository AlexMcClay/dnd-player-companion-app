import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'codex.dmKey'

const listeners = new Set<() => void>()

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let current = read()

function emit() {
  for (const fn of listeners) fn()
}

export function getDmKey(): string | null {
  return current
}

export function setDmKey(key: string | null): void {
  current = key
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private browsing — DM mode just won't survive a reload.
  }
  emit()
}

/** True when a DM passphrase is stored. The server is what actually enforces it. */
export function useIsDm(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => current !== null,
    () => false,
  )
}
