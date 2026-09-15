import { useSyncExternalStore } from 'react'

/**
 * Whether the browser thinks it has a connection.
 *
 * `navigator.onLine` is only ever trustworthy in one direction: false really
 * does mean there is no network, while true only means an interface is up and
 * says nothing about whether anything answers. That is the right way round for
 * what this is used for — refusing to try, and saying so.
 *
 * useSyncExternalStore rather than an effect, matching useMediaQuery: the first
 * paint reads the real value instead of claiming to be online and correcting
 * itself a frame later.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange)
      window.addEventListener('offline', onChange)
      return () => {
        window.removeEventListener('online', onChange)
        window.removeEventListener('offline', onChange)
      }
    },
    () => navigator.onLine,
    // No SSR here, but the signature wants a server snapshot and online is the
    // answer that renders the app rather than an error.
    () => true,
  )
}
