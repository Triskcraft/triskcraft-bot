import { envs } from '#/config.ts'
import { generateCodeChallenge, generateCodeVerifier } from '#/utils/encript.ts'
import { Router, type Response } from 'express'
import { randomUUID } from 'node:crypto'

const router = Router()
const states = new Map<string, string>()

router.get('/', async (req, res) => {
    const { code, state } = req.query

    if (!code || typeof state !== 'string') {
        return login(res)
    }

    const code_verifier = states.get(state)

    const request = await fetch('/auth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            redirect_uri: envs.CONSOLE_LOGIN_REDIRECT,
            grant_type: 'authorization_code',
            client_id: 'api-panel',
            code_verifier,
            code,
        }),
    })

    if (!request.ok) {
        return login(res)
    }

    const response = await request.json()

    res.cookie('console-session', JSON.stringify(response))

    res.redirect('/console')
})

function login(res: Response) {
    const verifier = generateCodeVerifier()
    const state = randomUUID()
    const code_challenge = generateCodeChallenge(verifier)
    states.set(state, verifier)

    return res.redirect(
        `/auth/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: 'api-panel',
            code_challenge, // TODO: dynamic
            code_challenge_method: 'S256',
            redirect_uri: 'http://localhost:8080/console/login',
            state,
        })}`,
    )
}

export default router
