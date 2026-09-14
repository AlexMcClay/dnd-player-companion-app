import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { StaggerList } from './bits'

/**
 * Below this many rows, rendering them all is cheaper than virtualising and
 * keeps the staggered entry animation. Above it, the SRD item repository is
 * hundreds of rows and the DOM cost stops being free.
 */
const VIRTUALISE_ABOVE = 40

/** Rows vary (a plain entity row, a holding row that wraps), so this is a hint. */
const ESTIMATED_ROW = 74

/**
 * Children of a virtual list carry `rowVariants` but have no parent orchestrating
 * them, so pin the variant context to "show". Without this a row's variants
 * resolve to nothing in particular, and relying on that is not worth the risk of
 * a list that renders invisible.
 */
const SHOWN = { show: {} }

interface Props<T> {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** Set when the list scrolls inside a panel rather than the page. */
  scrollRef?: RefObject<HTMLElement | null>
  className?: string
  estimate?: number
}

export default function VirtualList<T>(props: Props<T>) {
  // Hooks cannot be conditional, so the two scroll modes are two components.
  // The threshold check is safe here because it does not change which hook runs.
  if (props.items.length <= VIRTUALISE_ABOVE) {
    return (
      <StaggerList className={props.className}>
        {props.items.map((item) => (
          <div key={props.getKey(item)}>{props.renderItem(item)}</div>
        ))}
      </StaggerList>
    )
  }

  return props.scrollRef ? <PanelVirtual {...props} /> : <WindowVirtual {...props} />
}

/** Long list on a page: the window is the scroller. */
function WindowVirtual<T>({ items, getKey, renderItem, className, estimate }: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  // The window virtualiser measures from the top of the document, so it needs
  // to know how far down the page this list starts.
  useLayoutEffect(() => {
    setOffset(parentRef.current?.offsetTop ?? 0)
  }, [items.length])

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimate ?? ESTIMATED_ROW,
    overscan: 8,
    scrollMargin: offset,
  })

  return (
    <motion.div
      ref={parentRef}
      className={className}
      variants={SHOWN}
      initial="show"
      animate="show"
      style={{ position: 'relative', height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const item = items[row.index]
        if (!item) return null
        return (
          <div
            key={getKey(item)}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {renderItem(item)}
          </div>
        )
      })}
    </motion.div>
  )
}

/** Long list inside a panel: that element is the scroller. */
function PanelVirtual<T>({ items, getKey, renderItem, scrollRef, className, estimate }: Props<T>) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef?.current ?? null,
    estimateSize: () => estimate ?? ESTIMATED_ROW,
    overscan: 8,
  })

  return (
    <motion.div
      className={className}
      variants={SHOWN}
      initial="show"
      animate="show"
      style={{ position: 'relative', height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const item = items[row.index]
        if (!item) return null
        return (
          <div
            key={getKey(item)}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start}px)`,
            }}
          >
            {renderItem(item)}
          </div>
        )
      })}
    </motion.div>
  )
}
