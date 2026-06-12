import { db } from '#/db/prisma.ts'
import { Collection } from 'discord.js'
import { Post } from '#/classes/post.ts'

export class PostsManager {
    async fetch() {
        const roles = await db.post.findMany({
            select: {
                status: true,
                id: true,
                title: true,
                thread_id: true,
                cover_media: true,
                user: {
                    select: {
                        discord_user_id: true,
                    },
                },
            },
        })
        for (const post of roles) {
            this.#cache.set(
                post.id,
                new Post({
                    ...post,
                    discord_user_id: post.user.discord_user_id,
                }),
            )
        }
        return this.#cache
    }

    #cache = new Collection<string, Post>()

    get cache() {
        return this.#cache
    }

    async create({
        discord_user_id,
        discord_username,
        thread_id,
        title,
    }: {
        discord_user_id: string
        discord_username: string
        title: string
        thread_id: string
    }) {
        const user = await db.user.upsert({
            where: { discord_user_id },
            create: {
                discord_user: {
                    connectOrCreate: {
                        where: { id: discord_user_id },
                        create: {
                            id: discord_user_id,
                            username: discord_username,
                        },
                    },
                },
            },
            update: {
                discord_user: {
                    update: {
                        username: discord_username,
                    },
                },
            },
        })

        const createdPost = await db.post.create({
            data: {
                title,
                thread_id,
                user_id: user.id,
            },
        })
        const post = new Post({
            ...createdPost,
            discord_user_id,
        })
        this.#cache.set(post.id, post)
        return post
    }

    async delete(id: string) {
        await db.post.delete({
            where: { id },
        })
        this.#cache.delete(id)
    }
}
