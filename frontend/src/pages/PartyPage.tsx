import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import {
  Empty,
  EntityRow,
  Loading,
  PageHead,
  Section,
  SectionHead,
  StaggerList,
} from '../components/bits'
import DmCreateBar from '../components/DmCreateBar'
import { PillButton } from '../components/ui'

const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'player', label: 'Players' },
  { key: 'npc', label: 'NPCs' },
] as const

export default function PartyPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')

  const players = useQuery({
    queryKey: ['entities', { type: 'player' }],
    queryFn: () => api.listEntities({ type: 'player' }),
  })
  const npcs = useQuery({
    queryKey: ['entities', { type: 'npc' }],
    queryFn: () => api.listEntities({ type: 'npc' }),
  })

  if (players.isLoading || npcs.isLoading) return <Loading />

  const showPlayers = filter !== 'npc'
  const showNpcs = filter !== 'player'

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">Party &amp; NPCs</h1>
        <div className="flex flex-wrap gap-1.75">
          {FILTERS.map(({ key, label }) => (
            <PillButton
              key={key}
              tone={filter === key ? 'solid' : 'neutral'}
              onClick={() => setFilter(key)}
            >
              {label}
            </PillButton>
          ))}
        </div>
      </PageHead>

      <div className="flex flex-col gap-4">
        {showPlayers && (
          <Section className="flex flex-col gap-2">
            <SectionHead label="The party" note={`${players.data?.length ?? 0} characters`} />
            <StaggerList>
              {players.data?.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={52} />
              ))}
            </StaggerList>
            {players.data?.length === 0 && <Empty>No player characters yet</Empty>}
          </Section>
        )}

        {showNpcs && (
          <Section className="flex flex-col gap-2">
            <SectionHead label="People you have met" note={`${npcs.data?.length ?? 0} known`} />
            <StaggerList>
              {npcs.data?.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={44} />
              ))}
            </StaggerList>
            {npcs.data?.length === 0 && <Empty>No NPCs recorded yet</Empty>}
          </Section>
        )}

        <DmCreateBar types={['player', 'npc']} />
      </div>
    </>
  )
}
