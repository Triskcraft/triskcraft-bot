import { envs } from '#/config.ts'
import { PermissionsFlagsBits } from '#/classes/permissions.ts'
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

const superState = await db.state.findUnique({
    where: { key: 'super_role_id' },
})
if (!superState) {
    const superRole = await db.role.upsert({
        where: {
            name: 'Super',
        },
        create: {
            name: 'Super',
            permissions: PermissionsFlagsBits.ADMIN,
        },
        update: {
            permissions: PermissionsFlagsBits.ADMIN,
        },
    })
    await db.state.create({
        data: {
            key: 'super_role_id',
            value: superRole.id,
        },
    })
} else {
    const nsuper = await db.role.upsert({
        where: {
            id: superState.value,
        },
        create: {
            name: 'Super',
            permissions: PermissionsFlagsBits.ADMIN,
        },
        update: {
            permissions: PermissionsFlagsBits.ADMIN,
        },
    })
    await db.state.update({
        where: {
            key: 'super_role_id',
        },
        data: {
            value: nsuper.id,
        },
    })
}

const userState = await db.state.findUnique({
    where: { key: 'default_role_id' },
})
if (!userState) {
    const defaultRole = await db.role.upsert({
        where: {
            name: 'User',
        },
        create: {
            name: 'User',
            permissions: 0,
        },
        update: {},
    })
    await db.state.create({
        data: {
            key: 'default_role_id',
            value: defaultRole.id,
        },
    })
} else {
    const nuser = await db.role.upsert({
        where: {
            id: userState.value,
        },
        create: {
            name: 'User',
            permissions: 0,
        },
        update: {},
    })
    await db.state.update({
        where: {
            key: 'default_role_id',
        },
        data: {
            value: nuser.id,
        },
    })
}
