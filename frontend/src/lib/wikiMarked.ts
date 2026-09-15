import { Marked, type TokenizerAndRendererExtension, type Tokens } from 'marked'
import { resolveWikiName, WIKI_LINK } from './wikiLinks'

/**
 * `[[Wiki-link]]` as a real marked token, rather than a find-and-replace.
 *
 * This is the one definition of what a link is, shared by the renderer and by
 * the editor. It matters twice over:
 *
 *  - The renderer used to rewrite `[[…]]` with a `String.replace` over the raw
 *    source *before* marked ran, so a link inside a code span or fence was
 *    rewritten too and the reader saw anchor markup as code. A tokenizer cannot
 *    make that mistake: marked never offers it the inside of a code span.
 *  - The editor parses markdown with marked as well. If the two disagreed about
 *    what a link is, round-tripping a note through the editor would quietly
 *    change it.
 *
 * Registered on a `Marked` *instance*, never on the module singleton — see
 * `createWikiMarked`.
 */

export interface WikiLinkToken extends Tokens.Generic {
  type: 'wikiLink'
  raw: string
  /** The entity name to resolve. */
  name: string
  /** What to display. Equals `name` unless the source said `[[Name|Label]]`. */
  label: string
}

/** Anchored, non-global twin of the shared pattern, which a tokenizer needs. */
const AT_START = new RegExp('^' + WIKI_LINK.source)

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

/** Splits `[[Name|Label]]` the same way everywhere. */
export function partsOf(raw: string): { name: string; label: string } | null {
  const match = AT_START.exec(raw)
  if (!match) return null
  const name = (match[1] ?? '').trim()
  return { name, label: (match[2] ?? match[1] ?? '').trim() || name }
}

/**
 * @param index Lowercased name -> id. Without one, links render as their label
 *   — which is all the editor ever needs, since it turns tokens into nodes.
 */
function wikiLinkExtension(index?: Map<string, string>): TokenizerAndRendererExtension {
  return {
    name: 'wikiLink',
    level: 'inline',
    // Tells marked where the next possible match is, so it can emit the plain
    // text before it in one go.
    start(src: string) {
      return src.indexOf('[[')
    },
    tokenizer(src: string) {
      const parts = partsOf(src)
      if (!parts) return undefined
      const match = AT_START.exec(src)
      return {
        type: 'wikiLink',
        raw: match?.[0] ?? '',
        name: parts.name,
        label: parts.label,
      } satisfies WikiLinkToken
    },
    renderer(token) {
      const { name, label } = token as WikiLinkToken
      const text = escapeHtml(label)
      if (!index) return text
      const id = resolveWikiName(name, index)
      return id
        ? `<a class="wikilink" href="/e/${id}">${text}</a>`
        : `<span class="wikilink-dead">${text}</span>`
    },
  }
}

/**
 * A marked instance that knows about wiki-links.
 *
 * Always an instance. `marked.use()` mutates the module singleton by unshifting
 * onto a shared array with no dedupe, so registering there would append another
 * copy of this tokenizer every time an editor mounted, forever — and the
 * renderer, which also used the singleton, would inherit them all.
 */
export function createWikiMarked(index?: Map<string, string>): Marked {
  return new Marked({ gfm: true, breaks: true }).use({
    extensions: [wikiLinkExtension(index)],
  })
}

/**
 * One instance per name index. `useNameIndex` memoises the Map, so this is one
 * instance per data refresh rather than one per render.
 */
const byIndex = new WeakMap<Map<string, string>, Marked>()

export function wikiMarkedFor(index: Map<string, string>): Marked {
  const existing = byIndex.get(index)
  if (existing) return existing
  const created = createWikiMarked(index)
  byIndex.set(index, created)
  return created
}
