import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { Empty, EntityRow, Loading, SectionHead } from '../components/bits'
import DmCreateBar from '../components/DmCreateBar'

export default function ItemsPage() {
  // 'stash' = unowned, 'all', or a player id.
  const [scope, setScope] = useState<string>('all')

  const items = useQuery({
    queryKey: ['entities', { type: 'item' }],
    queryFn: () => api.listEntities({ type: 'item' }),
  })
  const players = useQuery({
    queryKey: ['entities', { type: 'player' }],
    queryFn: () => api.listEntities({ type: 'player' }),
  })

  if (items.isLoading || players.isLoading) return <Loading />

  const all = items.data ?? []
  const stash = all.filter((item) => item.ownerId === null)
  const carriedBy = (playerId: string) => all.filter((item) => item.ownerId === playerId)

  const visiblePlayers = (players.data ?? []).filter(
    (player) => scope === 'all' || scope === player.id,
  )
  const showStash = scope === 'all' || scope === 'stash'

  return (
    <>
      <div className="head">
        <h1 className="ttl">Items</h1>
        <div className="pill-row">
          <button
            type="button"
            className={scope === 'all' ? 'pill pill-s' : 'pill pill-n'}
            onClick={() => setScope('all')}
          >
            All
          </button>
          <button
            type="button"
            className={scope === 'stash' ? 'pill pill-s' : 'pill pill-n'}
            onClick={() => setScope('stash')}
          >
            Party stash
          </button>
          {players.data?.map((player) => (
            <button
              key={player.id}
              type="button"
              className={scope === player.id ? 'pill pill-s' : 'pill pill-n'}
              onClick={() => setScope(player.id)}
            >
              {player.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="stack gap-16">
        {showStash && (
          <section className="stack gap-8">
            <SectionHead label="Party stash" note={`${stash.length} items`} />
            <div>
              {stash.map((item) => (
                <EntityRow
                  key={item.id}
                  entity={item}
                  portraitSize={40}
                  right={<span className="meta">×{item.quantity}</span>}
                />
              ))}
            </div>
            {stash.length === 0 && <Empty>The stash is empty</Empty>}
          </section>
        )}

        {visiblePlayers.map((player) => {
          const carried = carriedBy(player.id)
          if (carried.length === 0 && scope === 'all') return null
          return (
            <section key={player.id} className="stack gap-8">
              <SectionHead label={`${player.name} carries`} note={`${carried.length} items`} />
              <div>
                {carried.map((item) => (
                  <EntityRow
                    key={item.id}
                    entity={item}
                    portraitSize={40}
                    right={<span className="meta">×{item.quantity}</span>}
                  />
                ))}
              </div>
              {carried.length === 0 && <Empty>Carrying nothing</Empty>}
            </section>
          )
        })}

        {all.length === 0 && <Empty>No items recorded yet</Empty>}

        <DmCreateBar types={['item']} />
      </div>
    </>
  )
}
