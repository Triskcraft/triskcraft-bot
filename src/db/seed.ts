import { STATE_KEYS } from '#/config.ts'
import { PermissionsFlagsBits } from '#/classes/permissions.ts'
import { db } from '#/db/prisma.ts'
import { logger } from '#/logger.ts'

const DEFAULT_MINECRAFT_ROLE_NAME = 'Digger'
const defaultMinecraftRoleState = await db.state.findUnique({
    where: { key: STATE_KEYS.DEFAULT_MINECRAFT_ROLE_ID },
})
const defaultMinecraftRole =
    (defaultMinecraftRoleState ?
        await db.minecraftRole.findUnique({
            where: { id: defaultMinecraftRoleState.value },
        })
    :   null) ??
    (await db.minecraftRole.findUnique({
        where: { name: DEFAULT_MINECRAFT_ROLE_NAME },
    })) ??
    (await db.minecraftRole.create({
        data: {
            name: DEFAULT_MINECRAFT_ROLE_NAME,
        },
    }))

await db.state.upsert({
    where: { key: STATE_KEYS.DEFAULT_MINECRAFT_ROLE_ID },
    create: {
        key: STATE_KEYS.DEFAULT_MINECRAFT_ROLE_ID,
        value: defaultMinecraftRole.id,
    },
    update: {
        value: defaultMinecraftRole.id,
    },
})
logger.info(defaultMinecraftRole, 'Default Minecraft role configurado')

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
    where: { key: STATE_KEYS.SUPER_ROLE_ID },
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
            key: STATE_KEYS.SUPER_ROLE_ID,
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
            key: STATE_KEYS.SUPER_ROLE_ID,
        },
        data: {
            value: nsuper.id,
        },
    })
}

const userState = await db.state.findUnique({
    where: { key: STATE_KEYS.DEFAULT_ROLE_ID },
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
            key: STATE_KEYS.DEFAULT_ROLE_ID,
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
            key: STATE_KEYS.DEFAULT_ROLE_ID,
        },
        data: {
            value: nuser.id,
        },
    })
}
