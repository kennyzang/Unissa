import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'
import prisma from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: { userId: string; role: string; username: string }
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' })
    return
  }
  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

export const requireRole = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' })
      return
    }
    next()
  }

export const auditLog = (action: string, entityType?: string) =>
  async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.userId,
          action,
          entityType,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      })
    } catch { /* non-blocking */ }
    next()
  }
