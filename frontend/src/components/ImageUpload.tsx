import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LuImage, LuTrash2, LuUpload } from 'react-icons/lu'
import { api } from '../api/client'
import { SPRING } from '../lib/motion'

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
    <div className="field">
      <span className="lab with-icon">
        <LuImage aria-hidden />
        Image
      </span>
      <AnimatePresence initial={false}>
        {preview && (
          <motion.div
            className="port"
            style={{ width: '100%', aspectRatio: '3 / 2', maxHeight: 220 }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={SPRING}
          >
            <img src={preview} alt="" />
          </motion.div>
        )}
      </AnimatePresence>
      <label className="cta cta-ghost with-icon" style={{ cursor: busy ? 'wait' : 'pointer' }}>
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
          className="cta cta-ghost with-icon"
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
        <div className="meta" style={{ color: '#d89494' }}>
          {error}
        </div>
      )}
    </div>
  )
}
