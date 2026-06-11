import { type Request, type Response } from 'express'
import { STATE_KEYS } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { render } from '#/utils/html.ts'
import { Layout } from '#/web/components/layout.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { logger } from '#/logger.ts'
import { RolePanel, type FormAction } from './components.ts'
import type { Role } from '#/db/generated/client.ts'
import { Permissions } from '#/classes/permissions.ts'
import { PrismaClientKnownRequestError } from '#/db/generated/internal/prismaNamespace.ts'

export async function isSystemRole(roleId: string) {
    const systemRoleState = await db.state.findUnique({
        where: { key: STATE_KEYS.SUPER_ROLE_ID },
        select: { value: true },
    })

    return systemRoleState?.value === roleId
}

export async function isDefaultRole(roleId: string) {
    const defaultRoleState = await db.state.findUnique({
        where: { key: STATE_KEYS.DEFAULT_ROLE_ID },
        select: { value: true },
    })

    return defaultRoleState?.value === roleId
}

export async function confirmDeleteRole(
    req: Request<{ id: string }>,
    res: Response,
) {
    const role = await db.role.findUnique({
        where: { id: req.params.id },
    })
    if (!role) {
        res.status(404)
        return render(
            res,
            Layout({
                title: '404',
                children: ErrorCard({
                    code: 404,
                    title: 'No se encontro ese rol',
                    message: 'El rol que buscas no existe',
                    backUrl: '/console/roles',
                }),
            }),
        )
    }
    if (await isSystemRole(role.id)) {
        return renderSystemRoleError(res, role.id)
    }
    if (await isDefaultRole(role.id)) {
        return renderDefaultRoleError(res, role.id)
    }
    try {
        await db.$transaction([
            db.linkedRole.deleteMany({
                where: {
                    role_id: req.params.id,
                },
            }),
            db.role.delete({
                where: {
                    id: req.params.id,
                },
            }),
        ])
    } catch (error) {
        logger.error(error, `error al intentar eliminar el rol ${role.name}`)
        res.status(500)
        return render(
            res,
            Layout({
                title: `Elminando el rol ${role.name}`,
                children: ErrorCard({
                    code: 500,
                    message: 'Intenta más tarde',
                    backUrl: '/console/roles',
                }),
            }),
        )
    }
    return res.redirect('/console/roles')
}

export async function roleFunctions(
    req: Request<
        {
            id: string
        },
        string,
        {
            id: string
        },
        { ac: FormAction }
    >,
    res: Response,
) {
    const role = await db.role.findUnique({
        where: { id: req.params.id },
    })
    if (!role) {
        res.status(404)
        return render(
            res,
            Layout({
                title: '404',
                children: ErrorCard({
                    code: 404,
                    title: 'No se encontro ese rol',
                    message: 'El rol que buscas no existe',
                    backUrl: '/console/roles',
                }),
            }),
        )
    }

    switch (req.query.ac) {
        case 'addusr': {
            return await addUserToRole(role, req.body.id, res)
        }
        case 'rmusr': {
            return await removeUserFromRole(role, req.body.id, res)
        }
        case 'chperm': {
            return await changeRolePermissions(
                role,
                req.body,
                req.user!.id,
                res,
            )
        }
        case 'addrole': {
            return await createRole(role, req.body.id, res)
        }
        case 'chname': {
            return await changeRoleName(role, req.body.id, res)
        }
        case 'setdefault': {
            return await setDefaultRole(role, res)
        }
        default: {
            req.query.ac satisfies never // DO NOT TOUCH
            res.status(400)
            return render(
                res,
                Layout({
                    title: 'Acción inválida',
                    children: ErrorCard({
                        code: 400,
                        title: 'Acción inválida',
                        message:
                            'La acción solicitada no existe o está incompleta.',
                        backUrl: `/console/roles/${role.id}`,
                    }),
                }),
            )
        }
    }
}

