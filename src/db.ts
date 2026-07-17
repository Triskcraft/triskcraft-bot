import { createPrismaClient } from '@triskcraft/db'
import { envs } from './config.ts'

export const db = createPrismaClient()
