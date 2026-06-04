import { envs } from '#/config.ts'
import { generateCodeChallenge, generateCodeVerifier } from '#/utils/encript.ts'
import { Router, type Response } from 'express'
import { randomUUID } from 'node:crypto'

const router = Router()
const states = new Map<string, string>()
const CONSOLE_CLIENT_ID = 'api-panel'

router.get('/', async (req, res) => {
    const { code, state } = req.query

    if (!code || typeof state !== 'string') {
        return login(res)
    }

    const code_verifier = states.get(state)
    if (!code_verifier || typeof code !== 'string') {
        return login(res)
    }
    states.delete(state)

    const request = await fetch(new URL('/oauth/token', envs.API_URL), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            redirect_uri: envs.CONSOLE_LOGIN_REDIRECT,
            grant_type: 'authorization_code',
            client_id: CONSOLE_CLIENT_ID,
            code_verifier,
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
        sameSite: 'strict',
        path: '/console',
    })

    res.redirect('/console')
})

function login(res: Response) {
    const verifier = generateCodeVerifier()
    const state = randomUUID()
    const code_challenge = generateCodeChallenge(verifier)
    states.set(state, verifier)

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
