import { inspect } from 'node:util'
import { createHash } from 'node:crypto'
import {
    POST_BLOCK_MEDIA_TYPE,
    POST_STATUS,
} from '#/db/generated/enums.ts'
import { db } from '#/db/prisma.ts'
import { envs } from '#/config.ts'
import { BUCKETS, s3 } from '#/db/s3.ts'
import { Upload } from '@aws-sdk/lib-storage'
import type { Message } from 'discord.js'

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

    #cover_image_url: string | null

    get cover_image_url() {
        return this.#cover_image_url
    }

    #cover_image_hash: string | null

    get cover_image_hash() {
        return this.#cover_image_hash
    }

    #cover_image_content_type: string | null

    get cover_image_content_type() {
        return this.#cover_image_content_type
    }

    #cover_image_size: number | null

    get cover_image_size() {
        return this.#cover_image_size
    }

    constructor({
        discord_user_id,
        id,
        status = POST_STATUS.DRAFT,
        thread_id,
        title,
        cover_image_content_type = null,
        cover_image_hash = null,
        cover_image_size = null,
        cover_image_url = null,
    }: {
        id: string
        title: string
        discord_user_id: string
        thread_id: string
        status?: POST_STATUS
        cover_image_content_type?: string | null
        cover_image_hash?: string | null
        cover_image_size?: number | null
        cover_image_url?: string | null
    }) {
        this.#discord_user_id = discord_user_id
        this.#id = id
        this.#status = status
        this.#thread_id = thread_id
        this.#title = title
        this.#cover_image_content_type = cover_image_content_type
        this.#cover_image_hash = cover_image_hash
        this.#cover_image_size = cover_image_size
        this.#cover_image_url = cover_image_url
    }

    toJSON() {
        return {
            discord_user_id: this.#discord_user_id,
            id: this.#id,
            status: this.#status,
            thread_id: this.#thread_id,
            title: this.#title,
            cover_image_content_type: this.#cover_image_content_type,
            cover_image_hash: this.#cover_image_hash,
            cover_image_size: this.#cover_image_size,
            cover_image_url: this.#cover_image_url,
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

        const existingMediaUrlsByHash = new Map(
            (
                await db.postBlockMedia.findMany({
                    where: {
                        hash: {
                            not: null,
                        },
                        post_block: {
                            is: {
                                post_id: this.#id,
                            },
                        },
                    },
                    select: {
                        hash: true,
                        url: true,
                    },
                })
            ).map(image => [image.hash!, image.url]),
        )
        const uploadedMediaUrlsByHash = new Map<string, string>()

        const media = (
            await Promise.all(
                messages.flatMap(m =>
                    m.attachments.map(async a => {
                            const { buffer } = await fetchBuffer(a.url)
                            const hash = createHash('sha256')
                                .update(buffer)
                                .digest('hex')
                        let url =
                            existingMediaUrlsByHash.get(hash) ??
                            uploadedMediaUrlsByHash.get(hash)

                        if (!url) {
                            const key = [
                                    'blog-media',
                                    this.#id,
                                    hash,
                                    sanitizeFilename(a.name),
                                ].join('-')

                                url = await uploadBlogFile({
                                    buffer,
                                    contentType: a.contentType,
                                    key,
                                })
                                uploadedMediaUrlsByHash.set(hash, url)
                            }

                        return {
                            post_block_message_id: m.id,
                            filename: a.name,
                            url,
                            content_type: a.contentType,
                            media_type: getMediaType(a.contentType),
                            size: a.size,
                            width: a.width,
                            height: a.height,
                            description: a.description,
                            hash,
                        }
                    }),
                ),
            )
        ).filter(item => item !== null)

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
        if (!contentType?.startsWith('image/')) {
            throw new Error('La URL de portada no apunta a una imagen')
        }

        const hash = createHash('sha256').update(buffer).digest('hex')
        let url = this.#cover_image_hash === hash ? this.#cover_image_url : null

        if (!url) {
            const parsed = new URL(imageUrl)
            const filename = sanitizeFilename(
                parsed.pathname.split('/').at(-1) || 'cover',
            )
            const key = ['blog-cover', this.#id, hash, filename].join('-')
            url = await uploadBlogFile({
                buffer,
                contentType,
                key,
            })
        }

        await db.post.update({
            where: {
                id: this.#id,
            },
            data: {
                cover_image_content_type: contentType,
                cover_image_hash: hash,
                cover_image_size: buffer.byteLength,
                cover_image_url: url,
            },
        })

        this.#cover_image_content_type = contentType
        this.#cover_image_hash = hash
        this.#cover_image_size = buffer.byteLength
        this.#cover_image_url = url

        return this
    }
}
