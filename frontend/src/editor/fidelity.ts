import { createWikiMarked } from '../lib/wikiMarked'

/**
 * A marked instance of this module's own, used only to render for comparison.
 *
 * Deliberately not the editor's: Tiptap registers a tokenizer onto whatever
 * instance it is given, one per extension that declares one, and those tokens
 * (`taskList`, and others) have no renderer. Asking that instance for HTML
 * throws `Token with "taskList" type was not found` — which, since this check
 * runs when the editor mounts, would crash on opening any note with a checklist.
 */
const render = createWikiMarked()

/**
 * Whether two pieces of markdown mean the same thing to a reader.
 *
 * Not a byte comparison, deliberately. Serialising escapes `*` and `_` and
 * turns a soft wrap into `  \n`; none of that changes a word on screen, and
 * judging on bytes would send every note with an asterisk to source mode.
 *
 * What it does catch is the fallback silently *deleting* things the editor's
 * schema has no home for — tables, link definitions, images, unknown HTML —
 * because those change the rendered output.
 */
export function meansTheSame(before: string, after: string): boolean {
  return (
    normalise(render.parse(before, { async: false })) ===
    normalise(render.parse(after, { async: false }))
  )
}

function normalise(html: string): string {
  return (
    html
      .replace(/<br\s*\/?>/g, '<br>')
      // An empty paragraph the serialiser writes for a double Enter.
      .replace(/&nbsp;/g, ' ')
      .replace(/<p>\s*<\/p>/g, '')
      // Loose vs tight lists: a blank line between items makes marked wrap each
      // in <p>. That is spacing, not content.
      .replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Paragraphs the serialiser writes as a lone `&nbsp;` for a blank line. */
export function stripBlankParagraphs(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => (line.trim() === '&nbsp;' ? '' : line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
