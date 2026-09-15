import { Node, nodeInputRule, nodePasteRule } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { WIKI_LINK } from '../lib/wikiLinks'
import type { WikiLinkToken } from '../lib/wikiMarked'

export interface WikiLinkAttrs {
  name: string
  label: string | null
}

/** `[[Name]]` or `[[Name|Label]]`, from a node's attributes. */
function toMarkdown(attrs: WikiLinkAttrs): string {
  const label = attrs.label?.trim()
  return label && label !== attrs.name ? `[[${attrs.name}|${label}]]` : `[[${attrs.name}]]`
}

/**
 * A wiki-link in the editor: one indivisible thing, not five bracket characters.
 *
 * An inline atom, so the caret steps over it whole and it cannot be edited into
 * something malformed. It is deliberately *not* selectable — clicking should put
 * a caret beside it, not select it as an object.
 *
 * A dead link (a name the viewer cannot see) is still a link node. Dead-ness is
 * a property of who is looking, not of the text: a player's `[[Sealed Thing]]`
 * becomes live the moment the DM reveals it. Demoting it to plain text here
 * would also mean the serialiser escaping it to `\[\[…\]\]`, permanently.
 */
export const WikiLink = Node.create({
  name: 'wikiLink',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      name: { default: '' },
      label: { default: null },
    }
  },

  parseHTML() {
    // Needed for copy/paste *within* the editor: without it, the clipboard's
    // HTML flavour comes back as plain text and the link degrades to its label.
    return [
      {
        tag: 'span[data-wiki-link]',
        getAttrs: (element) => ({
          name: (element as HTMLElement).dataset.name ?? '',
          label: (element as HTMLElement).dataset.label ?? null,
        }),
      },
    ]
  },

  renderHTML({ node }) {
    const attrs = node.attrs as WikiLinkAttrs
    return [
      'span',
      {
        'data-wiki-link': '',
        'data-name': attrs.name,
        ...(attrs.label ? { 'data-label': attrs.label } : {}),
        class: 'wikilink',
      },
      attrs.label || attrs.name,
    ]
  },

  /** Plain-text clipboard flavour, so copying out of the editor yields markdown. */
  renderText({ node }) {
    return toMarkdown(node.attrs as WikiLinkAttrs)
  },

  // The token name the shared marked tokenizer emits. Note there is deliberately
  // no `markdownTokenizer` here: declaring one would make Tiptap register it on
  // the marked instance itself, and we hand it an instance that already has it.
  markdownTokenName: 'wikiLink',

  parseMarkdown(token): JSONContent {
    const { name, label } = token as WikiLinkToken
    return {
      type: 'wikiLink',
      attrs: { name, label: label === name ? null : label },
    }
  },

  renderMarkdown(node: JSONContent): string {
    return toMarkdown(node.attrs as WikiLinkAttrs)
  },

  addInputRules() {
    return [
      // Typing the closing `]]` turns what was typed into a link. Without this,
      // the habit the placeholders teach would produce text that the serialiser
      // escapes to `\[\[Name\]\]` — visibly broken, and never a link again.
      nodeInputRule({
        find: new RegExp(WIKI_LINK.source + '$'),
        type: this.type,
        getAttributes: (match) => ({
          name: (match[1] ?? '').trim(),
          label: match[2] ? match[2].trim() : null,
        }),
      }),
    ]
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: new RegExp(WIKI_LINK.source, 'g'),
        type: this.type,
        getAttributes: (match) => ({
          name: (match[1] ?? '').trim(),
          label: match[2] ? match[2].trim() : null,
        }),
      }),
    ]
  },

  addKeyboardShortcuts() {
    const removeAdjacent = (direction: -1 | 1) => () => {
      const { state, view } = this.editor
      const { empty, anchor } = state.selection
      if (!empty) return false

      let handled = false
      state.doc.nodesBetween(
        direction === -1 ? Math.max(0, anchor - 1) : anchor,
        direction === -1 ? anchor : Math.min(state.doc.content.size, anchor + 1),
        (node, pos) => {
          if (node.type.name !== this.name) return
          view.dispatch(state.tr.delete(pos, pos + node.nodeSize))
          handled = true
          return false
        },
      )
      return handled
    }

    // Both directions, explicitly. With `selectable: false` the base keymap has
    // nothing to do next to an inline atom, so it falls through to the browser's
    // native contenteditable delete — which mishandles non-editable inline spans
    // on Android, sometimes eating the preceding word instead.
    return {
      Backspace: removeAdjacent(-1),
      Delete: removeAdjacent(1),
    }
  },
})
