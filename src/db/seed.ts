import { envs } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { logger } from '#/logger.ts'
import { PrismaClientKnownRequestError } from '#/db/generated/internal/prismaNamespace.ts'

try {
    const defaultRole = await db.role.create({
        data: {
            name: envs.DEFAULT_ROLE_NAME,
        },
    })

    logger.info(defaultRole, 'Default role creado')
} catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            const defaultRole = await db.minecraftRole.findUnique({
                where: {
                    name: envs.DEFAULT_ROLE_NAME,
                },
            })
            logger.info(defaultRole, 'Default role existente')
        }
    }
}
logger.info('Por favor actualize el DEFAULT_ROLE_ID en .env')

const clientCount = await db.client.count()
if (!clientCount) {
    await db.client.create({
        data: {
            id: 'api-panel',
            redirect_uris: [
                'http://localhost:8080/oauth/callback',
                'https://api.triskcraft.com/oauth/callback',
            ],
            scopes: ['openid', 'identify', 'minecraft'],
        },
    })
}

const superRole = await db.role.findUnique({
    where: { name: 'super' },
})

if (!superRole) {
    await db.role.create({
        data: {
            name: 'super',
            permissions: 1,
        },
    })
}

const userRole = await db.role.findUnique({
    where: { name: 'user' },
})

if (!userRole) {
    await db.role.create({
        data: {
            name: 'user',
            permissions: 0,
        },
    })
}
