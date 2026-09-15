import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { StaggerList } from './bits'

/**
 * Below this many rows, rendering them all is cheaper than virtualising and
 * keeps the staggered entry animation. Above it, the SRD item repository is
 * hundreds of rows and the DOM cost stops being free.
 *
 * Set above the largest item category that is not Wondrous (Gear, 105). The
 * threshold swaps the whole subtree — StaggerList for WindowVirtual — so a list
 * that crosses it *remounts*: the stagger replays and the virtualiser
 * remeasures. At 40 that happened while typing, because several categories sit
 * either side of it. Only one list in the app is now big enough to virtualise,
 * which is the point: it is a cost, not a feature.
 */
const VIRTUALISE_ABOVE = 120

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
  /** Items side by side. Defaults to one, the single-column list. */
  columns?: number
}

/**
 * Groups items into rows of `columns`.
 *
 * Laying out multiple columns this way — one virtual row holding N items — keeps
 * the virtualiser one-dimensional, which is the whole reason it can measure rows
 * that vary in height. The alternative, lanes, has to guess at a row's height
 * before it exists.
 */
function chunk<T>(items: T[], columns: number): T[][] {
  if (columns <= 1) return items.map((item) => [item])
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns))
  return rows
}

export default function VirtualList<T>(props: Props<T>) {
  const columns = Math.max(1, props.columns ?? 1)

  // Hooks cannot be conditional, so the two scroll modes are two components.
  // The threshold check is safe here because it does not change which hook runs.
  if (props.items.length <= VIRTUALISE_ABOVE) {
    return (
      <StaggerList className={props.className}>
        {chunk(props.items, columns).map((row) => (
          <Row
            key={props.getKey(row[0]!)}
            row={row}
            columns={columns}
            getKey={props.getKey}
            renderItem={props.renderItem}
          />
        ))}
      </StaggerList>
    )
  }

  return props.scrollRef ? <PanelVirtual {...props} /> : <WindowVirtual {...props} />
}

/** One virtual row: a single item, or `columns` of them side by side. */
function Row<T>({
  row,
  columns,
  getKey,
  renderItem,
}: Pick<Props<T>, 'getKey' | 'renderItem'> & { row: T[]; columns: number }) {
  if (columns === 1) return <div>{renderItem(row[0]!)}</div>

  return (
    // Explicit equal tracks rather than auto-fit, so a final half-full row
    // leaves a gap instead of stretching one item across the width. minmax(0,
    // 1fr) rather than 1fr: a bare 1fr has an auto minimum and would be pushed
    // wider by a long unbroken name.
    <div
      className="grid gap-x-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {row.map((item) => (
        <div key={getKey(item)} className="min-w-0">
          {renderItem(item)}
        </div>
      ))}
    </div>
  )
}

/** Long list on a page: the window is the scroller. */
function WindowVirtual<T>({ items, getKey, renderItem, className, estimate, columns }: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const lanes = Math.max(1, columns ?? 1)
  const rows = chunk(items, lanes)

  // The window virtualiser measures from the top of the document, so it needs
  // to know how far down the page this list starts.
  useLayoutEffect(() => {
    setOffset(parentRef.current?.offsetTop ?? 0)
  }, [items.length])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
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
      {virtualizer.getVirtualItems().map((virtual) => {
        const row = rows[virtual.index]
        if (!row?.[0]) return null
        return (
          <div
            key={getKey(row[0])}
            data-index={virtual.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtual.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            <Row row={row} columns={lanes} getKey={getKey} renderItem={renderItem} />
          </div>
        )
      })}
    </motion.div>
  )
}

/** Long list inside a panel: that element is the scroller. */
function PanelVirtual<T>({
  items,
  getKey,
  renderItem,
  scrollRef,
  className,
  estimate,
  columns,
}: Props<T>) {
  const lanes = Math.max(1, columns ?? 1)
  const rows = chunk(items, lanes)

  const virtualizer = useVirtualizer({
    count: rows.length,
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
      {virtualizer.getVirtualItems().map((virtual) => {
        const row = rows[virtual.index]
        if (!row?.[0]) return null
        return (
          <div
            key={getKey(row[0])}
            data-index={virtual.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtual.start}px)`,
            }}
          >
            <Row row={row} columns={lanes} getKey={getKey} renderItem={renderItem} />
          </div>
        )
      })}
    </motion.div>
  )
}
