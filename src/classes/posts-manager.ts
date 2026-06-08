import { db } from '#/db/prisma.ts'
import { Collection } from 'discord.js'
import { Post } from '#/classes/post.ts'

export class PostsManager {
    async fetch() {
        const roles = await db.post.findMany({
            select: {
                discord_user_id: true,
                status: true,
                id: true,
                title: true,
                thread_id: true,
                cover_media: true,
            },
        })
        for (const post of roles) {
            this.#cache.set(
                post.id,
                new Post({
                    ...post,
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
        await db.discordUser.upsert({
            where: {
                id: discord_user_id,
            },
            update: {
                username: discord_username,
            },
            create: {
                id: discord_user_id,
                username: discord_username,
            },
        })

        const post = new Post(
            await db.post.create({
                data: { discord_user_id, title, thread_id },
            }),
        )
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
