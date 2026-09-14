import { useState } from 'react'
import { api } from '../api/client'

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
      <span className="lab">Image</span>
      {preview && (
        <div className="port" style={{ width: '100%', aspectRatio: '3 / 2', maxHeight: 220 }}>
          <img src={preview} alt="" />
        </div>
      )}
      <label className="cta cta-ghost" style={{ cursor: busy ? 'wait' : 'pointer' }}>
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
          className="cta cta-ghost"
          onClick={() => {
            setPreview(null)
            onUploaded(null)
          }}
        >
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
