import { useSyncExternalStore } from 'react'

/**
 * Reads a CSS media query from JS.
 *
 * Layout is Tailwind's job nearly everywhere — a `md:` class needs no help. This
 * exists for the one case a class cannot cover: a virtualised list has to *know*
 * how many columns it is drawing, because it decides for itself which rows are
 * in the DOM at all.
 *
 * useSyncExternalStore rather than useEffect + useState so the first paint reads
 * the real value instead of rendering one column and correcting itself.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    // Server snapshot. There is no SSR here, but the signature wants one and
    // false is the safe answer: one column is correct at every width.
    () => false,
  )
}

/** Tailwind's own breakpoints, so JS and CSS cannot drift apart. */
export const MD = '(min-width: 48rem)'
/** 1024px — the narrowest width with room for the side rail beside the content. */
export const LG = '(min-width: 64rem)'
