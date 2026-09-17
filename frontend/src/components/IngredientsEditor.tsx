import { AnimatePresence, motion } from 'framer-motion'
import type { RecipeIngredient } from '@codex/shared'
import { LuFlaskConical, LuPlus, LuX } from 'react-icons/lu'
import { SPRING } from '../lib/motion'
import { cx, inputClass, PillButton, ctaClass } from './ui'

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
    <div className="flex flex-col gap-1.5">
      <span className="type-lab flex items-center gap-1.75">
        <LuFlaskConical aria-hidden />
        Reagents
      </span>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {value.map((ingredient, index) => (
            // Index keys are safe here: rows are only ever edited in place or
            // removed, and the list is short.
            <motion.div
              key={index}
              className="flex gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING}
            >
              <input
                className={cx(inputClass, 'min-w-0 flex-1')}
                value={ingredient.name}
                placeholder="Reagent name — matched to items by name"
                onChange={(e) => update(index, { name: e.target.value })}
              />
              {/*
                Sized by flex-basis, not width.

                `inputClass` already carries `w-full`, and Tailwind emits
                `.w-full` after `.w-18`, so a `w-18` here lost and this box
                claimed the whole row. The name beside it is `flex-1` — basis 0
                — so it had nothing left to grow into and collapsed to nothing:
                a field you could not click, let alone type in.

                `basis-*` wins over `width` when a flex item is laid out, so the
                size holds whatever order the two width rules land in.
              */}
              <input
                className={cx(inputClass, 'shrink-0 basis-18')}
                type="number"
                min={1}
                value={ingredient.qty}
                onChange={(e) => update(index, { qty: Number(e.target.value) || 1 })}
              />
              <PillButton
                tone="neutral"
                aria-label={`Remove ${ingredient.name || 'reagent'}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <LuX aria-hidden />
              </PillButton>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <motion.button
        type="button"
        className={ctaClass('ghost')}
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
