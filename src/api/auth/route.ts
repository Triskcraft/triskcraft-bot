import { Router } from 'express'
import authorize from '#/api/auth/authorize/route.ts'
import discord from '#/api/auth/discord/route.ts'

const router = Router()

router.use('/authorize', authorize)
router.use('/discord', discord)

export default router
