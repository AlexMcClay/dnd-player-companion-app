import { motion } from 'framer-motion'
import type { NoteVisibility } from '@codex/shared'
import { useState } from 'react'
import { LuEyeOff, LuSend, LuUsers, LuX } from 'react-icons/lu'
import { SPRING } from '../lib/motion'
import { Cta, ctaClass, cx, inputClass, PillButton, textareaClass } from './ui'

export interface NoteDraft {
  title: string | null
  bodyMd: string
  visibility: NoteVisibility
}

/**
 * Writes and edits a note. Used inline on an entry, in the vault and on the
 * board — the differences are whether a title and a privacy toggle are offered.
 */
export default function NoteComposer({
  initial,
  withTitle = false,
  withVisibility = true,
  submitLabel = 'Post',
  busy = false,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<NoteDraft>
  /** Vault and board notes usually want one; a note on an NPC rarely does. */
  withTitle?: boolean
  /** The party board forbids private notes, so it hides the toggle. */
  withVisibility?: boolean
  submitLabel?: string
  busy?: boolean
  error?: string | null
  onSubmit: (draft: NoteDraft) => void
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [bodyMd, setBodyMd] = useState(initial?.bodyMd ?? '')
  const [visibility, setVisibility] = useState<NoteVisibility>(initial?.visibility ?? 'shared')

  const empty = bodyMd.trim().length === 0

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (empty) return
    onSubmit({ title: title.trim() || null, bodyMd: bodyMd.trim(), visibility })
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      {withTitle && (
        <input
          className={inputClass}
          value={title}
          placeholder="Title (optional)"
          onChange={(e) => setTitle(e.target.value)}
        />
      )}

      <textarea
        className={cx(textareaClass, 'min-h-24')}
        value={bodyMd}
        placeholder="Write a note. Link an entry with [[Their Name]]."
        onChange={(e) => setBodyMd(e.target.value)}
      />

      {withVisibility && (
        <div className="flex flex-wrap gap-1.75">
          <PillButton
            tone={visibility === 'shared' ? 'solid' : 'neutral'}
            onClick={() => setVisibility('shared')}
          >
            <LuUsers aria-hidden />
            Shared
          </PillButton>
          <PillButton
            tone={visibility === 'private' ? 'solid' : 'neutral'}
            onClick={() => setVisibility('private')}
          >
            <LuEyeOff aria-hidden />
            Private
          </PillButton>
        </div>
      )}

      {error && <div className="type-meta text-danger">{error}</div>}

      <div className="flex gap-2">
        <Cta type="submit" disabled={busy || empty}>
          <LuSend aria-hidden />
          {busy ? 'Saving…' : submitLabel}
        </Cta>
        {onCancel && (
          <motion.button
            type="button"
            className={ctaClass('ghost')}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            onClick={onCancel}
          >
            <LuX aria-hidden />
            Cancel
          </motion.button>
        )}
      </div>
    </form>
  )
}
