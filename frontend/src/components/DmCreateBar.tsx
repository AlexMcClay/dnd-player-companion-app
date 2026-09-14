import { motion } from 'framer-motion'
import { LuPlus } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { useIsDm } from '../lib/dm'
import { SPRING } from '../lib/motion'
import { templateFor } from '../templates'

/** Create buttons, shown only in DM mode. Writes are enforced server-side. */
export default function DmCreateBar({ types }: { types: string[] }) {
  const isDm = useIsDm()
  if (!isDm) return null

  return (
    <motion.div
      className="stack gap-8"
      style={{ marginTop: 4 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="divider" />
      {types.map((type) => {
        const template = templateFor(type)
        const Icon = template.icon
        return (
          <motion.div key={type} whileTap={{ scale: 0.98 }} transition={SPRING}>
            <Link to={`/new?type=${type}`} className="cta cta-ghost with-icon">
              <LuPlus aria-hidden />
              <Icon aria-hidden />
              New {template.label}
            </Link>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
