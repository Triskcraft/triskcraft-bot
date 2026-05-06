import { envs } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'
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

    #rank: string

    get rank() {
        return this.#rank
    }

    constructor({
        discord_user_id,
        nickname,
        uuid,
        rank = envs.DEFAULT_RANK,
    }: {
        uuid: string
        nickname: string
        discord_user_id: string
        rank?: string
    }) {
        this.#uuid = uuid
        this.#nicknname = nickname
        this.#discord_user_id = discord_user_id
        this.#rank = rank
    }

    toJSON() {
        return {
            uuid: this.#uuid,
            nicknname: this.#nicknname,
            rank: this.#rank,
            discord_user_id: this.#discord_user_id,
        }
    }

    [inspect.custom]() {
        return this.toJSON()
    }

    async setRank(rank: string) {
        await db.player.update({
            where: { uuid: this.#uuid, status: PLAYER_STATUS.ACTIVE },
            data: { rank },
        })
        this.#rank = rank
        return this
    }
}
