import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IconType } from 'react-icons'
import {
  LuAtSign,
  LuBold,
  LuHeading,
  LuItalic,
  LuList,
  LuListOrdered,
  LuListTodo,
  LuQuote,
  LuTable,
  LuTrash2,
} from 'react-icons/lu'
import { SPRING } from '../lib/motion'
import { cx, PillButton } from '../components/ui'
import { useAllEntities } from '../lib/useAllEntities'
import { MD, useMediaQuery } from '../lib/useMediaQuery'
import { editorExtensions } from './extensions'
import { meansTheSame } from './fidelity'
import MentionPopover from './MentionPopover'
import { mentionExtension, openMention, type MentionRenderProps } from './mention'

export interface RichEditorProps {
  /** Markdown. Read once at mount; later changes reconcile, see below. */
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  autoFocus?: boolean
  /**
   * Called when the incoming markdown contains something this editor's schema
   * cannot hold — a table, an image, unknown HTML. The caller should fall back
   * to editing the source, rather than let the content be quietly dropped.
   */
  onUnrepresentable?: () => void
}

/**
 * A rich editor over markdown.
 *
 * Deliberately uncontrolled. Feeding `value` back in on every keystroke would
 * re-parse the document and drop the caret to the start; instead the editor owns
 * its state, reports markdown upward, and only accepts an external `value` that
 * differs from what it last emitted.
 */
