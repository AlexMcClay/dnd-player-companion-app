import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Empty, EntityRow, Loading, SectionHead } from '../components/bits'
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
      <div className="head">
        <h1 className="ttl">Codex</h1>
        <div className="meta">Everything the party has confirmed in play</div>
      </div>

      <div className="stack gap-16">
        <section className="stack gap-8">
          <SectionHead label="Bestiary" note={`${monsters.data?.length ?? 0} entries`} />
          <div>
            {monsters.data?.map((entity) => (
              <EntityRow key={entity.id} entity={entity} portraitSize={52} />
            ))}
          </div>
          {monsters.data?.length === 0 && <Empty>Nothing catalogued yet</Empty>}
        </section>

        <section className="stack gap-8">
          <SectionHead label="Factions" note={`${factions.data?.length ?? 0} known`} />
          <div>
            {factions.data?.map((entity) => (
              <EntityRow key={entity.id} entity={entity} portraitSize={44} />
            ))}
          </div>
          {factions.data?.length === 0 && <Empty>No factions recorded yet</Empty>}
        </section>

        <DmCreateBar types={['monster', 'faction']} />
      </div>
    </>
  )
}
