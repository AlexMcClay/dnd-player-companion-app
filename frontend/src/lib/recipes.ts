import type { Entity, RecipeIngredient } from '@codex/shared'

/**
 * Reagents are matched to items by name. That is deliberately loose: a recipe
 * can call for something the party has never picked up, and it still renders.
 */
export function stockFor(items: Entity[]): Map<string, number> {
  const stock = new Map<string, number>()
  for (const item of items) {
    const key = item.name.toLowerCase()
    stock.set(key, (stock.get(key) ?? 0) + item.quantity)
  }
  return stock
}

export interface ReagentStatus extends RecipeIngredient {
  have: number
  enough: boolean
}

export function reagentStatus(
  ingredients: RecipeIngredient[],
  stock: Map<string, number>,
): ReagentStatus[] {
  return ingredients.map((ingredient) => {
    const have = stock.get(ingredient.name.toLowerCase()) ?? 0
    return { ...ingredient, have, enough: have >= ingredient.qty }
  })
}
