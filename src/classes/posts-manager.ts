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
            },
        })
        for (const { discord_user_id, status, id, title, thread_id } of roles) {
            this.#cache.set(
                id,
                new Post({
                    discord_user_id,
                    status,
                    id,
                    title,
                    thread_id,
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
        thread_id,
        title,
    }: {
        discord_user_id: string
        title: string
        thread_id: string
    }) {
        const post = new Post(
            await db.post.create({
                data: { discord_user_id, title, thread_id },
            }),
        )
        this.#cache.set(post.id, post)
        return post
    }

    async delete(id: string) {
        await db.role.delete({
            where: { id },
        })
        this.#cache.delete(id)
    }
}
