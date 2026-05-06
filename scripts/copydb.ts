import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#/db/generated/client.ts'
try {
    process.loadEnvFile()
} catch {
    console.error('No existe .env')
}

const { DATABASE_PROD, DATABASE_PATH } = process.env

if (!DATABASE_PROD) {
    console.error('missing DATABASE_PROD in .env')
    process.exit(1)
}
if (!DATABASE_PATH) {
    console.error('missing DATABASE_PATH in .env')
    process.exit(1)
}

const prod = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_PROD,
    }),
})

const local = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_PATH,
    }),
})

// discord users
await local.discordUser.createMany({
    data: await prod.discordUser.findMany(),
})

// minecraft users
await local.player.createMany({
    data: await prod.player.findMany(),
})

// roles
await local.role.createMany({
    data: await prod.role.findMany(),
})

// linked roles
await local.linkedRole.createMany({
    data: await prod.linkedRole.findMany(),
})
