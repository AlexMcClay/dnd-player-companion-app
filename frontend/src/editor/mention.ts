import { Extension, type Editor, type Range } from '@tiptap/core'
import type { EntitySummary } from '@codex/shared'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { tokenMatch } from '../lib/textMatch'

export const mentionKey = new PluginKey('wikiMention')

/** How many matches the popover offers. */
const LIMIT = 8

/**
 * Longest entity name in the campaign is 28 characters, so a query longer than
 * this is someone writing prose, not reaching for a name.
 */
const MAX_QUERY = 40

/**
 * Where an `@` query stops.
 *
 * The stock matcher, with `allowSpaces`, runs the query to the end of the text
 * node — so `@Krag and then a whole sentence` keeps the popover open forever.
 * Names contain spaces ("Krag Bronzebeard"), so spaces cannot simply end it
 * either. This bounds it instead: at most four words, and any sentence
 * punctuation closes it.
 */
const QUERY = /@([^\s@[\]|.,;:!?]*(?:[  ][^\s@[\]|.,;:!?]+){0,3})$/

export interface MentionItem {
  id: string
  name: string
  type: string
}

/** What the popover needs from whoever renders it. */
export interface MentionRenderer {
  onStart: (props: MentionRenderProps) => void
  onUpdate: (props: MentionRenderProps) => void
  onExit: () => void
  /** Return true when the key was consumed. */
  onKeyDown: (event: KeyboardEvent) => boolean
}

export interface MentionRenderProps {
  items: MentionItem[]
  /** Inserts the given item and closes. */
  select: (item: MentionItem) => void
  /** Where the `@` is on screen, for anchoring. Null on some transitions. */
  rect: DOMRect | null
}

/**
 * Inserts the wiki-link the user picked, replacing the `@query` they typed.
 *
 * A trailing space is deliberate: without it the caret sits against the atom and
 * the next character typed can be absorbed into it on some browsers.
 */
function insert(editor: Editor, range: Range, item: MentionItem) {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      { type: 'wikiLink', attrs: { name: item.name, label: null } },
      { type: 'text', text: ' ' },
    ])
    .run()
}

/**
 * What the toolbar's `@` button does.
 *
 * Not simply "type an @": the trigger only fires after a space or an opening
 * bracket, so inserting one mid-word would produce a dead `@` and no popover.
 * This adds the space when the caret is against a word.
 */
export function openMention(editor: Editor): void {
  const { state } = editor
  const before = state.doc.textBetween(Math.max(0, state.selection.from - 1), state.selection.from)
  const needsSpace = before !== '' && ![' ', ' ', '('].includes(before)
  editor
    .chain()
    .focus()
    .insertContent(needsSpace ? ' @' : '@')
    .run()
}

export function mentionExtension(
  entities: () => EntitySummary[],
  renderer: () => MentionRenderer,
): Extension {
  return Extension.create({
    name: 'wikiMention',

    addProseMirrorPlugins() {
      const options: SuggestionOptions<MentionItem> = {
        editor: this.editor,
        pluginKey: mentionKey,
        char: '@',
        allowSpaces: true,
        // Default is [' ']; without '(' a name in parentheses never opens, and
        // a null prefix would make every email address a mention.
        allowedPrefixes: [' ', '(', ' '],

        findSuggestionMatch: ({ $position }) => {
          const text = $position.nodeBefore?.isText ? $position.nodeBefore.text : null
          if (!text) return null
          const match = QUERY.exec(text)
          if (!match || match[0].length > MAX_QUERY) return null

          const from = $position.pos - (text.length - (match.index ?? 0))
          // Same rule the stock matcher uses: an `@` must start a word.
          const before = text.slice(Math.max(0, (match.index ?? 0) - 1), match.index)
          if (before && ![' ', '(', ' '].includes(before)) return null

          return { range: { from, to: $position.pos }, query: match[1] ?? '', text: match[0] }
        },

        items: ({ query }) => {
          const all = entities()
          const needle = query.trim()
          const pool = needle ? all.filter((e) => tokenMatch(e.name, needle)) : all

          // Rank first, and cut to the shortlist on relevance alone — grouping
          // must decide the running order, never which names make the list.
          // Shortest first, so typing "Krag" offers "Krag" above "Krag's Forge".
          const ranked = [...pool]
            .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
            .slice(0, LIMIT)

          // Then gather each kind together. Kinds appear in the order their
          // best match did, so the strongest match stays first overall and is
          // what Enter takes. `sort` is stable, so ranking survives inside each
          // group — and the flat order now matches what is drawn, which is what
          // the arrow keys move through.
          const order = new Map<string, number>()
          for (const e of ranked) if (!order.has(e.type)) order.set(e.type, order.size)
          ranked.sort((a, b) => (order.get(a.type) ?? 0) - (order.get(b.type) ?? 0))

          return ranked.map((e) => ({ id: e.id, name: e.name, type: e.type }))
        },

        command: ({ editor, range, props }) => insert(editor, range, props),

        render: () => {
          let items: MentionItem[] = []
          let current: { editor: Editor; range: Range } | null = null

          const select = (item: MentionItem) => {
            if (current) insert(current.editor, current.range, item)
          }

          return {
            onStart: (props) => {
              items = props.items
              current = { editor: props.editor, range: props.range }
              renderer().onStart({ items, select, rect: props.clientRect?.() ?? null })
            },
            onUpdate: (props) => {
              items = props.items
              current = { editor: props.editor, range: props.range }
              renderer().onUpdate({ items, select, rect: props.clientRect?.() ?? null })
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                renderer().onExit()
                return true
              }
              // Critical: with no matches, Enter and Tab must fall through, or
              // pressing Enter after an unmatched @word would silently refuse to
              // break the paragraph.
              if (items.length === 0) return false
              return renderer().onKeyDown(props.event)
            },
            onExit: () => {
              current = null
              items = []
              renderer().onExit()
            },
          }
        },
      }

      return [Suggestion(options)]
    },
  })
}
