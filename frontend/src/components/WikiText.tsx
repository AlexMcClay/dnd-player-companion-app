import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useNameIndex } from '../lib/useNameIndex'
import { splitWikiText } from '../lib/wikiLinks'

/**
 * Renders a plain string, turning `[[Name]]` into a link. For anywhere that is
 * not a markdown body — template fields like a location's "Run by", which
 * otherwise showed the brackets verbatim.
 *
 * Builds React nodes rather than HTML, so unlike the markdown path there is
 * nothing to sanitise.
 */
export default function WikiText({ text }: { text: string }) {
  const index = useNameIndex()
  const segments = useMemo(() => splitWikiText(text, index), [text, index])

  return (
    <>
      {segments.map((segment, i) =>
        !segment.isLink ? (
          <span key={i}>{segment.text}</span>
        ) : segment.id ? (
          <Link key={i} to={`/e/${segment.id}`} className="wikilink">
            {segment.text}
          </Link>
        ) : (
          <span key={i} className="wikilink-dead">
            {segment.text}
          </span>
        ),
      )}
    </>
  )
}
