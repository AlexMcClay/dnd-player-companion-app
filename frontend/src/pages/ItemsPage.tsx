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

  const scopes = [
    { key: 'all', label: 'All' },
    { key: 'stash', label: 'Party stash' },
    ...(players.data ?? []).map((player) => ({
      key: player.id,
      label: player.name.split(' ')[0] ?? player.name,
    })),
  ]

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">Items</h1>
        <div className="flex flex-wrap gap-1.75">
          {scopes.map(({ key, label }) => (
            <PillButton
              key={key}
              tone={scope === key ? 'solid' : 'neutral'}
              onClick={() => setScope(key)}
            >
              {label}
            </PillButton>
          ))}
        </div>
      </PageHead>

      <div className="flex flex-col gap-4">
        {showStash && (
          <Section className="flex flex-col gap-2">
            <SectionHead label="Party stash" note={`${stash.length} items`} />
            <StaggerList>
              {stash.map((item) => (
                <EntityRow
                  key={item.id}
                  entity={item}
                  portraitSize={40}
                  right={<span className="type-meta">×{item.quantity}</span>}
                />
              ))}
            </StaggerList>
            {stash.length === 0 && <Empty>The stash is empty</Empty>}
          </Section>
        )}

        {visiblePlayers.map((player) => {
          const carried = carriedBy(player.id)
          if (carried.length === 0 && scope === 'all') return null
          return (
            <Section key={player.id} className="flex flex-col gap-2">
              <SectionHead label={`${player.name} carries`} note={`${carried.length} items`} />
              <StaggerList>
                {carried.map((item) => (
                  <EntityRow
                    key={item.id}
                    entity={item}
                    portraitSize={40}
                    right={<span className="type-meta">×{item.quantity}</span>}
                  />
                ))}
              </StaggerList>
              {carried.length === 0 && <Empty>Carrying nothing</Empty>}
            </Section>
          )
        })}

        {all.length === 0 && <Empty>No items recorded yet</Empty>}

        <DmCreateBar types={['item']} />
      </div>
    </>
  )
}
