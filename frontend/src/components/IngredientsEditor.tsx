import { AnimatePresence, motion } from 'framer-motion'
import type { RecipeIngredient } from '@codex/shared'
import { LuFlaskConical, LuPlus, LuX } from 'react-icons/lu'
import { SPRING } from '../lib/motion'

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
      <span className="lab with-icon">
        <LuFlaskConical aria-hidden />
        Reagents
      </span>
      <div className="stack gap-8">
        <AnimatePresence initial={false}>
          {value.map((ingredient, index) => (
            // Index keys are safe here: rows are only ever edited in place or
            // removed, and the list is short.
            <motion.div
              key={index}
              style={{ display: 'flex', gap: 8 }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING}
            >
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
              <motion.button
                type="button"
                className="pill pill-n"
                aria-label={`Remove ${ingredient.name || 'reagent'}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                whileTap={{ scale: 0.9 }}
                transition={SPRING}
              >
                <LuX aria-hidden />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <motion.button
        type="button"
        className="cta cta-ghost with-icon"
        onClick={() => onChange([...value, { name: '', qty: 1 }])}
        whileTap={{ scale: 0.98 }}
        transition={SPRING}
      >
        <LuPlus aria-hidden />
        Add reagent
      </motion.button>
    </div>
  )
}
