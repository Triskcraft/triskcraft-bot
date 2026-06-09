import { envs } from '#/config.ts'
import { generateCodeChallenge, generateCodeVerifier } from '#/utils/encript.ts'
import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'

const router = Router()
const CONSOLE_CLIENT_ID = 'api-panel'
const CONSOLE_OAUTH_COOKIE = 'console-oauth'

interface ConsoleOAuthContext {
    code_verifier: string
    state: string
}

function getConsoleOAuthContext(req: Request): ConsoleOAuthContext | null {
    try {
        const raw = JSON.parse(req.cookies[CONSOLE_OAUTH_COOKIE])
        if (
            typeof raw.code_verifier !== 'string' ||
            typeof raw.state !== 'string'
        ) {
            return null
        }
        return raw as ConsoleOAuthContext
    } catch {
        return null
    }
}

router.get('/', async (req, res) => {
    const { code, state } = req.query

    if (!code || typeof state !== 'string') {
        return login(res)
    }

    const context = getConsoleOAuthContext(req)
    if (
        !context ||
        context.state !== state ||
        typeof code !== 'string'
    ) {
        res.clearCookie(CONSOLE_OAUTH_COOKIE, { path: '/console/login' })
        return login(res)
    }
    res.clearCookie(CONSOLE_OAUTH_COOKIE, { path: '/console/login' })

    const request = await fetch(new URL('/oauth/token', envs.API_URL), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            redirect_uri: envs.CONSOLE_LOGIN_REDIRECT,
            grant_type: 'authorization_code',
            client_id: CONSOLE_CLIENT_ID,
            code_verifier: context.code_verifier,
            code,
        }),
    })

    if (!request.ok) {
        return login(res)
    }

    const response = await request.json()

    res.cookie('console-session', JSON.stringify(response), {
        httpOnly: true,
        secure: envs.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/console',
    })

    res.redirect('/console')
})

function login(res: Response) {
    const verifier = generateCodeVerifier()
    const state = randomUUID()
    const code_challenge = generateCodeChallenge(verifier)

    res.cookie(
        CONSOLE_OAUTH_COOKIE,
        JSON.stringify({ code_verifier: verifier, state }),
        {
            httpOnly: true,
            secure: envs.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/console/login',
            maxAge: 10 * 60 * 1000,
        },
    )

    return res.redirect(
        `/oauth/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: CONSOLE_CLIENT_ID,
            code_challenge,
            code_challenge_method: 'S256',
            redirect_uri: envs.CONSOLE_LOGIN_REDIRECT,
            scope: 'openid identify',
            state,
        })}`,
    )
}

export default router
