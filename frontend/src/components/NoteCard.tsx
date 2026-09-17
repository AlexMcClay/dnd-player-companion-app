import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Note } from '@codex/shared'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { LuEyeOff, LuPencil, LuTrash2 } from 'react-icons/lu'
import { api } from '../api/client'
import { useIsDm, usePlayerId } from '../lib/identity'
import { rowVariants, SPRING } from '../lib/motion'
import { relativeTime } from '../lib/relativeTime'
import Markdown from './Markdown'
import NoteComposer from './NoteComposer'
import { Pill, panelClass } from './ui'

export default function NoteCard({ note }: { note: Note }) {
  const queryClient = useQueryClient()
  const playerId = usePlayerId()
  const isDm = useIsDm()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)

  const isAuthor = playerId !== null && note.authorId === playerId
  // The DM tidies up but does not rewrite — a byline you cannot trust is worse
  // than a note you cannot edit.
  const canEdit = isAuthor
  const canDelete = isAuthor || isDm

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notes'] })

  const save = useMutation({
    mutationFn: (input: Parameters<typeof api.updateNote>[1]) => api.updateNote(note.id, input),
    onSuccess: async () => {
      await invalidate()
      setEditing(false)
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: () => api.deleteNote(note.id),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  })

  return (
    <motion.article className={panelClass('flex flex-col gap-2')} variants={rowVariants}>
      <header className="flex items-center gap-2">
        {/* Falls back to the initial when the portrait will not load, the same
            way it does for an author who has none — see Portrait in bits. */}
        {note.author.imageUrl && note.author.imageUrl !== brokenUrl ? (
          <img
            src={note.author.imageUrl}
            alt=""
            className="size-7 shrink-0 rounded-full border border-line object-cover"
            onError={() => setBrokenUrl(note.author.imageUrl)}
          />
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-[9px] text-ink-faint">
            {note.author.name.slice(0, 1)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="type-lab truncate">{note.author.name}</div>
          <div className="type-meta">{relativeTime(note.createdAt)}</div>
        </div>

        {note.visibility === 'private' && (
          <Pill tone="neutral">
            <LuEyeOff aria-hidden />
            Private
          </Pill>
        )}
      </header>

      {editing ? (
        <NoteComposer
          initial={{ title: note.title, bodyMd: note.bodyMd, visibility: note.visibility }}
          withTitle={note.placement !== 'entry'}
          withVisibility={note.placement !== 'party'}
          submitLabel="Save"
          busy={save.isPending}
          error={error}
          onSubmit={(draft) => save.mutate(draft)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {note.title && <div className="type-name">{note.title}</div>}
          <Markdown source={note.bodyMd} />

          {(canEdit || canDelete) && (
            <div className="flex gap-3 border-t border-line-soft pt-2">
              {canEdit && (
                <motion.button
                  type="button"
                  className="type-meta flex cursor-pointer items-center gap-1 text-ink-faint"
                  whileTap={{ scale: 0.94 }}
                  transition={SPRING}
                  onClick={() => setEditing(true)}
                >
                  <LuPencil aria-hidden />
                  Edit
                </motion.button>
              )}
              {canDelete && (
                <motion.button
                  type="button"
                  className="type-meta flex cursor-pointer items-center gap-1 text-danger"
                  whileTap={{ scale: 0.94 }}
                  transition={SPRING}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm('Delete this note?')) remove.mutate()
                  }}
                >
                  <LuTrash2 aria-hidden />
                  {isAuthor ? 'Delete' : 'Remove'}
                </motion.button>
              )}
            </div>
          )}

          {error && !editing && <div className="type-meta text-danger">{error}</div>}
        </>
      )}
    </motion.article>
  )
}
