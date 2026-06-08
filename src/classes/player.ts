import { envs } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { inspect } from 'node:util'

export class Player {
    #uuid: string

    get uuid() {
        return this.#uuid
    }

    #nicknname: string

    get nickname() {
        return this.#nicknname
    }

    #discord_user_id: string

    get discord_user_id() {
        return this.#discord_user_id
    }

    #role: string

    get role() {
        return this.#role
    }

    constructor({
        discord_user_id,
        nickname,
        uuid,
        role = envs.DEFAULT_RANK,
    }: {
        uuid: string
        nickname: string
        discord_user_id: string
        role?: string
    }) {
        this.#uuid = uuid
        this.#nicknname = nickname
        this.#discord_user_id = discord_user_id
        this.#role = role
    }

    toJSON() {
        return {
            uuid: this.#uuid,
            nicknname: this.#nicknname,
            rank: this.#role,
            discord_user_id: this.#discord_user_id,
        }
    }

    [inspect.custom]() {
        return this.toJSON()
    }

    async setRole(roleName: string) {
        const role = await db.minecraftRole.upsert({
            where: {
                name: roleName,
            },
            update: {},
            create: {
                name: roleName,
            },
        })

        await db.linkedMinecraftRole.deleteMany({
            where: {
                mc_user_uuid: this.#uuid,
            },
        })
        await db.linkedMinecraftRole.create({
            data: {
                mc_user_uuid: this.#uuid,
                role_id: role.id,
            },
        })
        this.#role = role.id
        return this
    }
}
