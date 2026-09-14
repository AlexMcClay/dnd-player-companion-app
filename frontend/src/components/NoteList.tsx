import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotePlacement } from '@codex/shared'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { api, type NoteQuery } from '../api/client'
import { usePlayerId } from '../lib/identity'
import { listVariants, SPRING } from '../lib/motion'
import NoteCard from './NoteCard'
import NoteComposer from './NoteComposer'
import { Empty, Loading } from './bits'
import { ctaClass } from './ui'

/**
 * The query, the list and the composer for one place notes live. All three
 * surfaces — an entry, the vault, the board — are this component with different
 * arguments.
 */
export default function NoteList({
  placement,
  subjectId,
  /** Restrict to one author. 'me' lets the server resolve it. */
  author,
  emptyLabel,
  addLabel = 'Write a note',
}: {
  placement: NotePlacement
  subjectId?: string
  author?: string
  emptyLabel: string
  addLabel?: string
}) {
  const queryClient = useQueryClient()
  const playerId = usePlayerId()
  const [composing, setComposing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query: NoteQuery = { placement, subject: subjectId, author }

  const notes = useQuery({
    queryKey: ['notes', query],
    queryFn: () => api.listNotes(query),
  })

  const create = useMutation({
    mutationFn: (draft: { title: string | null; bodyMd: string; visibility: 'private' | 'shared' }) =>
      api.createNote({
        placement,
        subjectId: subjectId ?? null,
        title: draft.title,
        bodyMd: draft.bodyMd,
        visibility: draft.visibility,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
      setComposing(false)
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const rows = notes.data ?? []

  return (
    <div className="flex flex-col gap-2">
      {notes.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>{emptyLabel}</Empty>
      ) : (
        <motion.div
          className="flex flex-col gap-2"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {rows.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </motion.div>
      )}

      {/* Without a character there is nobody to sign a note, so the server
          would reject it — do not offer the control. */}
      {playerId === null ? (
        <div className="type-meta">Pick a character to write notes.</div>
      ) : composing ? (
        <NoteComposer
          withTitle={placement !== 'entry'}
          withVisibility={placement !== 'party'}
          busy={create.isPending}
          error={error}
          onSubmit={(draft) => create.mutate(draft)}
          onCancel={() => {
            setComposing(false)
            setError(null)
          }}
        />
      ) : (
        <motion.button
          type="button"
          className={ctaClass('ghost')}
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          onClick={() => setComposing(true)}
        >
          <LuPlus aria-hidden />
          {addLabel}
        </motion.button>
      )}
    </div>
  )
}
