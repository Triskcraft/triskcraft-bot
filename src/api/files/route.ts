import { Router } from 'express'
import { BUCKETS, s3 } from '#/db/s3.ts'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'

const router = Router()

const FILE_BUCKETS = {
    web: BUCKETS.WEB,
    blog: BUCKETS.BLOG,
} as const

router.get('/:bucket/:filename', async (req, res) => {
    const bucket = FILE_BUCKETS[req.params.bucket as keyof typeof FILE_BUCKETS]
    if (!bucket) {
        res.status(404).json({ error: 'Bucket no encontrado' })
        return
    }

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: req.params.filename,
    })

    // eslint-disable-next-line no-restricted-syntax
    const response = await s3.send(command)

    res.setHeader(
        'Content-Type',
        response.ContentType || 'application/octet-stream',
    )
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${req.params.filename}"`,
    )

    if (response.Body instanceof Readable) {
        response.Body.pipe(res)
    } else {
        throw new Error('Body is not a Node.js stream')
    }
})

export default router
