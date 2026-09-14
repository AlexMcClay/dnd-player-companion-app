import { useQuery } from '@tanstack/react-query'
import { STASH } from '@codex/shared'
import { motion } from 'framer-motion'
import { LuChevronRight, LuNotebookPen, LuVault } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import DmCreateBar from '../components/DmCreateBar'
import NoteList from '../components/NoteList'
import {
  Empty,
  EntityRow,
  Loading,
  PageHead,
  Section,
  SectionHead,
  StaggerList,
} from '../components/bits'
import { panelClass } from '../components/ui'
import { SPRING } from '../lib/motion'

/** The party: who is in it, and what the party owns collectively. */
export default function PartyPage() {
  const players = useQuery({
    queryKey: ['entities', { type: 'player' }],
    queryFn: () => api.listEntities({ type: 'player' }),
  })

  const stash = useQuery({
    queryKey: ['holdings', { owner: STASH }],
    queryFn: () => api.listHoldings({ owner: STASH }),
  })

  if (players.isLoading) return <Loading />

  const stacks = stash.data ?? []
  const total = stacks.reduce((sum, holding) => sum + holding.quantity, 0)

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">The Party</h1>
        <div className="type-meta">{players.data?.length ?? 0} characters</div>
      </PageHead>

      <div className="flex flex-col gap-4">
        <Section className="flex flex-col gap-2">
          <SectionHead label="Characters" />
          <StaggerList>
            {players.data?.map((entity) => (
              <EntityRow key={entity.id} entity={entity} portraitSize={52} />
            ))}
          </StaggerList>
          {players.data?.length === 0 && <Empty>No characters yet</Empty>}
        </Section>

        <Section>
          <StashCard
            loading={stash.isLoading}
            entries={stacks.length}
            total={total}
            preview={stacks.slice(0, 3).map((holding) => holding.item.name)}
          />
        </Section>

        <Section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="type-lab flex items-center gap-1.75">
              <LuNotebookPen aria-hidden />
              Party board
            </span>
            <span className="type-meta">Everyone can read these</span>
          </div>
          <NoteList
            placement="party"
            emptyLabel="Nothing on the board yet"
            addLabel="Post to the board"
          />
        </Section>

        <DmCreateBar path="/party" />
      </div>
    </>
  )
}

/**
 * Stands in for the stash on this page. A count and the first few names are
 * enough to know whether it is worth opening; the full list has its own screen
 * so it cannot bury the board below it.
 */
function StashCard({
  loading,
  entries,
  total,
  preview,
}: {
  loading: boolean
  entries: number
  total: number
  preview: string[]
}) {
  const summary = loading
    ? 'Counting…'
    : entries === 0
      ? 'Empty — nothing pooled yet'
      : [...preview, entries > preview.length ? `+${entries - preview.length} more` : null]
          .filter(Boolean)
          .join(' · ')

  return (
    <motion.div whileTap={{ scale: 0.98 }} transition={SPRING}>
      <Link to="/party/stash" className={panelClass('flex items-center gap-3')}>
        <span className="grid size-10 shrink-0 place-items-center border border-gold-dim bg-gold-tint text-gold">
          <LuVault className="size-4.5" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="type-lab block">Party stash</span>
          <span className="type-meta mt-0.75 block truncate normal-case tracking-normal">
            {summary}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {!loading && entries > 0 && (
            <span className="type-meta whitespace-nowrap">{total} items</span>
          )}
          <LuChevronRight className="size-4 text-ink-faint" aria-hidden />
        </span>
      </Link>
    </motion.div>
  )
}
