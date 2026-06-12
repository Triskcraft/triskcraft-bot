import { Router } from 'express'
import authorize from '#/api/oauth/authorize/route.ts'
import discord from '#/api/oauth/discord/route.ts'
import me from '#/api/oauth/me/route.ts'
import refresh from '#/api/oauth/refresh/route.ts'
import token from '#/api/oauth/token/route.ts'
import minecraft from '#/api/oauth/minecraft/route.ts'

const router = Router()

router.use('/authorize', authorize)
router.use('/discord', discord)
router.use('/me', me)
router.use('/minecraft', minecraft)
router.use('/refresh', refresh)
router.use('/token', token)

export default router
