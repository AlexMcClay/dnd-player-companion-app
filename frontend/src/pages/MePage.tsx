import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Entity } from '@codex/shared'
import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  LuBackpack,
  LuLink,
  LuNotebookPen,
  LuPencil,
  LuScrollText,
  LuUsers,
  LuVault,
} from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import AddItemSheet from '../components/AddItemSheet'
import { CharacterPicker, CharacterSwitcherPortal } from '../components/CharacterPicker'
import DdbPanel from '../components/DdbPanel'
import HoldingRow from '../components/HoldingRow'
import Markdown from '../components/Markdown'
import NoteComposer from '../components/NoteComposer'
import NoteList from '../components/NoteList'
import WikiText from '../components/WikiText'
import { Empty, Loading, PageHead, Portrait, Section, StaggerList } from '../components/bits'
import { ctaClass, panelClass } from '../components/ui'
import { usePlayerId } from '../lib/identity'
import { SPRING } from '../lib/motion'
import { templateFor } from '../templates'

/** Your own character: who you are and what you are carrying. Notes land here next. */
export default function MePage() {
  const playerId = usePlayerId()
  if (!playerId) return <PickCharacter />
  return <MyCharacter playerId={playerId} />
}

function MyCharacter({ playerId }: { playerId: string }) {
  const me = useQuery({
    queryKey: ['entity', playerId],
    queryFn: () => api.getEntity(playerId),
  })

  const carried = useQuery({
    queryKey: ['holdings', { owner: playerId }],
    queryFn: () => api.listHoldings({ owner: playerId }),
  })

  if (me.isLoading) return <Loading />
  if (me.isError || !me.data) return <PickCharacter problem="That character no longer exists." />

  const character = me.data
  const template = templateFor(character.type)
  const stacks = carried.data ?? []
  const total = stacks.reduce((sum, holding) => sum + holding.quantity, 0)

  return (
    <>
      <PageHead>
        <div className="flex items-start gap-3.25">
          <Portrait entity={character} size={92} />
          <div className="min-w-0 flex-1">
            <h1 className="type-title m-0">{character.name}</h1>
            {character.summary && <div className="type-meta mt-1">{character.summary}</div>}
            <Link to={`/e/${character.id}`} className="type-meta mt-2 inline-block text-gold">
              Full sheet →
            </Link>
          </div>
        </div>
      </PageHead>

      <div className="flex flex-col gap-4">
        <SpecPanel character={character} template={template} />

        <Section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="type-lab flex items-center gap-1.75">
              <LuScrollText aria-hidden />
              About {character.name.split(' ')[0] ?? character.name}
            </span>
            <span className="type-meta">Yours to write</span>
          </div>
          <CharacterBody character={character} />
        </Section>

        <Section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="type-lab flex items-center gap-1.75">
              <LuLink aria-hidden />
              D&amp;D Beyond
            </span>
            <span className="type-meta">Mirror — kept apart from the app's items</span>
          </div>
          <DdbPanel playerId={character.id} characterName={character.name} />
        </Section>

        <Section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="type-lab flex items-center gap-1.75">
              <LuBackpack aria-hidden />
              Carrying
            </span>
            <span className="type-meta">
              {stacks.length} entries · {total} items
            </span>
          </div>

          {carried.isLoading ? (
            <Loading />
          ) : (
            <StaggerList>
              {stacks.map((holding) => (
                <HoldingRow
                  key={holding.id}
                  holding={holding}
                  onMove={{ label: 'Move to party stash', icon: LuVault, ownerId: null }}
                />
              ))}
            </StaggerList>
          )}

          {!carried.isLoading && stacks.length === 0 && <Empty>Carrying nothing</Empty>}

          <AddItemSheet ownerId={playerId} destination={character.name} />
        </Section>

        <Section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="type-lab flex items-center gap-1.75">
              <LuNotebookPen aria-hidden />
              My vault
            </span>
            <span className="type-meta">Private unless you share it</span>
          </div>
          <NoteList
            placement="vault"
            author="me"
            emptyLabel="Your notebook is empty"
            addLabel="Write a note"
          />
        </Section>

        <SwitchCharacter />
      </div>
    </>
  )
}

/**
 * The character's own description, and the one thing on their sheet they are
 * allowed to change — the API lets a player write `bodyMd` on their own
 * character and nothing else.
 */
function CharacterBody({ character }: { character: Entity }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (bodyMd: string) => api.updateEntity(character.id, { bodyMd: bodyMd || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['entity', character.id] })
      // The wiki-link index and any list showing this character go stale too.
      await queryClient.invalidateQueries({ queryKey: ['entities'] })
      setEditing(false)
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  if (editing) {
    return (
      <NoteComposer
        initial={{ bodyMd: character.bodyMd ?? '' }}
        withVisibility={false}
        submitLabel="Save"
        placeholder={'Who are they? Markdown works, and [[The Gutted Lamp]] links an entry.'}
        busy={save.isPending}
        error={error}
        onSubmit={(draft) => save.mutate(draft.bodyMd)}
        onCancel={() => {
          setEditing(false)
          setError(null)
        }}
      />
    )
  }

  return (
    <>
      {character.bodyMd ? (
        <Markdown source={character.bodyMd} />
      ) : (
        <Empty>Nothing written yet</Empty>
      )}
      <motion.button
        type="button"
        className={ctaClass('ghost')}
        whileTap={{ scale: 0.98 }}
        transition={SPRING}
        onClick={() => setEditing(true)}
      >
        <LuPencil aria-hidden />
        {character.bodyMd ? 'Edit' : 'Write something'}
      </motion.button>
    </>
  )
}

function SpecPanel({
  character,
  template,
}: {
  character: { data: Record<string, unknown> }
  template: ReturnType<typeof templateFor>
}) {
  const rows = template.fields
    .map((field) => ({ field, value: character.data[field.key] }))
    .filter(({ value }) => value !== undefined && value !== null && value !== '')

  if (rows.length === 0) return null

  return (
    <div className={panelClass('grid grid-cols-3 gap-x-2 gap-y-2.5')}>
      {rows.map(({ field, value }) => (
        <div key={field.key}>
          <div className="type-meta">{field.label}</div>
          <div className="mt-0.75 text-[15px]">
            <WikiText text={String(value)} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SwitchCharacter() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <motion.button
        type="button"
        className={ctaClass('ghost')}
        whileTap={{ scale: 0.98 }}
        transition={SPRING}
        onClick={() => setOpen(true)}
      >
        <LuUsers aria-hidden />
        Switch character
      </motion.button>
      <CharacterSwitcherPortal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** Shown when nobody has been chosen — the DM browsing, or after switching. */
function PickCharacter({ problem }: { problem?: string }) {
  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">Pick a character</h1>
        <div className="type-meta">{problem ?? 'This tab shows whoever you are playing'}</div>
      </PageHead>
      <CharacterPicker />
    </>
  )
}
