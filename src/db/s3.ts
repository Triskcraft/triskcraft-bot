import { envs } from '#/config.ts'
import { S3Client } from '@aws-sdk/client-s3'

export const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: envs.S3_URL,
    credentials: {
        accessKeyId: envs.S3_ACCESS_KEY_ID,
        secretAccessKey: envs.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
})

export const BUCKETS = {
    WEB: 'public-web',
} as const