export default function RichEditor({
  value,
  onChange,
  placeholder,
  autoFocus,
  onUnrepresentable,
}: RichEditorProps) {
  // What we last told the parent. Guards the reconcile effect against our own echo.
  const emitted = useRef(value)

  const { data: entities } = useAllEntities()
  const entitiesRef = useRef(entities ?? [])
  entitiesRef.current = entities ?? []

  // On a phone the keyboard owns the bottom of the screen, so the list docks
  // above it rather than chasing the caret.
  const wide = useMediaQuery(MD)

  const [mention, setMention] = useState<MentionRenderProps | null>(null)
  const [active, setActive] = useState(0)
  // The plugin calls into this synchronously from a keydown, so it has to read
  // the latest handlers without the extension being rebuilt.
  const mentionRef = useRef<MentionRenderProps | null>(null)
  const activeRef = useRef(0)
  mentionRef.current = mention
  activeRef.current = active

  const renderer = useCallback(
    () => ({
      onStart: (props: MentionRenderProps) => {
        setMention(props)
        setActive(0)
      },
      onUpdate: (props: MentionRenderProps) => {
        setMention(props)
        setActive((current) => (current < props.items.length ? current : 0))
      },
      onExit: () => setMention(null),
      onKeyDown: (event: KeyboardEvent) => {
        const items = mentionRef.current?.items ?? []
        if (items.length === 0) return false
        if (event.key === 'ArrowDown') {
          setActive((c) => (c + 1) % items.length)
          return true
        }
        if (event.key === 'ArrowUp') {
          setActive((c) => (c - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = items[activeRef.current]
          if (item) mentionRef.current?.select(item)
          return true
        }
        return false
      },
    }),
    [],
  )

  const extensions = useMemo(
    () => [
      ...editorExtensions(placeholder),
      mentionExtension(() => entitiesRef.current, renderer),
    ],
    [placeholder, renderer],
  )

  const editor = useEditor({
    extensions,
    content: value,
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'md-edit min-h-24 w-full px-3 py-2.75 focus:outline-none',
      },
    },
    onUpdate({ editor: instance }) {
      const markdown = instance.getMarkdown()
      emitted.current = markdown
      onChange(markdown)
    },
  })

  useEffect(() => {
    if (!editor || value === emitted.current) return
    emitted.current = value
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
  }, [editor, value])

  // Ask, once, whether the document survived the trip into the schema. Cheaper
  // and more honest than a list of forbidden syntax: it compares what a reader
  // would see, so it catches anything the schema drops — now or in future.
  useEffect(() => {
    if (!editor || !onUnrepresentable || !value.trim()) return
    if (!meansTheSame(value, editor.getMarkdown())) onUnrepresentable()
    // Deliberately only on mount: once the user is typing, the document is
    // whatever the editor says it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-col border border-line bg-ink-tint focus-within:border-gold-dim">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {mention && (
        <MentionPopover
          items={mention.items}
          active={active}
          onHover={setActive}
          select={mention.select}
          rect={mention.rect}
          docked={!wide}
        />
      )}
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  // v3 does not re-render on every transaction, so active states must be
  // selected explicitly rather than read during render.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      heading: e.isActive('heading', { level: 2 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      table: e.isActive('table'),
    }),
  })

  return (
    <>
      {/* pan-x so a horizontal drag scrolls the row instead of being read as a
          swipe between tabs, which would discard the draft. */}
      <div
        className="flex touch-pan-x items-center gap-0.5 overflow-x-auto border-b border-line-soft px-1.5 py-1"
        // Keeps focus in the document, so pressing a button never closes the
        // on-screen keyboard or loses the selection being formatted.
        onMouseDown={(event) => event.preventDefault()}
      >
        <Button icon={LuBold} label="Bold" on={active.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Button icon={LuItalic} label="Italic" on={active.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Button
          icon={LuHeading}
          label="Heading"
          on={active.heading}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <Divider />
        <Button icon={LuList} label="Bullet list" on={active.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Button icon={LuListOrdered} label="Numbered list" on={active.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Button icon={LuListTodo} label="Checklist" on={active.task} onClick={() => editor.chain().focus().toggleTaskList().run()} />
        <Button icon={LuQuote} label="Quote" on={active.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Divider />
        {/* The @ trigger needs a space before it to fire, so this cannot just
            insert the character — see openMention. */}
        <Button icon={LuAtSign} label="Link an entry" on={false} onClick={() => openMention(editor)} />
        <Divider />
        {/* Two columns and a header row: a roll table, which is what a table in
            these notes almost always is. Rows are added as they are needed. */}
        <Button
          icon={LuTable}
          label="Insert table"
          on={active.table}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()
          }
        />
      </div>

      {active.table && <TableBar editor={editor} />}
    </>
  )
}

/**
 * Row and column controls, shown only with the caret inside a table.
 *
 * Hidden otherwise because every button here is dead outside one, and the
 * toolbar above is already full on a phone.
 *
 * Words rather than icons: five variations on a grid glyph are
 * indistinguishable at 14px, and a row that appears this rarely can afford the
 * space. Each acts on the cell the caret is in, which is why there is no
 * "where" to choose — you put the caret in the row you mean.
 */
function TableBar({ editor }: { editor: Editor }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b border-line-soft px-1.5 py-1.5"
      // Same reason as the toolbar above: pressing a button must not take the
      // focus out of the cell being edited.
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="type-lab pl-1 text-ink-faint">Table</span>
      <PillButton tone="neutral" onClick={() => editor.chain().focus().addRowAfter().run()}>
        + Row
      </PillButton>
      <PillButton tone="neutral" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        + Column
      </PillButton>
      <PillButton tone="neutral" onClick={() => editor.chain().focus().deleteRow().run()}>
        − Row
      </PillButton>
      <PillButton tone="neutral" onClick={() => editor.chain().focus().deleteColumn().run()}>
        − Column
      </PillButton>
      {/* A tone, not a `text-danger` on the neutral pill: `.text-ink-soft` is
          emitted after `.text-danger`, so that override would lose and the
          button would quietly be the same grey as the rest. */}
      <PillButton
        tone="danger"
        className="ml-auto"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <LuTrash2 aria-hidden />
        Remove
      </PillButton>
    </div>
  )
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-line" aria-hidden />
}

function Button({
  icon: Icon,
  label,
  on,
  onClick,
}: {
  icon: IconType
  label: string
  on: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={cx(
        'grid size-8 shrink-0 cursor-pointer place-items-center rounded-none [&>svg]:size-3.5',
        on ? 'bg-gold-tint text-gold' : 'text-ink-faint',
      )}
      whileTap={{ scale: 0.9 }}
      transition={SPRING}
      onClick={onClick}
    >
      <Icon aria-hidden />
    </motion.button>
  )
}
