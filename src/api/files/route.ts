import { Router } from 'express'
import { BUCKETS, s3 } from '#/db/s3.ts'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'

const router = Router()

router.get('/web/:filename', async (req, res) => {
    const command = new GetObjectCommand({
        Bucket: BUCKETS.WEB,
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
