import { html, render } from '#/utils/html.ts'
import { Router } from 'express'
import mods from './mods/route.ts'
import roles from './roles/route.ts'
import login from './login/route.ts'
import { Layout } from '#/web/components/layout.ts'
import { requirePermission } from './auth-middleware.ts'
import { PermissionsFlagsBits } from '#/classes/permissions.ts'
import { AnchorButton } from '#/web/components/button.ts'

const router = Router()

router.use('/login', login)
router.use(
    '/mods',
    requirePermission(PermissionsFlagsBits.MANAGE_MODPACK),
    mods,
)
router.use(
    '/roles',
    requirePermission(PermissionsFlagsBits.MANAGE_ROLES),
    roles,
)

router.get(
    '/',
    requirePermission(
        PermissionsFlagsBits.MANAGE_MODPACK | PermissionsFlagsBits.MANAGE_ROLES,
    ),
    async (req, res) => {
        render(
            res,
            Layout({
                children: html`
                    <div class="container">
                        <h1>Herramientas de Consola</h1>

                        <nav class="menu-links">
                            ${AnchorButton({
                                href: '/console/mods',
                                children: 'Upload SMP Mods',
                            })}
                            ${AnchorButton({
                                href: '/console/roles',
                                children: 'Manage Roles',
                            })}
                        </nav>
                    </div>
                `,
            }),
        )
    },
)

export default router
