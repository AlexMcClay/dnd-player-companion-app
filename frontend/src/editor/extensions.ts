import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import type { AnyExtension } from '@tiptap/core'
import { createWikiMarked } from '../lib/wikiMarked'
import { WikiLink } from './WikiLink'

/**
 * One marked instance for every editor on the page.
 *
 * It already carries the wiki-link tokenizer, which is why `WikiLink` declares
 * no `markdownTokenizer` of its own — that would make Tiptap register a second
 * copy onto this instance for every editor mounted.
 */
export const editorMarked = createWikiMarked()

/**
 * The editor's schema. Exported rather than inlined so the headless round-trip
 * check can parse and serialise with exactly what the editor uses — a check
 * against a different extension list would prove nothing.
 */
export function editorExtensions(placeholder?: string): AnyExtension[] {
  return [
    StarterKit.configure({
      // No markdown form. It would serialise as a raw <u> tag, which then reads
      // back as literal text.
      underline: false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    WikiLink,
    Markdown.configure({
      // A `Marked` instance satisfies everything the extension calls, but its
      // option is typed as the module namespace, which additionally declares
      // `getDefaults`. Instances are what the docs pass.
      marked: editorMarked as unknown as Parameters<typeof Markdown.configure>[0] extends {
        marked?: infer M
      }
        ? M
        : never,
      // Matches the renderer: a single newline is a line break, not a new
      // paragraph. If these disagreed, every soft-wrapped note would reflow on
      // its first save.
      markedOptions: { gfm: true, breaks: true },
    }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ]
}
