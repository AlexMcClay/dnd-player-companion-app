import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import DmCreateBar from '../components/DmCreateBar'
import {
  Empty,
  EntityRow,
  Loading,
  PageHead,
  Section,
  SectionHead,
  StaggerList,
} from '../components/bits'
import { PillButton } from '../components/ui'
import { CODEX_TYPES, templateFor } from '../templates'

type CodexType = (typeof CODEX_TYPES)[number]

const BLURB: Record<CodexType, string> = {
  npc: 'People the party has met',
  faction: 'Who holds power, and how they feel about you',
  monster: 'What you have fought, and what you learned',
  item: 'The repository — everything the party can lay hands on',
}

/**
 * The whole shared pool of knowledge. Four groups is too much to stack on a
 * phone, so one is shown at a time.
 */
export default function CodexPage() {
  const [group, setGroup] = useState<CodexType>('npc')

  const entries = useQuery({
    queryKey: ['entities', { type: group }],
    queryFn: () => api.listEntities({ type: group }),
  })

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">Codex</h1>
        <div className="flex flex-wrap gap-1.75">
          {CODEX_TYPES.map((type) => (
            <PillButton
              key={type}
              tone={group === type ? 'solid' : 'neutral'}
              onClick={() => setGroup(type)}
            >
              {templateFor(type).plural}
            </PillButton>
          ))}
        </div>
      </PageHead>

      <div className="flex flex-col gap-4">
        <Section className="flex flex-col gap-2">
          <SectionHead
            label={templateFor(group).plural}
            note={entries.data ? `${entries.data.length} entries` : undefined}
          />
          <div className="type-meta">{BLURB[group]}</div>

          {entries.isLoading ? (
            <Loading />
          ) : (
            <StaggerList>
              {entries.data?.map((entity) => (
                <EntityRow key={entity.id} entity={entity} portraitSize={48} />
              ))}
            </StaggerList>
          )}

          {!entries.isLoading && entries.data?.length === 0 && <Empty>Nothing here yet</Empty>}
        </Section>

        <DmCreateBar path="/codex" />
      </div>
    </>
  )
}
