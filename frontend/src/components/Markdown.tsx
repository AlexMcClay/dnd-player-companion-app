import DOMPurify from 'dompurify'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNameIndex } from '../lib/useNameIndex'
import { wikiMarkedFor } from '../lib/wikiMarked'

/**
 * Renders markdown, resolving `[[Name]]` against the entities the viewer can
 * see. A link to something they have not learned about yet renders as plain
 * dimmed text rather than a dead link.
 *
 * Links are a marked token rather than a pre-pass over the source, so one
 * inside a code span stays code — see `lib/wikiMarked.ts`.
 */
export default function Markdown({ source }: { source: string }) {
  const index = useNameIndex()
  const navigate = useNavigate()

  const html = useMemo(() => {
    const raw = wikiMarkedFor(index).parse(source, { async: false })
    return DOMPurify.sanitize(raw)
      .replaceAll('<table>', '<div class="md-table-wrap"><table>')
      .replaceAll('</table>', '</table></div>')
  }, [source, index])

  // Keep internal links inside the SPA instead of doing a full page load.
  function onClick(event: React.MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest('a')
    const href = anchor?.getAttribute('href')
    if (!href?.startsWith('/')) return
    event.preventDefault()
    navigate(href)
  }

  return <div className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
