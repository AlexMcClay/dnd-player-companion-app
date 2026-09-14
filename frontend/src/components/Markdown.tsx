import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNameIndex } from '../lib/useNameIndex'

marked.setOptions({ gfm: true, breaks: true })

const WIKI_LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

/**
 * Renders DM-authored markdown, resolving `[[Name]]` against the entities the
 * viewer can see. A link to something they have not learned about yet renders
 * as plain dimmed text rather than a dead link.
 */
export default function Markdown({ source }: { source: string }) {
  const index = useNameIndex()
  const navigate = useNavigate()

  const html = useMemo(() => {
    const withLinks = source.replace(WIKI_LINK, (_match, rawName: string, rawLabel?: string) => {
      const name = rawName.trim()
      const label = escapeHtml((rawLabel ?? name).trim())
      const id = index.get(name.toLowerCase())
      return id
        ? `<a class="wikilink" href="/e/${id}">${label}</a>`
        : `<span class="wikilink-dead">${label}</span>`
    })

    const raw = marked.parse(withLinks, { async: false })
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
