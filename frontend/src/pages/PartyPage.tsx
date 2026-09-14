import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { Empty, EntityRow, Loading, SectionHead } from '../components/bits'
import DmCreateBar from '../components/DmCreateBar'

export default function PartyPage() {
  const [filter, setFilter] = useState<'all' | 'player' | 'npc'>('all')

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
      <div className="head">
        <h1 className="ttl">Party &amp; NPCs</h1>
        <div className="pill-row">
          {(['all', 'player', 'npc'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'pill pill-s' : 'pill pill-n'}
              onClick={() => setFilter(key)}
            >
              {key === 'all' ? 'Everyone' : key === 'player' ? 'Players' : 'NPCs'}
            </button>
          ))}
        </div>
      </div>

      <div className="stack gap-16">
        {showPlayers && (
          <section className="stack gap-8">
            <SectionHead label="The party" note={`${players.data?.length ?? 0} characters`} />
            <div>
              {players.data?.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={52} />
              ))}
            </div>
            {players.data?.length === 0 && <Empty>No player characters yet</Empty>}
          </section>
        )}

        {showNpcs && (
          <section className="stack gap-8">
            <SectionHead label="People you have met" note={`${npcs.data?.length ?? 0} known`} />
            <div>
              {npcs.data?.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={44} />
              ))}
            </div>
            {npcs.data?.length === 0 && <Empty>No NPCs recorded yet</Empty>}
          </section>
        )}

        <DmCreateBar types={['player', 'npc']} />
      </div>
    </>
  )
}
