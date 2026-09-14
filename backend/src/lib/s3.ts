import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'
import { env } from '../env.js'

export const s3 = new S3Client({
  endpoint: env.s3.endpoint,
  region: env.s3.region,
  // MinIO serves buckets as path segments, not subdomains.
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.s3.accessKey,
    secretAccessKey: env.s3.secretKey,
  },
})

const EXTENSION = /\.([a-z0-9]{1,8})$/i

/** `<type>/<uuid>.<ext>` — grouped by entity type so the bucket stays browsable. */
export function buildObjectKey(entityType: string, filename: string): string {
  const ext = EXTENSION.exec(filename)?.[1]?.toLowerCase() ?? 'bin'
  const safeType = /^[a-z0-9_-]{1,32}$/i.test(entityType) ? entityType : 'misc'
  return `${safeType}/${randomUUID()}.${ext}`
}

export function presignPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  )
}

/** The bucket is public-read, so a key maps straight to a browser-loadable URL. */
export function publicUrlFor(key: string | null): string | null {
  return key ? `${env.s3.publicUrl}/${key}` : null
}
