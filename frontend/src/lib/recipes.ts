import type { Holding, RecipeIngredient } from '@codex/shared'

/**
 * What the party can actually lay hands on, summed across every holding —
 * the stash and every character's pack alike.
 *
 * Reagents are matched to items by name. That is deliberately loose: a recipe
 * can call for something nobody has ever picked up, and it still renders.
 */
export function stockFor(holdings: Holding[]): Map<string, number> {
  const stock = new Map<string, number>()
  for (const holding of holdings) {
    const key = holding.item.name.toLowerCase()
    stock.set(key, (stock.get(key) ?? 0) + holding.quantity)
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
