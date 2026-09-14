import type { PanInfo } from 'framer-motion'
import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TABS } from '../templates'

/** Past this much horizontal travel a swipe counts, regardless of speed. */
const DISTANCE = 70
/** A flick counts earlier, as long as it moved a little. */
const VELOCITY = 450
const FLICK_DISTANCE = 24

function tabIndex(pathname: string): number {
  return TABS.findIndex((tab) => tab.path === pathname)
}

/**
 * Horizontal swipe between tabs, and swipe-right-to-go-back everywhere else.
 *
 * Uses framer's pan handler rather than `drag`, so nothing moves under the
 * finger and the page keeps scrolling normally. The caller must also set
 * `touch-action: pan-y` so the browser hands us horizontal gestures.
 */
export function useSwipeNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return function onPanEnd(_event: unknown, info: PanInfo) {
    const { offset, velocity } = info

    // Vertical intent always wins — a swipe must never hijack a scroll.
    if (Math.abs(offset.x) < Math.abs(offset.y) * 1.6) return

    const travelled = Math.abs(offset.x) > DISTANCE
    const flicked = Math.abs(velocity.x) > VELOCITY && Math.abs(offset.x) > FLICK_DISTANCE
    if (!travelled && !flicked) return

    const backwards = offset.x > 0
    const index = tabIndex(location.pathname)

    if (index === -1) {
      // A detail or edit page: swipe right goes back, nothing goes forward.
      if (backwards) navigate(-1)
      return
    }

    const target = TABS[backwards ? index - 1 : index + 1]
    if (target) navigate(target.path)
  }
}

/**
 * -1, 0 or 1, for direction-aware page transitions. Only tab-to-tab moves get a
 * direction; navigating into a detail page just crossfades.
 */
export function useNavDirection(): number {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  const direction = useRef(0)

  if (previous.current !== pathname) {
    const from = tabIndex(previous.current)
    const to = tabIndex(pathname)
    direction.current = from !== -1 && to !== -1 ? Math.sign(to - from) : 0
    previous.current = pathname
  }

  return direction.current
}
