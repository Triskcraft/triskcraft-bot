import { type Request, type Response, type NextFunction } from 'express'
import { Permissions } from '#/classes/permissions.ts'
import { db } from '#/db/prisma.ts'
import { type OAuthTokenResponse } from '@triskcraft/api-types'
import { verifyToken } from '#/utils/encript.ts'

function parseCookie(cookie: string): OAuthTokenResponse | null {
    try {
        const raw = JSON.parse(cookie) as Partial<OAuthTokenResponse>
        if (
            typeof raw.access_token !== 'string' ||
            typeof raw.refresh_token !== 'string' ||
            raw.token_type !== 'Bearer'
        ) {
            return null
        }
        return raw as OAuthTokenResponse
    } catch {
        return null
    }
}

export function getConsoleSession(req: Request) {
    try {
        const cookie = req.cookies['console-session'] ?? ''
        return parseCookie(cookie)
    } catch {
        return null
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const perm = new Permissions()

export function requirePermission<T extends Parameters<typeof perm.has>[0]>(
    bits: T,
    anyBits = false,
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const session = getConsoleSession(req)
        if (!session) {
            return res.redirect('/console/login')
        }

        const verified = await verifyToken<{
            sub: string
            session_id: string
            client_id: string
            aud: string
            scope: string
        }>(session.access_token)

        if (!verified) {
            res.clearCookie('console-session', { path: '/console' })
            return res.redirect('/console/login')
        }

        const oauthSession = await db.session.findUnique({
            where: { id: verified.payload.session_id },
            select: {
                expires_at: true,
                user_id: true,
                user: {
                    select: {
                        linked_roles: {
                            select: {
                                role: {
                                    select: {
                                        permissions: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (
            !oauthSession ||
            oauthSession.user_id !== verified.payload.sub ||
            oauthSession.expires_at < new Date()
        ) {
            res.clearCookie('console-session', { path: '/console' })
            return res.redirect('/console/login')
        }

        req.user = { id: oauthSession.user_id }

        const canManageModpack = oauthSession.user.linked_roles.some(
            ({ role }) => {
                const permissions = new Permissions(role.permissions)
                return (
                    permissions.has('ADMIN') ||
                    (anyBits ? permissions.any(bits) : permissions.has(bits))
                )
            },
        )

        if (!canManageModpack) {
            return res.status(403).json({ error: 'Forbidden' })
        }

        next()
    }
}
