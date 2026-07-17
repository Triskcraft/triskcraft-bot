import { createHash } from 'node:crypto'
import { inspect } from 'node:util'
import { POST_BLOCK_MEDIA_TYPE, POST_STATUS } from '@triskcraft/db'
import { db } from '#/db.ts'
import { envs } from '#/config.ts'
import { BUCKETS, s3 } from '#/s3.ts'
import { Upload } from '@aws-sdk/lib-storage'
import type { Message } from 'discord.js'

type PostMediaData = {
    id: string
    filename: string
    url: string
    content_type: string | null
    media_type: POST_BLOCK_MEDIA_TYPE
    size: number
    width: number | null
    height: number | null
    description: string | null
    hash: string | null
}

type BlogMediaInput = {
    buffer: Buffer
    contentType: string | null
    description: string | null
    filename: string
    height: number | null
    mediaType: POST_BLOCK_MEDIA_TYPE
    size: number
    width: number | null
}

function getMediaType(contentType: string | null) {
    if (contentType?.startsWith('image/')) return POST_BLOCK_MEDIA_TYPE.IMAGE
    if (contentType?.startsWith('video/')) return POST_BLOCK_MEDIA_TYPE.VIDEO
    if (contentType?.startsWith('audio/')) return POST_BLOCK_MEDIA_TYPE.AUDIO
    return POST_BLOCK_MEDIA_TYPE.FILE
}

async function fetchBuffer(url: string) {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(
            `No se pudo descargar ${url}: ${response.status} ${response.statusText}`,
        )
    }

    return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type'),
    }
}

async function uploadBlogFile({
    buffer,
    contentType,
    key,
}: {
    buffer: Buffer
    contentType: string | null
    key: string
}) {
    await new Upload({
        client: s3,
        params: {
            Bucket: BUCKETS.BLOG,
            Key: key,
            Body: buffer,
            ContentType: contentType ?? 'application/octet-stream',
        },
    }).done()

    return `${envs.API_URL}/files/blog/${key}`
}

function sanitizeFilename(filename: string) {
    return filename.replaceAll(/[^\w.-]/g, '_')
}

async function findOrCreateBlogMedia({
    buffer,
    contentType,
    description,
    filename,
    height,
    mediaType,
    size,
    width,
}: BlogMediaInput) {
    const hash = createHash('sha256').update(buffer).digest('hex')
    const existing = await db.postMedia.findFirst({
        where: {
            hash,
        },
    })

    if (existing) return existing

    const key = ['blog-media', hash, sanitizeFilename(filename)].join('-')
    const url = await uploadBlogFile({
        buffer,
        contentType,
        key,
    })

    return await db.postMedia.create({
        data: {
            content_type: contentType,
            description,
            filename,
            hash,
            height,
            media_type: mediaType,
            size,
            url,
            width,
        },
    })
}

export class Post {
    #id: string

    get id() {
        return this.#id
    }

    #title: string

    get title() {
        return this.#title
    }

    #discord_user_id: string

    get discord_user_id() {
        return this.#discord_user_id
    }

    #thread_id: string

    get thread_id() {
        return this.#thread_id
    }

    #status: POST_STATUS

    get status() {
        return this.#status
    }

    #cover_media: PostMediaData | null

    get cover_media() {
        return this.#cover_media
    }

    get cover_image_url() {
        return this.#cover_media?.url ?? null
    }

    constructor({
        cover_media = null,
        discord_user_id,
        id,
        status = POST_STATUS.DRAFT,
        thread_id,
        title,
    }: {
        id: string
        title: string
        discord_user_id: string
        thread_id: string
        status?: POST_STATUS
        cover_media?: PostMediaData | null
    }) {
        this.#cover_media = cover_media
        this.#discord_user_id = discord_user_id
        this.#id = id
        this.#status = status
        this.#thread_id = thread_id
        this.#title = title
    }

    toJSON() {
        return {
            cover_media: this.#cover_media,
            discord_user_id: this.#discord_user_id,
            id: this.#id,
            status: this.#status,
            thread_id: this.#thread_id,
            title: this.#title,
        }
    }

    [inspect.custom]() {
        return this.toJSON()
    }

    async outdate() {
        if (this.status !== POST_STATUS.PUBLISHED) return
        await db.post.update({
            where: {
                id: this.#id,
            },
            data: {
                status: POST_STATUS.OUTDATED,
            },
        })
        this.#status = POST_STATUS.OUTDATED

        return this
    }

    async publish(messages: Message<true>[]) {
        if (this.status === POST_STATUS.PUBLISHED) return

        const media = await Promise.all(
            messages.flatMap(m =>
                [...m.attachments.values()].map(async (a, position) => {
                    const { buffer } = await fetchBuffer(a.url)
                    const storedMedia = await findOrCreateBlogMedia({
                        buffer,
                        contentType: a.contentType,
                        description: a.description,
                        filename: a.name,
                        height: a.height,
                        mediaType: getMediaType(a.contentType),
                        size: a.size,
                        width: a.width,
                    })

                    return {
                        media_id: storedMedia.id,
                        position,
                        post_block_message_id: m.id,
                    }
                }),
            ),
        )

        await db.postBlocks.deleteMany({
            where: {
                post_id: this.#id,
            },
        })

        await db.postBlocks.createMany({
            data: messages.map(m => ({
                author_id: this.#discord_user_id,
                message_id: m.id,
                post_id: this.#id,
                timestamp: m.createdAt,
                content: m.content,
                embeds: m.embeds,
                components: m.components,
            })),
        })

        if (media.length > 0) {
            await db.postBlockMedia.createMany({
                data: media,
            })
        }

        await db.post.update({
            where: {
                id: this.#id,
            },
            data: {
                status: POST_STATUS.PUBLISHED,
            },
        })

        this.#status = POST_STATUS.PUBLISHED

        return this
    }

    async changeTitle(title: string) {
        await db.post.update({
            where: {
                id: this.#id,
            },
            data: {
                title,
            },
        })
        this.#title = title
        return this
    }

    async changeCoverImage(imageUrl: string) {
        const { buffer, contentType } = await fetchBuffer(imageUrl)
        if (getMediaType(contentType) !== POST_BLOCK_MEDIA_TYPE.IMAGE) {
            throw new Error('La URL de portada no apunta a una imagen')
        }

        const hash = createHash('sha256').update(buffer).digest('hex')
        let coverMedia = await db.postMedia.findFirst({
            where: {
                hash,
                media_type: POST_BLOCK_MEDIA_TYPE.IMAGE,
            },
        })

        if (!coverMedia) {
            coverMedia = await findOrCreateBlogMedia({
                buffer,
                contentType,
                description: null,
                filename: sanitizeFilename(
                    new URL(imageUrl).pathname.split('/').at(-1) || 'cover',
                ),
                height: null,
                mediaType: POST_BLOCK_MEDIA_TYPE.IMAGE,
                size: buffer.byteLength,
                width: null,
            })
        }

        const post = await db.post.update({
            where: {
                id: this.#id,
            },
            data: {
                cover_media_id: coverMedia.id,
            },
            select: {
                cover_media: true,
            },
        })

        this.#cover_media = post.cover_media

        return this
    }
}
