import { useQuery } from '@tanstack/react-query'
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

/** Bestiary and factions — the shared pool of what the party knows. */
export default function CodexPage() {
  const monsters = useQuery({
    queryKey: ['entities', { type: 'monster' }],
    queryFn: () => api.listEntities({ type: 'monster' }),
  })
  const factions = useQuery({
    queryKey: ['entities', { type: 'faction' }],
    queryFn: () => api.listEntities({ type: 'faction' }),
  })

  if (monsters.isLoading || factions.isLoading) return <Loading />

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">Codex</h1>
        <div className="type-meta">Everything the party has confirmed in play</div>
      </PageHead>

      <div className="flex flex-col gap-4">
        <Section className="flex flex-col gap-2">
          <SectionHead label="Bestiary" note={`${monsters.data?.length ?? 0} entries`} />
          <StaggerList>
            {monsters.data?.map((entity) => (
              <EntityRow key={entity.id} entity={entity} portraitSize={52} />
            ))}
          </StaggerList>
          {monsters.data?.length === 0 && <Empty>Nothing catalogued yet</Empty>}
        </Section>

        <Section className="flex flex-col gap-2">
          <SectionHead label="Factions" note={`${factions.data?.length ?? 0} known`} />
          <StaggerList>
            {factions.data?.map((entity) => (
              <EntityRow key={entity.id} entity={entity} portraitSize={44} />
            ))}
          </StaggerList>
          {factions.data?.length === 0 && <Empty>No factions recorded yet</Empty>}
        </Section>

        <DmCreateBar types={['monster', 'faction']} />
      </div>
    </>
  )
}
