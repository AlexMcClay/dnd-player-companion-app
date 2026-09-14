function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var ${name}. Copy .env.example to .env.`)
  return value
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3001),
  dmKey: required('DM_KEY'),
  s3: {
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: required('S3_BUCKET'),
    accessKey: required('S3_ACCESS_KEY'),
    secretKey: required('S3_SECRET_KEY'),
    publicUrl: required('S3_PUBLIC_URL').replace(/\/$/, ''),
  },
}
