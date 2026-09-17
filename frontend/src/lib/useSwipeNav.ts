import type { PanInfo } from 'framer-motion'
import { useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { TABS, tabFor } from '../templates'

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
  if (el.isContentEditable) return true
  /*
    A search box is the exception: what you typed is in the URL, not in an
    unsaved draft, so swiping away costs nothing and retyping it costs nothing
    either. And the Search tab autofocuses its box — so treating it as composing
    meant the keyboard held the focus and no swipe on that page did anything
    until you happened to tap elsewhere first.
  */
  if (el instanceof HTMLInputElement && el.type === 'search') return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
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

    const action = swipeTarget(location, offset.x > 0)
    if (action === 'back') navigate(-1)
    else if (action) navigate(action)
  }
}

/** Where a swipe lands: a path to go to, a step back, or nowhere. */
export type SwipeAction = string | 'back' | null

/**
 * What a swipe means from here.
 *
 * Pure and exported so the matrix can be checked without a browser — the same
 * reason `navDirection` below is.
 *
 * `key` is React Router's location key; the very first entry of a session is
 * `'default'`, which is how a cold deep link is told apart from a view the user
 * navigated into.
 */
export function swipeTarget(
  location: { pathname: string; search: string; key: string },
  backwards: boolean,
): SwipeAction {
  const tab = tabFor(location.pathname)

  /*
    The Codex keeps its depth in the query string, so a group list and the grid
    that opened it share the pathname `/codex`. Matching on the path alone read
    "you are on the Codex tab" from inside a group, and swiped to the
    neighbouring tab when what the gesture meant was step back out.
  */
  const deeper =
    tab?.depthParam !== undefined && new URLSearchParams(location.search).has(tab.depthParam)

  if (!tab || deeper) {
    // A detail or edit page, or a view within a tab: swipe right goes back,
    // nothing goes forward.
    if (!backwards) return null
    // Except where this view *is* the first entry — a shared link opened cold,
    // or the PWA launching straight into it. There is nothing to pop, so back
    // means the tab it belongs to.
    return tab && location.key === 'default' ? tab.path : 'back'
  }

  const index = TABS.indexOf(tab)
  return TABS[backwards ? index - 1 : index + 1]?.path ?? null
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
