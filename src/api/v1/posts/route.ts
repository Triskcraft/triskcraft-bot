import { Router } from 'express'
import { getPosts, getPostsById } from '#/api/v1/posts/get.ts'

const router = Router()

router.get('/', getPosts)
router.get('/:id', getPostsById)

export default router
