import { Router } from 'express'
import { getPlayers } from './get.ts'

const router = Router()

router.get('/', getPlayers)

export default router
