import { lanAddress } from './lib/network.js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var ${name}. Copy .env.example to .env.`)
  return value
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

/**
 * Where the *browser* reaches MinIO.
 *
 * This has to be an address the viewer's device can resolve, not the server's
 * own view of it: a phone handed `localhost:9000` points at itself and every
 * image breaks. `auto` uses this machine's LAN address, which is what makes the
 * app work over wifi without editing config every time DHCP moves.
 *
 * The S3 client here only ever signs URLs for the browser to use — nothing is
 * uploaded server-side — so there is no second, server-facing endpoint to keep
 * in step.
 */
function resolveS3Host(): { host: string; auto: boolean } {
  const configured = optional('S3_PUBLIC_HOST') ?? 'auto'
  if (configured !== 'auto') return { host: configured, auto: false }

  const detected = lanAddress()
  return { host: detected ?? 'localhost', auto: true }
}

const s3Port = optional('S3_PORT') ?? '9000'
const { host: s3Host, auto: s3HostAuto } = resolveS3Host()
const s3Bucket = required('S3_BUCKET')

// An explicit S3_ENDPOINT / S3_PUBLIC_URL still wins, for pointing at real S3.
const s3Endpoint = optional('S3_ENDPOINT') ?? `http://${s3Host}:${s3Port}`
const s3PublicUrl = optional('S3_PUBLIC_URL') ?? `${s3Endpoint}/${s3Bucket}`

export const env = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3001),
  dmKey: required('DM_KEY'),
  /**
   * Optional. Left unset, a party sync works the campaign out from whichever
   * character is linked, so there is nothing to configure for the common case.
   */
  ddbCampaignId: optional('DDB_CAMPAIGN_ID'),
  s3: {
    endpoint: s3Endpoint,
    region: optional('S3_REGION') ?? 'us-east-1',
    bucket: s3Bucket,
    accessKey: required('S3_ACCESS_KEY'),
    secretKey: required('S3_SECRET_KEY'),
    publicUrl: s3PublicUrl.replace(/\/$/, ''),
    /** True when the host was detected rather than configured — worth logging. */
    hostAutoDetected: s3HostAuto,
  },
}
