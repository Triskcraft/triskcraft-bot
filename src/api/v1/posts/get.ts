import type { Request, Response } from 'express'
import { db } from '#/db/prisma.ts'
import { POST_BLOCK_MEDIA_TYPE, POST_STATUS } from '#/db/generated/enums.ts'
import type { BlogPost } from '@triskcraft/api-types'
import { NotFoundError } from '#/api/errors.ts'
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
            user_id: true,
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
            user: {
                select: {
                    discord_user: true,
                    linked_roles: {
                        select: {
                            role: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    },
                    mc_player: {
                        select: {
                            digs: true,
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
            },
        },
    })
    const post_mapped: BlogPost[] = posts.map(
        ({
            created_at,
            cover_media,
            id,
            title,
            post_blocks,
            updated_at,
            user,
        }) => ({
            id,
            title,
            cover_image:
                cover_media?.media_type === POST_BLOCK_MEDIA_TYPE.IMAGE ?
                    cover_media
                :   null,
            user: user.discord_user,
            created_at: created_at.getTime(),
            updated_at: updated_at.getTime(),
            player:
                user.mc_player ?
                    {
                        ...user.mc_player,
                        rank: user.linked_roles[0]?.role.name ?? 'Miembro',
                        roles: user.mc_player.linked_roles.map(
                            l => l.role.name,
                        ),
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

export async function getPostsById(
    req: Request<{ id: string }>,
    res: Response<BlogPost>,
) {
    const id = req.params.id
    const posts = await db.post.findFirst({
        where: {
            status: {
                not: POST_STATUS.DRAFT,
            },
            id,
        },
        omit: {
            thread_id: true,
            user_id: true,
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
            user: {
                select: {
                    discord_user: true,
                    linked_roles: {
                        select: {
                            role: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    },
                    mc_player: {
                        select: {
                            digs: true,
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
            },
        },
    })
    if (!posts) {
        throw new NotFoundError()
    }
    const post_mapped: BlogPost = [posts].map(
        ({
            created_at,
            cover_media,
            id,
            title,
            post_blocks,
            updated_at,
            user,
        }) => ({
            id,
            title,
            cover_image:
                cover_media?.media_type === POST_BLOCK_MEDIA_TYPE.IMAGE ?
                    cover_media
                :   null,
            user: user.discord_user,
            created_at: created_at.getTime(),
            updated_at: updated_at.getTime(),
            player:
                user.mc_player ?
                    {
                        ...user.mc_player,
                        rank: user.linked_roles[0]?.role.name ?? 'Miembro',
                        roles: user.mc_player.linked_roles.map(
                            l => l.role.name,
                        ),
                    }
                :   null,
            post_blocks: post_blocks.map(p => ({
                ...p,
                media: p.media.map(({ media }) => media),
                timestamp: p.timestamp.getTime(),
            })),
        }),
    )[0]!
    res.set('Cache-Control', 'public, max-age=86400')
    res.json(post_mapped)
}
