import { logger } from '#/logger.ts'
import { importPKCS8, importSPKI } from 'jose'
import { readFile } from 'node:fs/promises'

try {
    process.loadEnvFile()
} catch {
    logger.error('No existe .env')
}

export interface BotConfig {
    token: string
    clientId: string
    guildId: string
    inactivityChannelId: string
    adminLogChannelId: string
    reminderIntervalMinutes: number
}

/**
 * Carga la configuración del bot desde variables de entorno y valida que las
 * mínimas requeridas estén presentes antes de continuar con la ejecución.
 */
export function loadConfig() {
    const required = [
        'DISCORD_TOKEN',
        'DISCORD_CLIENT_ID',
        'DISCORD_GUILD_ID',
        'DISCORD_INACTIVITY_CHANNEL_ID',
        'DISCORD_ADMIN_LOG_CHANNEL_ID',
        'PANEL_CHANNEL_ID',
        'ENCRYPT_KEY',
        'BLOG_CHANNEL_ID',
        'BLOG_ROLE_ID',
        'S3_URL',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
        'DISCORD_CLIENT_SECRET',
        'DISCORD_REDIRECT_URI',
        'CONSOLE_LOGIN_REDIRECT',
        'API_URL',
        'SUPER_USER_DISCORD_ID',
    ]

    const recomended = [
        'DEPLOY_COMMAND',
        'DEPLOY_INACTIVITY_PANEL',
        'API_PORT',
        'NODE_ENV',
        'DEFAULT_RANK',
        'ROLE_SERVICE',
    ]

    const {
        API_PORT = '3000',
        DEPLOY_COMMAND = false,
        NODE_ENV = 'development',
        DEPLOY_INACTIVITY_PANEL = false,
        PANEL_CHANNEL_ID = '',
        ENCRYPT_KEY = '',
        DEFAULT_RANK = 'Miembro',
        BLOG_CHANNEL_ID = '',
        BLOG_ROLE_ID = '',
        ROLE_SERVICE = false,
        S3_URL = '',
        S3_ACCESS_KEY_ID = '',
        S3_SECRET_ACCESS_KEY = '',
        DISCORD_CLIENT_SECRET = '',
        DISCORD_REDIRECT_URI = '',
        DISCORD_CLIENT_ID = '',
        CONSOLE_LOGIN_REDIRECT = '',
        API_URL = '',
        SUPER_USER_DISCORD_ID = '',
    } = process.env

    const recommendedMissing = recomended.filter(key => !process.env[key])
    if (recommendedMissing.length > 0) {
        logger.warn(
            `Variables de entorno recomendadas establecidas a un valor por defecto`,
        )
        let text = `Se recomienda establecer las siguientes variables:`
        for (const key of recommendedMissing) {
            text += `\n${key}="${eval(key)}"`
        }
        logger.warn(text)
    }

    const requiredMissing = required.filter(key => !process.env[key])
    if (requiredMissing.length > 0) {
        throw new Error(
            `Faltan variables de entorno:\n${requiredMissing.join('=""\n')}`,
        )
    }

    return {
        token: process.env.DISCORD_TOKEN!,
        DISCORD_CLIENT_ID: DISCORD_CLIENT_ID,
        DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID!,
        inactivityChannelId: process.env.DISCORD_INACTIVITY_CHANNEL_ID!,
        adminLogChannelId: process.env.DISCORD_ADMIN_LOG_CHANNEL_ID!,
        reminderIntervalMinutes: Number.parseInt(
            process.env.REMINDER_INTERVAL_MINUTES ?? '5',
            10,
        ),
        API_PORT,
        DEPLOY_COMMAND: DEPLOY_COMMAND === 'true',
        DEPLOY_INACTIVITY_PANEL: DEPLOY_INACTIVITY_PANEL === 'true',
        NODE_ENV,
        PANEL_CHANNEL_ID,
        ENCRYPT_KEY: Buffer.from(ENCRYPT_KEY, 'base64'),
        DEFAULT_RANK,
        BLOG_CHANNEL_ID,
        BLOG_ROLE_ID,
        ROLE_SERVICE: ROLE_SERVICE === 'true',
        S3_URL,
        S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY,
        DISCORD_CLIENT_SECRET,
        DISCORD_REDIRECT_URI,
        CONSOLE_LOGIN_REDIRECT,
        API_URL,
        SUPER_USER_DISCORD_ID,
    }
}

async function getPrivateKey() {
    try {
        const pem = await readFile('./private.pem', 'utf-8')
        return await importPKCS8(pem, 'RS256')
    } catch {
        logger.error(
            'No se pudo cargar la clave privada para JWT de private.pem. Puede generar una clave RSA con el comando `openssl genrsa -out private.pem 2048`.',
        )
        process.exit(1)
    }
}
async function getPublicKey() {
    try {
        const pem = await readFile('./public.pem', 'utf-8')
        return await importSPKI(pem, 'RS256')
    } catch {
        logger.error(
            'No se pudo cargar la clave publica para JWT de public.pem. Puede generar una clave RSA con el comando `openssl rsa -in private.pem -pubout -out public.pem`.',
        )
        process.exit(1)
    }
}

export const envs = loadConfig()
export const PRIVATE_KEY = await getPrivateKey()
export const PUBLIC_KEY = await getPublicKey()

/**
 * Lista ordenada de roles de rango. El orden determina prioridad cuando se
 * busca la jerarquía más alta que posee un usuario.
 */
export const RANK_ROLES: Readonly<string[]> = [
    '1202733002195734538', // owner
    '1237979602153115728', // admin
    '1355617895480164472', // staff
    '1453448897136427251', // dev
    '1202775128006459453', // miembro
    '1202775706912948264', // member test
]

export const WEBHOOK_PERMISSIONS = {
    DIGS: 'digs',
    LINK: 'link',
    JOIN: 'join',
} as const

export type WebhookPermission =
    (typeof WEBHOOK_PERMISSIONS)[keyof typeof WEBHOOK_PERMISSIONS]
