import { envs } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { generateCodeChallenge, generateCodeVerifier } from '#/utils/encript.ts'
import { html, render } from '#/utils/html.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { Layout } from '#/web/components/layout.ts'
import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'

const router = Router()
const CONSOLE_CLIENT_ID = 'api-panel'
const CONSOLE_OAUTH_COOKIE = 'console-oauth'
const CONSOLE_LOGIN_CALLBACK = new URL(
    '/console/login/callback',
    envs.CONSOLE_LOGIN_REDIRECT,
).toString()

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

router.get('/', async (_req, res) => {
    const callbackRegistered = await ensureConsoleCallbackRegistered()
    if (!callbackRegistered) {
        return renderLoginError(
            res,
            'El cliente OAuth de la consola no está configurado.',
        )
    }

    const loginUrl = createLoginUrl(res)

    return render(
        res,
        Layout({
            title: 'Acceso a la consola',
            children: html`
                <main class="container">
                    <section class="login-panel">
                        <p class="login-label">Consola administrativa</p>
                        <h1>Acceso restringido</h1>
                        <p class="login-message">
                            Estás entrando a una consola exclusiva para personal
                            autorizado de Triskcraft.
                        </p>
                        <a class="btn" href="${loginUrl}">
                            Iniciar sesión con Discord
                        </a>
                    </section>
                </main>

                <style>
                    .login-panel {
                        background-color: white;
                        border: 1px solid #d9dce3;
                        border-top: 5px solid #5865f2;
                        border-radius: 8px;
                        box-shadow: 0 12px 32px rgba(31, 35, 48, 0.12);
                        padding: 36px 30px;
                    }

                    .login-label {
                        color: #5865f2;
                        font-size: 0.8rem;
                        font-weight: 700;
                        margin: 0 0 8px;
                        text-transform: uppercase;
                    }

                    .login-message {
                        color: #5d6270;
                        line-height: 1.6;
                        margin: 0 0 28px;
                    }

                    .login-panel .btn {
                        display: block;
                        background-color: #5865f2;
                    }

                    .login-panel .btn:hover {
                        background-color: #4752c4;
                    }
                </style>
            `,
        }),
    )
})

router.get('/callback', async (req, res) => {
    const { code, state } = req.query
    const context = getConsoleOAuthContext(req)

    if (
        !context ||
        context.state !== state ||
        typeof code !== 'string' ||
        typeof state !== 'string'
    ) {
        res.clearCookie(CONSOLE_OAUTH_COOKIE, { path: '/console/login' })
        return renderLoginError(
            res,
            'El contexto de inicio de sesión no es válido o expiró.',
        )
    }

    res.clearCookie(CONSOLE_OAUTH_COOKIE, { path: '/console/login' })

    const request = await fetch(new URL('/oauth/token', envs.API_URL), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            redirect_uri: CONSOLE_LOGIN_CALLBACK,
            grant_type: 'authorization_code',
            client_id: CONSOLE_CLIENT_ID,
            code_verifier: context.code_verifier,
            code,
        }),
    })

    if (!request.ok) {
        return renderLoginError(
            res,
            'No se pudo completar el inicio de sesión. Inténtalo de nuevo.',
        )
    }

    const response = await request.json()

    res.cookie('console-session', JSON.stringify(response), {
        httpOnly: true,
        secure: envs.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/console',
    })

    return res.redirect('/console')
})

function createLoginUrl(res: Response) {
    const verifier = generateCodeVerifier()
    const state = randomUUID()
    const codeChallenge = generateCodeChallenge(verifier)

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

    return `/oauth/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: CONSOLE_CLIENT_ID,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        redirect_uri: CONSOLE_LOGIN_CALLBACK,
        scope: 'openid identify',
        state,
    })}`
}

async function ensureConsoleCallbackRegistered() {
    const client = await db.client.findUnique({
        where: { id: CONSOLE_CLIENT_ID },
        select: { redirect_uris: true },
    })

    if (!client) {
        return false
    }

    if (!client.redirect_uris.includes(CONSOLE_LOGIN_CALLBACK)) {
        await db.client.update({
            where: { id: CONSOLE_CLIENT_ID },
            data: {
                redirect_uris: [
                    ...client.redirect_uris,
                    CONSOLE_LOGIN_CALLBACK,
                ],
            },
        })
    }

    return true
}

function renderLoginError(res: Response, message: string) {
    return render(
        res,
        Layout({
            title: 'Error de inicio de sesión',
            children: ErrorCard({
                code: 400,
                title: 'No se pudo iniciar sesión',
                message,
                backUrl: '/console/login',
            }),
        }),
    )
}

export default router
