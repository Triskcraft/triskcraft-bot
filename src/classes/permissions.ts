import { FlaggedBitfield } from '@eliyya/flagged-bitfield'

export class Permissions extends FlaggedBitfield<typeof Permissions.Flags> {
    static override Flags = {
        ADMIN: 1n << 0n,
        MANAGE_MODPACK: 1n << 1n,
        MANAGE_ROLES: 1n << 2n,
    } as const
}

export const PermissionsFlagsBits = Permissions.Flags

export type PermissionName = keyof typeof Permissions.Flags
