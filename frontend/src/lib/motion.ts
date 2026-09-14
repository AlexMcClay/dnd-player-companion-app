import type { Transition, Variants } from 'framer-motion'

/** Gentle decelerating ease — everything in the app uses this or a spring. */
export const EASE = [0.22, 1, 0.36, 1] as const

/** How far a page slides. Big enough to read as a direction, not a jump. */
const SHIFT = 38

/**
 * Driven by `custom`, which is the only way the exiting page gets the *current*
 * direction: AnimatePresence renders the outgoing element from the previous
 * render, so its own props carry a stale direction. Passing `custom` on the
 * AnimatePresence overrides that on exit.
 */
export const pageVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * SHIFT,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: EASE },
  },
  exit: (direction: number) => ({
    opacity: 0,
    // Leaves the way the new page is coming from, so the pair reads as one move.
    x: direction * -SHIFT,
    transition: { duration: 0.14, ease: EASE },
  }),
}

export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 34 }

/**
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user">,
 * which strips transform and layout animation while leaving opacity alone — so
 * these variants need no manual guard.
 */
export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
}

export const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}

export const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}
