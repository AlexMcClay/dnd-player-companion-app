/**
 * TEMPORARY — delete once the iOS tab-bar position is settled.
 *
 * Reports what the page actually believes about the viewport, because the tab
 * bar sits correctly on a page that scrolls and too high on one that does not,
 * and none of that is visible from a desktop browser.
 */
import { useEffect, useState } from 'react'

interface Reading {
  inner: number
  client: number
  visual: number
  visualTop: number
  screen: number
  scrollH: number
  scrolls: boolean
  insetBottom: number
  insetTop: number
  navBottom: number
  navHeight: number
}

function read(): Reading {
  // env() cannot be read from JS, so measure it off a probe element.
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;left:-9999px;height:env(safe-area-inset-bottom,0px);padding-top:env(safe-area-inset-top,0px)'
  document.body.append(probe)
  const style = getComputedStyle(probe)
  const insetBottom = parseFloat(style.height) || 0
  const insetTop = parseFloat(style.paddingTop) || 0
  probe.remove()

  const nav = document.querySelector('nav[data-probe="tabbar"]')
  const rect = nav?.getBoundingClientRect()

  return {
    inner: Math.round(window.innerHeight),
    client: document.documentElement.clientHeight,
    visual: Math.round(window.visualViewport?.height ?? 0),
    visualTop: Math.round(window.visualViewport?.offsetTop ?? 0),
    screen: Math.round(window.screen.height),
    scrollH: Math.round(document.documentElement.scrollHeight),
    scrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
    insetBottom,
    insetTop,
    navBottom: Math.round(rect?.bottom ?? 0),
    navHeight: Math.round(rect?.height ?? 0),
  }
}

export default function ViewportProbe() {
  const [r, setR] = useState<Reading | null>(null)

  useEffect(() => {
    const update = () => setR(read())
    // After layout has settled — the nav is measured, and on iOS the viewport
    // numbers are not final on the first frame.
    const id = setTimeout(update, 400)
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      clearTimeout(id)
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  if (!r) return null

  const gap = r.inner - r.navBottom

  return (
    <div className="border-b border-gold bg-gold-wash px-2 py-1 font-mono text-[10px] leading-tight text-gold">
      <div>
        inner {r.inner} · client {r.client} · visual {r.visual}@{r.visualTop} · screen {r.screen}
      </div>
      <div>
        scrollH {r.scrollH} · scrolls {String(r.scrolls)} · insetT {r.insetTop} · insetB{' '}
        {r.insetBottom}
      </div>
      <div>
        navBottom {r.navBottom} · navH {r.navHeight} · <b>GAP {gap}</b>
      </div>
    </div>
  )
}
