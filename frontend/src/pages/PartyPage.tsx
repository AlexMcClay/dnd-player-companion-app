import { useQuery } from '@tanstack/react-query'
import { STASH } from '@codex/shared'
import { motion } from 'framer-motion'
import type { IconType } from 'react-icons'
import { LuChevronRight, LuLink, LuNotebookPen, LuVault } from 'react-icons/lu'
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

  const ddb = useQuery({ queryKey: ['ddb', 'party'], queryFn: () => api.getDdbParty() })

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

        {/*
          Side by side from md up. They are siblings — two inventories the party
          has — so a row says that more plainly than a stack, and each is only a
          count and a few names wide.
        */}
        <Section className="grid gap-3 md:grid-cols-2">
          <SummaryCard
            to="/party/stash"
            icon={LuVault}
            label="Party stash"
            summary={
              stash.isLoading
                ? 'Counting…'
                : stacks.length === 0
                  ? 'Empty — nothing pooled yet'
                  : previewOf(
                      stacks.map((holding) => holding.item.name),
                      stacks.length,
                    )
            }
            right={!stash.isLoading && stacks.length > 0 ? `${total} items` : undefined}
          />

          <SummaryCard
            to="/party/ddb"
            icon={LuLink}
            label="D&D Beyond stash"
            summary={
              ddb.isLoading
                ? 'Checking…'
                : !ddb.data
                  ? 'Not synced yet'
                  : previewOf(
                      ddb.data.items.map((i) => i.name),
                      ddb.data.items.length,
                    ) || 'No items'
            }
            right={ddb.data ? `${ddb.data.currencies.gp ?? 0} gp` : undefined}
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
 * Stands in for an inventory on this page. A count and the first few names are
 * enough to know whether it is worth opening; each full list has its own screen
 * so neither can bury the board below them.
 *
 * Shared by the app's stash and the D&D Beyond mirror, which is what keeps the
 * two reading as siblings — only one of them is editable.
 */
function SummaryCard({
  to,
  icon: Icon,
  label,
  summary,
  right,
}: {
  to: string
  icon: IconType
  label: string
  summary: string
  right?: string
}) {
  return (
    // h-full both here and on the link, so the two cards match height in the
    // grid however long their previews are.
    <motion.div className="h-full" whileTap={{ scale: 0.98 }} transition={SPRING}>
      <Link to={to} className={panelClass('flex h-full items-center gap-3')}>
        <span className="grid size-10 shrink-0 place-items-center border border-gold-dim bg-gold-tint text-gold">
          <Icon className="size-4.5" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="type-lab block">{label}</span>
          <span className="type-meta mt-0.75 block truncate tracking-normal normal-case">
            {summary}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {right && <span className="type-meta whitespace-nowrap">{right}</span>}
          <LuChevronRight className="size-4 text-ink-faint" aria-hidden />
        </span>
      </Link>
    </motion.div>
  )
}

/** "Ashgate Firesalt · Emberdraught · +3 more" */
function previewOf(names: string[], total: number): string {
  const shown = names.slice(0, 3)
  return [...shown, total > shown.length ? `+${total - shown.length} more` : null]
    .filter(Boolean)
    .join(' · ')
}