export function renderDefaultRoleError(
    res: Parameters<typeof render>[0],
    roleId: string,
) {
    res.status(409)
    return render(
        res,
        Layout({
            title: 'Rol Default',
            children: ErrorCard({
                code: 409,
                title: 'No se puede eliminar el rol Default',
                message:
                    'Establece otro rol como Default antes de eliminar este rol.',
                backUrl: `/console/roles/${roleId}`,
            }),
        }),
    )
}

export function renderSystemRoleError(
    res: Parameters<typeof render>[0],
    roleId: string,
) {
    res.status(403)
    return render(
        res,
        Layout({
            title: 'Rol protegido',
            children: ErrorCard({
                code: 403,
                title: 'Rol administrado por el sistema',
                message:
                    'El rol Super es necesario para administrar la consola y no se puede modificar ni eliminar.',
                backUrl: `/console/roles/${roleId}`,
            }),
        }),
    )
}

export async function setDefaultRole(role: Role, res: Response) {
    if (await isSystemRole(role.id)) {
        res.status(400)
        return render(
            res,
            Layout({
                title: 'Rol Default inválido',
                children: ErrorCard({
                    code: 400,
                    title: 'Super no puede ser el rol Default',
                    message:
                        'El rol Default se asigna a usuarios nuevos y no puede conceder acceso administrativo.',
                    backUrl: `/console/roles/${role.id}`,
                }),
            }),
        )
    }

    try {
        await db.state.upsert({
            where: { key: STATE_KEYS.DEFAULT_ROLE_ID },
            create: {
                key: STATE_KEYS.DEFAULT_ROLE_ID,
                value: role.id,
            },
            update: {
                value: role.id,
            },
        })

        return res.redirect(`/console/roles/${role.id}`)
    } catch (error) {
        logger.error(error, `error al establecer ${role.name} como Default`)
        res.status(500)
        return render(
            res,
            Layout({
                title: 'Actualizando rol Default',
                children: ErrorCard({
                    code: 500,
                    message: 'Intenta más tarde',
                    backUrl: `/console/roles/${role.id}`,
                }),
            }),
        )
    }
}

export async function addUserToRole(
    role: Role,
    discordId: string,
    res: Response,
) {
    if (!discordId) return res.redirect('/console/roles')
    try {
        const user = await db.user.findFirst({
            where: {
                discord_user_id: discordId,
            },
            select: {
                id: true,
            },
        })
        if (!user) {
            res.status(404)
            return render(
                res,
                Layout({
                    title: 'Agregando un rol',
                    children: ErrorCard({
                        code: 404,
                        title: 'No se encontró el usuario',
                        message:
                            'Puede que no halla iniciado sesion en triskcraft.com',
                        backUrl: '/console/roles',
                    }),
                }),
            )
        }
        await db.linkedRole.upsert({
            where: {
                user_id_role_id: {
                    role_id: role.id,
                    user_id: user.id,
                },
            },
            create: {
                role_id: role.id,
                user_id: user.id,
            },
            update: {},
        })
        return render(
            res,
            Layout({
                title: `Administrar rol ${role.name}`,
                children: await RolePanel({
                    role,
                }),
            }),
        )
    } catch (error) {
        logger.error(
            error,
            `error al intentar agregar ${role.name} a ${discordId}`,
        )
        res.status(500)
        return render(
            res,
            Layout({
                title: 'Agregando un rol',
                children: ErrorCard({
                    code: 500,
                    message: 'Intenta más tarde',
                    backUrl: '/console/roles',
                }),
            }),
        )
    }
}

export async function removeUserFromRole(
    role: Role,
    discordId: string,
    res: Response,
) {
    if (!discordId) return res.redirect('/console/roles')
    const userCount = await db.linkedRole.count({
        where: {
            role_id: role.id,
        },
    })
    if (userCount < 2) {
        return renderSystemRoleError(res, role.id)
    }
    try {
        const user = await db.user.findFirst({
            where: {
                discord_user_id: discordId,
            },
            select: {
                id: true,
            },
        })
        if (!user) {
            res.status(404)
            return render(
                res,
                Layout({
                    title: 'Quitando un rol',
                    children: ErrorCard({
                        code: 404,
                        title: 'No se encontró el usuario',
                        message:
                            'Puede que no halla iniciado sesion en triskcraft.com',
                        backUrl: '/console/roles',
                    }),
                }),
            )
        }
        await db.linkedRole.deleteMany({
            where: {
                role_id: role.id,
                user_id: user.id,
            },
        })
        return render(
            res,
            Layout({
                children: await RolePanel({
                    role,
                }),
            }),
        )
    } catch (error) {
        logger.error(
            error,
            `error al intentar quitar ${role.name} a ${discordId}`,
        )
        res.status(500)
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 500,
                    message: 'Intenta más tarde',
                    backUrl: '/console/roles',
                }),
            }),
        )
    }
}

