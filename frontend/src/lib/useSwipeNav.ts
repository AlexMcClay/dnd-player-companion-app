import type { PanInfo } from 'framer-motion'
import { useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
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
 * Whether a gesture came from something that should navigate.
 *
 * A mouse drag across a paragraph easily passes the distance threshold below, so
 * without this, selecting text on a desktop navigates away on mouse-up. Framer
 * is not at fault: its pan listeners are registered `{ passive: true }` and so
 * cannot block selection — it is this handler acting on the result.
 *
 * Gated on the pointer rather than on a breakpoint, so a laptop with a
 * touchscreen gets both behaviours right: a finger swipes, its mouse does not.
 *
 * Framer types the argument `MouseEvent | TouchEvent | PointerEvent`, so the
 * property has to be tested for rather than assumed.
 */
/**
 * True while the focus is somewhere the user is composing.
 *
 * A horizontal drag across text in an editor — selecting a word, or just
 * missing — would otherwise navigate to another tab and take the unsaved draft
 * with it.
 */
export function isEditing(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function isSwipePointer(event: unknown): boolean {
  if (typeof event !== 'object' || event === null || !('pointerType' in event)) return false
  const kind = (event as PointerEvent).pointerType
  return kind === 'touch' || kind === 'pen'
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

  return function onPanEnd(event: unknown, info: PanInfo) {
    // A mouse is here to select text, not to navigate.
    if (!isSwipePointer(event)) return
    // Nor is a finger dragging inside something being written in. Losing an
    // unsaved note to a stray horizontal drag is the worst outcome available.
    if (isEditing()) return

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
 * 1 (forward/rightward) or -1 (backward/leftward).
 *
 * Two rules, because the two kinds of navigation mean different things:
 *  - Tab to tab, the bar's own order decides. Craft -> Party moves left even
 *    though it is a push, because that is the direction the user sees.
 *  - Anywhere else it is a push/pop, so opening a detail page moves forward and
 *    Back — including the browser and hardware back buttons, which both report
 *    POP — moves back.
 *
 * Pure and exported so the matrix can be tested without a browser.
 */
export function navDirection(from: string, to: string, navigationType: string): number {
  const fromTab = tabIndex(from)
  const toTab = tabIndex(to)

  if (fromTab !== -1 && toTab !== -1) {
    return Math.sign(toTab - fromTab) || 1
  }
  return navigationType === 'POP' ? -1 : 1
}

/** Tracks the previous pathname so each render knows which way the page moved. */
export function useNavDirection(): number {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(pathname)
  const direction = useRef(1)

  if (previous.current !== pathname) {
    direction.current = navDirection(previous.current, pathname, navigationType)
    previous.current = pathname
  }

  return direction.current
}
