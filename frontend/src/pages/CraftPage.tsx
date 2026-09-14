import { useQuery } from '@tanstack/react-query'
import type { EntitySummary, RecipeData } from '@codex/shared'
import { LuCheck } from 'react-icons/lu'
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
import { Pill } from '../components/ui'
import { reagentStatus, stockFor } from '../lib/recipes'

export default function CraftPage() {
  const recipes = useQuery({
    queryKey: ['entities', { type: 'recipe' }],
    queryFn: () => api.listEntities({ type: 'recipe' }),
  })
  // Availability is what the party *holds*, everywhere, not what the Codex lists.
  const holdings = useQuery({
    queryKey: ['holdings', {}],
    queryFn: () => api.listHoldings(),
  })

  if (recipes.isLoading || holdings.isLoading) return <Loading />

  const stock = stockFor(holdings.data ?? [])
  const all = recipes.data ?? []

  const canMake = (recipe: EntitySummary) => {
    const ingredients = (recipe.data as RecipeData).ingredients ?? []
    return ingredients.length > 0 && reagentStatus(ingredients, stock).every((r) => r.enough)
  }

  const ready = all.filter(canMake)
  const rest = all.filter((recipe) => !canMake(recipe))

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">Crafting</h1>
        <div className="type-meta">{all.length} recipes the party knows</div>
      </PageHead>

      <div className="flex flex-col gap-4">
        {ready.length > 0 && (
          <Section className="flex flex-col gap-2">
            <SectionHead label="Ready to make" note={`${ready.length} with reagents in hand`} />
            <StaggerList>
              {ready.map((recipe) => (
                <EntityRow
                  key={recipe.id}
                  entity={recipe}
                  portraitSize={44}
                  right={
                    <Pill tone="solid">
                      <LuCheck aria-hidden />
                      Can make
                    </Pill>
                  }
                />
              ))}
            </StaggerList>
          </Section>
        )}

        <Section className="flex flex-col gap-2">
          <SectionHead label={ready.length > 0 ? 'Everything else' : 'Known recipes'} />
          <StaggerList>
            {rest.map((recipe) => (
              <EntityRow key={recipe.id} entity={recipe} portraitSize={44} />
            ))}
          </StaggerList>
          {rest.length === 0 && ready.length === 0 && <Empty>No recipes learned yet</Empty>}
        </Section>

        <DmCreateBar path="/craft" />
      </div>
    </>
  )
}
