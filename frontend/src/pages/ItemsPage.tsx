import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { api } from '../api/client'
import { Empty, EntityRow, Loading, Section, SectionHead, StaggerList } from '../components/bits'
import DmCreateBar from '../components/DmCreateBar'
import { SPRING } from '../lib/motion'

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
      <div className="head">
        <h1 className="ttl">Items</h1>
        <div className="pill-row">
          {scopes.map(({ key, label }) => (
            <motion.button
              key={key}
              type="button"
              className={scope === key ? 'pill pill-s' : 'pill pill-n'}
              onClick={() => setScope(key)}
              whileTap={{ scale: 0.94 }}
              transition={SPRING}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="stack gap-16">
        {showStash && (
          <Section className="stack gap-8">
            <SectionHead label="Party stash" note={`${stash.length} items`} />
            <StaggerList>
              {stash.map((item) => (
                <EntityRow
                  key={item.id}
                  entity={item}
                  portraitSize={40}
                  right={<span className="meta">×{item.quantity}</span>}
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
            <Section key={player.id} className="stack gap-8">
              <SectionHead label={`${player.name} carries`} note={`${carried.length} items`} />
              <StaggerList>
                {carried.map((item) => (
                  <EntityRow
                    key={item.id}
                    entity={item}
                    portraitSize={40}
                    right={<span className="meta">×{item.quantity}</span>}
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
