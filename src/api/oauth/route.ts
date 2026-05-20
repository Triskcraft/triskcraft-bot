import { Router } from 'express'
import authorize from '#/api/oauth/authorize/route.ts'
import discord from '#/api/oauth/discord/route.ts'
import token from '#/api/oauth/token/route.ts'

const router = Router()

router.use('/authorize', authorize)
router.use('/discord', discord)
router.use('/token', token)

export default router
