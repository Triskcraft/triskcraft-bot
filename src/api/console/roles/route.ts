import { render } from '#/utils/html.ts'
import { Router, urlencoded } from 'express'
import { Layout } from '#/web/components/layout.ts'
import { db } from '#/db/prisma.ts'
import { PermissionsFlagsBits } from '#/classes/permissions.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { requirePermission } from '#/api/console/auth-middleware.ts'
import { DeleteRoleForm, RolePanel } from './components.ts'
import {
    confirmDeleteRole,
    isSystemRole,
    renderSystemRoleError,
    roleFunctions,
} from './post.ts'

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

router.post('/:id/delete', confirmDeleteRole)

router.post(
    '/:id',
    requirePermission(PermissionsFlagsBits.MANAGE_ROLES),
    roleFunctions,
)

export default router
