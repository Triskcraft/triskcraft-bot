import { defineConfig } from 'prisma/config'
try {
    process.loadEnvFile()
} catch {
    console.error('No existe .env')
}

export default defineConfig({
    schema: 'src/db/schema.prisma',

    datasource: {
        url: process.env.DATABASE_PATH!,
    },

    migrations: {
        seed: 'node src/db/seed.ts',
    },
})
