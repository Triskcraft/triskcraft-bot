import { Router } from 'express'
import members from '#/api/v1/members/route.ts'
import posts from '#/api/v1/posts/route.ts'
import games from '#/api/v1/games/[game]/players/route.ts'

const router = Router()

router.use('/members', members)
router.use('/posts', posts)
router.use('/games/minecraft/players', games)

export default router
