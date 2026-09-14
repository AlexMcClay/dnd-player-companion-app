import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { api } from '../api/client'
import { Empty, EntityRow, Loading, Section, SectionHead, StaggerList } from '../components/bits'
import DmCreateBar from '../components/DmCreateBar'
import { SPRING } from '../lib/motion'

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
      <div className="head">
        <h1 className="ttl">Party &amp; NPCs</h1>
        <div className="pill-row">
          {FILTERS.map(({ key, label }) => (
            <motion.button
              key={key}
              type="button"
              className={filter === key ? 'pill pill-s' : 'pill pill-n'}
              onClick={() => setFilter(key)}
              whileTap={{ scale: 0.94 }}
              transition={SPRING}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="stack gap-16">
        {showPlayers && (
          <Section className="stack gap-8">
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
          <Section className="stack gap-8">
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
