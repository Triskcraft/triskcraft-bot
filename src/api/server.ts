import Express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import v1 from '#/api/v1/route.ts'
import auth from '#/api/oauth/route.ts'
import webhooks from '#/api/webhooks/route.ts'
import console from '#/api/console/route.ts'
import files from '#/api/files/route.ts'
import { ApiError } from '#/api/errors.ts'
import { logger } from '#/logger.ts'
import cookieParser from 'cookie-parser'

/**
 * Servidor HTTP mínimo que expone endpoints de lectura para integraciones
 * externas (por ejemplo, paneles web). Se mantiene desacoplado del cliente
 * de Discord para permitir despliegues independientes.
 */
const app = Express()

app.use(
    cors({
        origin: process.env.FRONT_ORIGIN,
    }),
)
app.use(cookieParser())

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof ApiError) {
        const details = err.cause ?? {}
        return res.status(err.statusCode).json({
            ...details,
            error: err.message,
        })
    }

    logger.error(err, `Error en la ruta ${req.path}`)

    return res.status(500).json({
        error: 'Internal Server Error',
    })
}

app.use(errorHandler)

app.use('/v1', Express.json({ type: 'application/json' }), v1)
app.use('/auth', Express.json({ type: 'application/json' }), auth)
app.use('/webhooks', Express.raw({ type: 'application/json' }), webhooks)
app.use('/console', console)
app.use('/files', files)

export { app }
