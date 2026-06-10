import { envs } from '#/config.ts'
import { Permissions } from '#/classes/permissions.ts'
import { db } from '#/db/prisma.ts'
import { logger } from '#/logger.ts'
import { PrismaClientKnownRequestError } from './generated/internal/prismaNamespace.ts'

try {
    const defaultRole = await db.minecraftRole.create({
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

const webClientRedirectUris = [
    'http://localhost:3000/api/auth/callback',
    'https://triskcraft.com/api/auth/callback',
    'https://www.triskcraft.com/api/auth/callback',
]

await db.client.upsert({
    where: { id: 'api-panel' },
    create: {
        id: 'api-panel',
        redirect_uris: [
            'http://localhost:8080/console/login/callback',
            'https://api.triskcraft.com/console/login/callback',
        ],
        scopes: ['openid', 'identify', 'minecraft'],
    },
    update: {
        redirect_uris: [
            'http://localhost:8080/console/login/callback',
            'https://api.triskcraft.com/console/login/callback',
        ],
        scopes: ['openid', 'identify', 'minecraft'],
    },
})

await db.client.upsert({
    where: { id: 'triskcraft-web' },
    create: {
        id: 'triskcraft-web',
        redirect_uris: webClientRedirectUris,
        scopes: ['openid', 'identify', 'minecraft'],
    },
    update: {
        redirect_uris: webClientRedirectUris,
        scopes: ['openid', 'identify', 'minecraft'],
    },
})

const superRole = await db.role.findUnique({
    where: { name: 'super' },
})

if (!superRole) {
    await db.role.create({
        data: {
            name: 'super',
            permissions: Permissions.Flags.ADMIN,
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
