import { useEffect, useState } from 'react'

/**
 * Trails `value` by `delay`, so a fast typist causes one request instead of ten.
 *
 * Use it on the *query key*, not on the input: the field stays controlled and
 * the URL keeps up per keystroke, and only the network waits. Debouncing the URL
 * write instead would let the box and the address bar disagree, and would need
 * resyncing on back and forward.
 *
 * `useDeferredValue` is not a substitute — it defers rendering, not fetching, so
 * the request would still go out on every keystroke.
 */
export function useDebounced<T>(value: T, delay = 200): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
