import type { RecipeIngredient } from '@codex/shared'

export default function IngredientsEditor({
  value,
  onChange,
}: {
  value: RecipeIngredient[]
  onChange: (next: RecipeIngredient[]) => void
}) {
  function update(index: number, patch: Partial<RecipeIngredient>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="field">
      <span className="lab">Reagents</span>
      <div className="stack gap-8">
        {value.map((ingredient, index) => (
          // Index keys are safe here: rows are only ever edited in place or
          // removed, and the list is short.
          <div key={index} style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={ingredient.name}
              placeholder="Reagent name — matched to items by name"
              onChange={(e) => update(index, { name: e.target.value })}
            />
            <input
              className="input"
              style={{ width: 72 }}
              type="number"
              min={1}
              value={ingredient.qty}
              onChange={(e) => update(index, { qty: Number(e.target.value) || 1 })}
            />
            <button
              type="button"
              className="pill pill-n"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="cta cta-ghost"
        onClick={() => onChange([...value, { name: '', qty: 1 }])}
      >
        Add reagent
      </button>
    </div>
  )
}
