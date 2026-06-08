import type { Request, Response } from 'express'
import { db } from '#/db/prisma.ts'
import { POST_BLOCK_MEDIA_TYPE, POST_STATUS } from '#/db/generated/enums.ts'
import type { BlogPost } from '@triskcraft/api-types'
/**
 * Endpoint que entrega el listado de post disponibles para el blog
 * Se aplica caching HTTP para evitar recalcular resultados en llamadas
 * repetidas.
 */

export async function getPosts(req: Request, res: Response<BlogPost[]>) {
    const posts = await db.post.findMany({
        where: {
            status: {
                not: POST_STATUS.DRAFT,
            },
        },
        omit: {
            thread_id: true,
            discord_user_id: true,
            player_uuid: true,
            status: true,
            cover_media_id: true,
        },
        include: {
            cover_media: true,
            post_blocks: {
                orderBy: {
                    timestamp: 'asc',
                },
                include: {
                    media: {
                        orderBy: {
                            position: 'asc',
                        },
                        include: {
                            media: true,
                        },
                    },
                },
                omit: {
                    post_id: true,
                    message_id: true,
                    author_id: true,
                },
            },
            discord_user: true,
            player: {
                select: {
                    digs: true,
                    rank: true,
                    uuid: true,
                    nickname: true,
                    linked_roles: {
                        select: {
                            role: {
                                omit: {
                                    id: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    const post_mapped: BlogPost[] = posts.map(
        ({
            created_at,
            cover_media,
            discord_user,
            id,
            title,
            player,
            post_blocks,
            updated_at,
        }) => ({
            id,
            title,
            cover_image:
                cover_media?.media_type === POST_BLOCK_MEDIA_TYPE.IMAGE ?
                    cover_media
                :   null,
            user: discord_user,
            created_at: created_at.getTime(),
            updated_at: updated_at.getTime(),
            player:
                player ?
                    {
                        ...player,
                        uuid: player.uuid,
                        nickname: player.nickname,
                        digs: player.digs,
                        rank: player.rank,
                        roles: player.linked_roles.map(l => l.role.name),
                    }
                :   null,
            post_blocks: post_blocks.map(p => ({
                ...p,
                media: p.media.map(({ media }) => media),
                timestamp: p.timestamp.getTime(),
            })),
        }),
    )
    res.set('Cache-Control', 'public, max-age=86400')
    res.json(post_mapped)
}