export async function changeRolePermissions(
    role: Role,
    permissionsObject: Record<string, unknown>,
    sessionUserId: string,
    res: Response,
) {
    const perms = new Permissions(Object.keys(permissionsObject))
    try {
        if (await isSystemRole(role.id)) {
            return renderSystemRoleError(res, role.id)
        }
        const superRoleState = await db.state.findUnique({
            where: { key: STATE_KEYS.SUPER_ROLE_ID },
            select: { value: true },
        })
        const sessionUserIsSuper = await db.linkedRole.findUnique({
            where: {
                user_id_role_id: {
                    user_id: sessionUserId,
                    role_id: superRoleState?.value ?? '',
                },
            },
        })

        if (!sessionUserIsSuper) {
            perms.remove('ADMIN')
        }

        const nrole = await db.role.update({
            where: { id: role.id },
            data: {
                permissions: perms.bitfield,
            },
        })
        return render(
            res,
            Layout({
                children: await RolePanel({
                    role: nrole,
                }),
            }),
        )
    } catch (error) {
        logger.error(
            error,
            `error al intentar actualizar el rol ${role.name} con ${perms.bitfield}`,
        )
        res.status(500)
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 500,
                    message: 'Intenta más tarde',
                    backUrl: '/console/roles',
                }),
            }),
        )
    }
}

export async function changeRoleName(role: Role, name: string, res: Response) {
    if (await isSystemRole(role.id)) {
        return renderSystemRoleError(res, role.id)
    }
    try {
        const nrole = await db.role.update({
            where: {
                id: role.id,
            },
            data: {
                name,
            },
        })
        return render(
            res,
            Layout({
                children: await RolePanel({
                    role: nrole,
                }),
            }),
        )
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                res.status(400)
                return render(
                    res,
                    Layout({
                        children: ErrorCard({
                            code: 400,
                            title: 'Ese rol ya existe',
                            message: 'Intenta con otro nombre',
                            backUrl: '/console/roles',
                        }),
                    }),
                )
            }
        }
        logger.error(error, `error al intentar crear el rol ${name}`)
        res.status(500)
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 500,
                    message: 'Intenta más tarde',
                    backUrl: '/console/roles',
                }),
            }),
        )
    }
}

export async function createRole(role: Role, rawName: string, res: Response) {
    const name = typeof rawName === 'string' ? rawName.trim() : ''

    if (!name || name.length > 64) {
        res.status(400)
        return render(
            res,
            Layout({
                title: 'Creando un rol',
                children: ErrorCard({
                    code: 400,
                    title: 'Nombre de rol inválido',
                    message: 'El nombre debe tener entre 1 y 64 caracteres.',
                    backUrl: `/console/roles/${role.id}`,
                }),
            }),
        )
    }

    try {
        const nrole = await db.role.create({
            data: { name },
        })
        return res.redirect('/console/roles/' + nrole.id)
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                res.status(400)
                return render(
                    res,
                    Layout({
                        children: ErrorCard({
                            code: 400,
                            title: 'Ese rol ya existe',
                            message: 'Intenta con otro nombre',
                            backUrl: '/console/roles',
                        }),
                    }),
                )
            }
        }
        logger.error(error, `error al intentar crear el rol ${name}`)
        res.status(500)
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 500,
                    message: 'Intenta más tarde',
                    backUrl: '/console/roles',
                }),
            }),
        )
    }
}
