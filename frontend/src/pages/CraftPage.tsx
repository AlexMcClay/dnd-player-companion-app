import { useQuery } from '@tanstack/react-query'
import type { Entity, RecipeData } from '@codex/shared'
import { LuCheck } from 'react-icons/lu'
import { api } from '../api/client'
import { Empty, EntityRow, Loading, Section, SectionHead, StaggerList } from '../components/bits'
import DmCreateBar from '../components/DmCreateBar'
import { reagentStatus, stockFor } from '../lib/recipes'

export default function CraftPage() {
  const recipes = useQuery({
    queryKey: ['entities', { type: 'recipe' }],
    queryFn: () => api.listEntities({ type: 'recipe' }),
  })
  const items = useQuery({
    queryKey: ['entities', { type: 'item' }],
    queryFn: () => api.listEntities({ type: 'item' }),
  })

  if (recipes.isLoading || items.isLoading) return <Loading />

  const stock = stockFor(items.data ?? [])
  const all = recipes.data ?? []

  const canMake = (recipe: Entity) => {
    const ingredients = (recipe.data as RecipeData).ingredients ?? []
    return ingredients.length > 0 && reagentStatus(ingredients, stock).every((r) => r.enough)
  }

  const ready = all.filter(canMake)
  const rest = all.filter((recipe) => !canMake(recipe))

  return (
    <>
      <div className="head">
        <h1 className="ttl">Crafting</h1>
        <div className="meta">{all.length} recipes the party knows</div>
      </div>

      <div className="stack gap-16">
        {ready.length > 0 && (
          <Section className="stack gap-8">
            <SectionHead label="Ready to make" note={`${ready.length} with reagents in hand`} />
            <StaggerList>
              {ready.map((recipe) => (
                <EntityRow
                  key={recipe.id}
                  entity={recipe}
                  portraitSize={44}
                  right={
                    <span className="pill pill-s with-icon">
                      <LuCheck aria-hidden />
                      Can make
                    </span>
                  }
                />
              ))}
            </StaggerList>
          </Section>
        )}

        <Section className="stack gap-8">
          <SectionHead label={ready.length > 0 ? 'Everything else' : 'Known recipes'} />
          <StaggerList>
            {rest.map((recipe) => (
              <EntityRow key={recipe.id} entity={recipe} portraitSize={44} />
            ))}
          </StaggerList>
          {rest.length === 0 && ready.length === 0 && <Empty>No recipes learned yet</Empty>}
        </Section>

        <DmCreateBar types={['recipe']} />
      </div>
    </>
  )
}
