import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string }

  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username and password are required' })
    return
  }

  const user = await prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } })

  if (!user || !user.isActive) {
    res.status(401).json({ success: false, message: 'Invalid credentials' })
    return
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    res.status(401).json({ success: false, message: 'Account temporarily locked. Try again later.' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)

  if (!valid) {
    const newCount = user.failedLoginCount + 1
    const locked = newCount >= 5
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: newCount,
        lockedUntil: locked ? new Date(Date.now() + 15 * 60 * 1000) : null, // 15min lock
      },
    })
    res.status(401).json({
      success: false,
      message: locked
        ? 'Account locked after 5 failed attempts. Try again in 15 minutes.'
        : `Invalid credentials (${newCount}/5 attempts)`,
    })
    return
  }

  // Reset on success
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  })

  await prisma.auditLog.create({
    data: { userId: user.id, action: 'LOGIN', ipAddress: req.ip },
  })

  const token = signToken({ userId: user.id, role: user.role, username: user.username })

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        isActive: user.isActive,
      },
      token,
    },
  })
})

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.auditLog.create({
    data: { userId: req.user?.userId, action: 'LOGOUT', ipAddress: req.ip },
  }).catch(() => {})
  res.json({ success: true, message: 'Logged out' })
})

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, username: true, displayName: true, role: true, email: true, isActive: true, lastLoginAt: true },
  })
  if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return }
  res.json({ success: true, data: user })
})

export default router
