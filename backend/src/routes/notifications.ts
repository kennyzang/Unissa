import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/notifications
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  res.json({ success: true, data: notifications })
})

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const id = String(req.params.id)
  const notif = await prisma.notification.findFirst({
    where: { id, userId },
  })
  if (!notif) { res.status(404).json({ success: false, message: 'Notification not found' }); return }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true, sentAt: new Date() },
  })
  res.json({ success: true, data: updated })
})

// PATCH /api/v1/notifications/mark-all-read
router.patch('/mark-all-read', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
  res.json({ success: true, message: 'All notifications marked as read' })
})

export default router
