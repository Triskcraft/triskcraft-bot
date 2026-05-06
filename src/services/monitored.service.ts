import { db } from '#/db/prisma.ts'
import { Temporal } from '@js-temporal/polyfill'

/**
 * Gestiona los roles que los administradores desean monitorear.
 */
export class MonitoredService {
    async addRole(guild_id: string, role_id: string) {
        // Se usa upsert implícito manejando colisión mediante catch.
        await db.trackedRole
            .create({
                data: { guild_id, role_id },
            })
            .catch(() => null)
    }

    async removeRole(guild_id: string, role_id: string) {
        await db.trackedRole.delete({
            where: { guild_id_role_id: { guild_id, role_id } },
        })
    }

    async listRoles(guild_id: string) {
        const result = await db.trackedRole.findMany({
            where: { guild_id },
            select: { role_id: true },
        })

        return result.map(row => row.role_id)
    }

    async persistSnapshot(
        guild_id: string,
        role_id: string,
        inactive_count: number,
        active_count: number,
    ) {
        // Guarda una instantánea simple para alimentar gráficos y tendencias.
        await db.roleStatistic.create({
            data: { guild_id, role_id, inactive_count, active_count },
        })
    }

    async getSnapshots(guild_id: string, sinceDays = 30) {
        const since = new Date(
            Temporal.Now.instant().subtract({ hours: sinceDays * 24 })
                .epochMilliseconds,
        )
        // Recupera historial limitado para no saturar consultas de reporte.
        return await db.roleStatistic.findMany({
            where: { guild_id, captured_at: { gte: since } },
            orderBy: { captured_at: 'desc' },
        })
    }
}

export const monitoredService = new MonitoredService()
