import { html, render } from '#/utils/html.ts'
import { Router } from 'express'
import mods from './mods/route.ts'
import login from './login/route.ts'
import { Layout } from '#/web/components/layout.ts'
import { requireModpackPermission } from './auth-middleware.ts'

const router = Router()

router.use('/login', login)
router.use(requireModpackPermission)
router.use('/mods', mods)

router.get('/', async (req, res) => {
    render(
        res,
        Layout({
            children: html`
                <div class="container">
                    <h1>Herramientas de Consola</h1>

                    <nav class="menu-links">
                        <a href="/console/mods" class="btn">Upload SMP Mods</a>
                        <!-- <a href="https://google.com" class="btn"
                                        >Enlace Externo</a
                                    > -->
                    </nav>
                </div>
            `,
        }),
    )
})

export default router
