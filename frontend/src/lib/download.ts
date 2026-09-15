/**
 * Hands the browser a file to save.
 *
 * The object URL is revoked on the next frame rather than immediately: Safari
 * reads it asynchronously after the click, and revoking too early gives a
 * download that silently produces nothing.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
