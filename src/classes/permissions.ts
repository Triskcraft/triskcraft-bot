import { FlaggedBitfield } from '@eliyya/flagged-bitfield'

export class Permissions extends FlaggedBitfield<typeof Permissions.Flags> {
    static override Flags = {
        ADMIN: 1n << 0n,
        MANNAGE_MODPACK: 1n << 1n,
    } as const
}

export type PermissionName = keyof typeof Permissions.Flags
