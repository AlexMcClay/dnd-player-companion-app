import type { Transition, Variants } from 'framer-motion'

/** Gentle decelerating ease — everything in the app uses this or a spring. */
export const EASE = [0.22, 1, 0.36, 1] as const

export const PAGE_TRANSITION: Transition = { duration: 0.18, ease: EASE }

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
