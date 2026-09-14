import { useQuery } from '@tanstack/react-query'
import { STASH } from '@codex/shared'
import { LuVault } from 'react-icons/lu'
import { api } from '../api/client'
import AddItemSheet from '../components/AddItemSheet'
import DmCreateBar from '../components/DmCreateBar'
import HoldingRow from '../components/HoldingRow'
import {
  Empty,
  EntityRow,
  Loading,
  PageHead,
  Section,
  SectionHead,
  StaggerList,
} from '../components/bits'
import { usePlayerId } from '../lib/identity'

/** The party: who is in it, and what the party owns collectively. */
export default function PartyPage() {
  const playerId = usePlayerId()

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

        <Section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="type-lab flex items-center gap-1.75">
              <LuVault aria-hidden />
              Party stash
            </span>
            <span className="type-meta">
              {stacks.length} entries · {total} items
            </span>
          </div>

          {stash.isLoading ? (
            <Loading />
          ) : (
            <StaggerList>
              {stacks.map((holding) => (
                <HoldingRow
                  key={holding.id}
                  holding={holding}
                  // Anyone browsing as a character can pull from the stash.
                  onMove={playerId ? { label: 'Take it', ownerId: playerId } : undefined}
                />
              ))}
            </StaggerList>
          )}

          {!stash.isLoading && stacks.length === 0 && <Empty>The stash is empty</Empty>}

          <AddItemSheet ownerId={null} destination="the party stash" />
        </Section>

        <DmCreateBar path="/party" />
      </div>
    </>
  )
}
