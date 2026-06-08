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

    constructor({
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
    }) {
        this.#discord_user_id = discord_user_id
        this.#id = id
        this.#status = status
        this.#thread_id = thread_id
        this.#title = title
    }

    toJSON() {
        return {
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
                        const response = await fetch(a.url)
                        if (!response.ok) {
                            throw new Error(
                                `No se pudo descargar el attachment ${a.id}: ${response.status} ${response.statusText}`,
                            )
                        }

                        const buffer = Buffer.from(
                            await response.arrayBuffer(),
                        )
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
                                a.name.replaceAll(/[^\w.-]/g, '_'),
                            ].join('-')

                            await new Upload({
                                client: s3,
                                params: {
                                    Bucket: BUCKETS.BLOG,
                                    Key: key,
                                    Body: buffer,
                                    ContentType:
                                        a.contentType ??
                                        'application/octet-stream',
                                },
                            }).done()

                            url = `${envs.API_URL}/files/blog/${key}`
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
}
