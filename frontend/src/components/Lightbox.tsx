/**
 * An entry's art at the size the screen allows.
 *
 * The page it is opened from lives inside a framer-motion wrapper that animates
 * `x`, and a transformed ancestor makes `position: fixed` resolve against that
 * ancestor rather than the viewport — so this goes through a portal to the body
 * like the mention popover does, and is genuinely full-screen.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX } from 'react-icons/lu'
import { SPRING } from '../lib/motion'

export interface LightboxProps {
  src: string | null
  alt: string
  open: boolean
  onClose: () => void
}

export default function Lightbox({ src, alt, open, onClose }: LightboxProps) {
  // Through a ref so the effect below depends on `open` alone. Callers pass an
  // inline arrow, which is a new function every render — and an effect that
  // tears down and sets up the scroll lock on each of those is asking for the
  // page to be left locked.
  const close = useRef(onClose)
  close.current = onClose

  const showing = open && src !== null

  useEffect(() => {
    if (!showing) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
    }
    // Without this the page behind scrolls under the image on a wheel or a drag,
    // and closing lands you somewhere other than where you opened it.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [showing])

  return createPortal(
    <AnimatePresence>
      {showing && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute top-3 right-3 grid size-10 cursor-pointer place-items-center border border-line text-ink-soft [&>svg]:size-4"
            whileTap={{ scale: 0.92 }}
            transition={SPRING}
            onClick={onClose}
          >
            <LuX aria-hidden />
          </motion.button>

          <motion.img
            src={src}
            alt={alt}
            // object-contain rather than bounds on the image alone: a portrait
            // taller than the screen has to shrink to fit, and letterboxing it
            // against the scrim is invisible anyway.
            className="max-h-[92vh] max-w-full object-contain"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={SPRING}
            // Tapping the picture itself should not dismiss it — only the space
            // around it, which is the gesture everyone already expects.
            onClick={(event) => event.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
