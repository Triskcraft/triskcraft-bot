import pino from 'pino'

const pinoConfig: Parameters<typeof pino>[0] = {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
    },
}

export const logger = pino(pinoConfig)
