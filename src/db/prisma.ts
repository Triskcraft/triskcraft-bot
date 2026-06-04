import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client.ts'
try {
    process.loadEnvFile()
} catch {
    console.error('No existe .env')
}

/**
 * Adaptador de Prisma para PostgreSQL utilizando la cadena de conexión
 * definida en variables de entorno. Se exporta una instancia compartida para
 * reutilizar la conexión durante todo el ciclo de vida del proceso.
 */
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_PATH,
})
export const db = new PrismaClient({ adapter })
