import { render } from '#/utils/html.ts'
import { Router, urlencoded, type Request } from 'express'
import { Layout } from '#/web/components/layout.ts'
import { db } from '#/db/prisma.ts'
import { Permissions, PermissionsFlagsBits } from '#/classes/permissions.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { requirePermission } from '#/api/console/auth-middleware.ts'
import { logger } from '#/logger.ts'
import { PrismaClientKnownRequestError } from '#/db/generated/internal/prismaNamespace.ts'
import { STATE_KEYS } from '#/config.ts'
import {
    DeleteRoleForm,
    FORM_ACTIONS,
    RolePanel,
    type FormAction,
} from './components.ts'

const router = Router()
router.use(urlencoded({ extended: true }))

router.get('/', async (req, res) => {
    const role = await db.role.findFirst({
        select: { id: true },
    })
    return res.redirect('/console/roles/' + role?.id)
})

router.get('/:id', async (req, res) => {
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
    render(
        res,
        Layout({
            title: `Administrar rol ${role.name}`,
            children: await RolePanel({
                role,
            }),
        }),
    )
})

router.get('/:id/delete', async (req, res) => {
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
    render(
        res,
        Layout({
            title: `Administrar rol ${role.name}`,
            children: DeleteRoleForm({ role }),
        }),
    )
})

router.post('/:id/delete', async (req, res) => {
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
})

router.post(
    '/:id',
    requirePermission(PermissionsFlagsBits.MANAGE_ROLES),
    async (
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
        res,
    ) => {
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

        const modifiesSelectedRole =
            req.query.ac === FORM_ACTIONS.ADDUSR ||
            req.query.ac === FORM_ACTIONS.RMUSR ||
            req.query.ac === FORM_ACTIONS.CHPERM

        if (modifiesSelectedRole && (await isSystemRole(role.id))) {
            return renderSystemRoleError(res, role.id)
        }

        switch (req.query.ac) {
            case 'addusr': {
                const form = req.body
                const discordId = form.id
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
                        `error al intentar agregar ${role.name} a ${form.id}`,
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
            case 'rmusr': {
                const form = req.body
                const discordId = form.id
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
                        `error al intentar quitar ${role.name} a ${form.id}`,
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
            case 'chperm': {
                const perms = new Permissions(Object.keys(req.body))
                try {
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
            case 'addrole': {
                const rawName = req.body.id
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
                                message:
                                    'El nombre debe tener entre 1 y 64 caracteres.',
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
                    logger.error(
                        error,
                        `error al intentar crear el rol ${name}`,
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
            case 'chname': {
                const name = req.body.id
                const superState = await db.state.findFirst({
                    where: { key: STATE_KEYS.SUPER_ROLE_ID },
                })
                if (role.id === superState!.value) {
                    res.status(500)
                    return render(
                        res,
                        Layout({
                            children: ErrorCard({
                                code: 500,
                                title: 'Operación prohibida',
                                message: 'Este rol es manejado por el sistema',
                                backUrl: '/console/roles',
                            }),
                        }),
                    )
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
                    logger.error(
                        error,
                        `error al intentar crear el rol ${name}`,
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
                return
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
    },
)

export default router

async function isSystemRole(roleId: string) {
    const systemRoleState = await db.state.findUnique({
        where: { key: STATE_KEYS.SUPER_ROLE_ID },
        select: { value: true },
    })

    return systemRoleState?.value === roleId
}

function renderSystemRoleError(
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
