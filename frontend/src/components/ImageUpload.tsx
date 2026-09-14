import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LuImage, LuTrash2, LuUpload } from 'react-icons/lu'
import { api } from '../api/client'
import { SPRING } from '../lib/motion'
import { ctaClass, cx } from './ui'

/**
 * Presigns, then PUTs straight to storage. The API only ever stores the key —
 * bytes never pass through Express.
 */
export default function ImageUpload({
  entityType,
  imageUrl,
  onUploaded,
}: {
  entityType: string
  imageUrl: string | null
  onUploaded: (key: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(imageUrl)

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const key = await api.uploadImage(file, entityType)
      setPreview(URL.createObjectURL(file))
      onUploaded(key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-lab flex items-center gap-1.75">
        <LuImage aria-hidden />
        Image
      </span>

      <AnimatePresence initial={false}>
        {preview && (
          <motion.div
            className="port-fill grid max-h-55 w-full place-items-center overflow-hidden border border-line"
            style={{ aspectRatio: '3 / 2' }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={SPRING}
          >
            <img src={preview} alt="" className="block size-full object-cover" />
          </motion.div>
        )}
      </AnimatePresence>

      <label className={cx(ctaClass('ghost'), busy ? 'cursor-wait' : 'cursor-pointer')}>
        <LuUpload aria-hidden />
        {busy ? 'Uploading…' : preview ? 'Replace image' : 'Upload image'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          hidden
          disabled={busy}
          onChange={pick}
        />
      </label>

      {preview && (
        <button
          type="button"
          className={ctaClass('ghost')}
          onClick={() => {
            setPreview(null)
            onUploaded(null)
          }}
        >
          <LuTrash2 aria-hidden />
          Remove image
        </button>
      )}

      {error && (
        <div className="type-meta flex items-center gap-1.75 text-danger">{error}</div>
      )}
    </div>
  )
}
