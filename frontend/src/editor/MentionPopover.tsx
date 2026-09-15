import { motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { templateFor } from '../templates'
import { cx } from '../components/ui'
import type { MentionItem } from './mention'

export interface MentionPopoverProps {
  items: MentionItem[]
  active: number
  onHover: (index: number) => void
  select: (item: MentionItem) => void
  /** Where the `@` sits on screen. Only used when floating. */
  rect: DOMRect | null
  /**
   * Touch device: render as a strip inside the editor rather than a floating
   * panel. See the note on positioning below.
   */
  docked: boolean
}

/**
 * Groups the matches by kind, keeping each item's position in the flat list.
 *
 * The flat index is what the arrow keys and Enter act on, so it has to survive
 * grouping. `mention.ts` orders the list so that index also matches the order
 * drawn here.
 */
function groupByType(
  items: MentionItem[],
): Array<{ type: string; rows: Array<{ item: MentionItem; index: number }> }> {
  const groups = new Map<string, Array<{ item: MentionItem; index: number }>>()
  items.forEach((item, index) => {
    const bucket = groups.get(item.type)
    if (bucket) bucket.push({ item, index })
    else groups.set(item.type, [{ item, index }])
  })
  return [...groups].map(([type, rows]) => ({ type, rows }))
}

export default function MentionPopover({
  items,
  active,
  onHover,
  select,
  rect,
  docked,
}: MentionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [flipUp, setFlipUp] = useState(false)
  const groups = useMemo(() => groupByType(items), [items])

  // A caret-anchored list can run off the bottom of the window; measure and
  // flip it above the caret when it would.
  useLayoutEffect(() => {
    if (docked || !rect || !ref.current) return
    const height = ref.current.offsetHeight
    setFlipUp(rect.bottom + height + 8 > window.innerHeight && rect.top > height)
  }, [docked, rect, items.length])

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    ref.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (items.length === 0) return null

  const rows = groups.map(({ type, rows: group }) => {
    const template = templateFor(type)
    const Icon = template.icon
    return (
      <div key={type} className={cx(docked ? 'flex shrink-0 items-center gap-1.5' : 'contents')}>
        {/*
          One heading per kind — a row of its own in the floating list, an
          inline divider in the strip, where there is no room for one.
        */}
        <span
          className={cx(
            'type-lab flex items-center gap-1.25 whitespace-nowrap',
            docked ? 'pl-1 text-ink-faint' : 'px-2.5 pt-2 pb-1',
          )}
        >
          <Icon className="size-3 opacity-70" aria-hidden />
          {template.plural}
        </span>

        {group.map(({ item, index }) => (
          <button
            key={item.id}
            type="button"
            data-active={index === active}
            className={cx(
              'flex cursor-pointer items-center gap-2 text-left',
              docked
                ? 'shrink-0 rounded-full border px-2.5 py-1 whitespace-nowrap'
                : 'w-full px-2.5 py-1.75',
              index === active
                ? docked
                  ? 'border-gold bg-gold-wash text-gold'
                  : 'bg-gold-tint text-gold'
                : docked
                  ? 'border-line text-ink-soft'
                  : 'text-ink-dim',
            )}
            onMouseEnter={() => onHover(index)}
            onClick={() => select(item)}
          >
            <span className={cx('truncate', docked ? 'text-[13px]' : 'type-name text-[15px]')}>
              {item.name}
            </span>
          </button>
        ))}
      </div>
    )
  })

  /*
    On a touch device this is part of the editor, not a layer over the page.

    Floating it above the keyboard meant covering whatever was underneath —
    the visibility pills and the Post button sit directly below the composer —
    and it made the position depend on visualViewport maths that iOS and
    Android disagree about. In flow it cannot cover anything, it moves with the
    editor, and there is no viewport arithmetic left to get wrong.
  */
  if (docked) {
    return (
      <motion.div
        ref={ref}
        className="flex items-center gap-1.5 overflow-x-auto border-t border-line-soft px-2 py-1.75"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.12 }}
        // Taking focus would close the keyboard and cancel the suggestion
        // before the tap ever lands.
        onPointerDown={(event) => event.preventDefault()}
      >
        {rows}
      </motion.div>
    )
  }

  return createPortal(
    <motion.div
      ref={ref}
      className="z-50 max-h-64 overflow-y-auto border border-gold-dim bg-tabbar shadow-lg"
      style={{
        position: 'fixed',
        left: Math.min(rect?.left ?? 0, window.innerWidth - 260),
        top: flipUp ? undefined : (rect?.bottom ?? 0) + 6,
        bottom: flipUp ? window.innerHeight - (rect?.top ?? 0) + 6 : undefined,
        width: 250,
      }}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      onPointerDown={(event) => event.preventDefault()}
    >
      {rows}
    </motion.div>,
    document.body,
  )
}
