import { envs } from '#/config.ts'
import {
    CreateBucketCommand,
    HeadBucketCommand,
    NotFound,
    S3Client,
} from '@aws-sdk/client-s3'

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
    BLOG: 'blog-media',
} as const

export async function ensureBucket(bucket: string) {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }))
    } catch (error) {
        if (
            error instanceof NotFound ||
            (error instanceof Error && error.name === 'NotFound')
        ) {
            await s3.send(new CreateBucketCommand({ Bucket: bucket }))
            return
        }

        throw error
    }
}
