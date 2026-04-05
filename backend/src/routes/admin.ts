import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { emailService, initEmailService } from '../services/emailService'

const router = Router()
router.use(authenticate)

const EMAIL_CONFIG_KEYS = [
  'email_enabled',
  'email_host',
  'email_port',
  'email_secure',
  'email_user',
  'email_pass',
  'email_from_name',
  'email_from_address',
]

router.get('/email-config', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: EMAIL_CONFIG_KEYS } },
  })

  const configMap: Record<string, string> = {}
  for (const config of configs) {
    configMap[config.key] = config.value
  }

  res.json({
    success: true,
    data: {
      enabled: configMap['email_enabled'] === 'true',
      host: configMap['email_host'] || '',
      port: parseInt(configMap['email_port'] || '587', 10),
      secure: configMap['email_secure'] === 'true',
      user: configMap['email_user'] || '',
      pass: configMap['email_pass'] ? '******' : '',
      fromName: configMap['email_from_name'] || 'UNISSA',
      fromAddress: configMap['email_from_address'] || 'noreply@unissa.edu.bn',
    },
  })
})

router.put('/email-config', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const {
    enabled,
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromAddress,
  } = req.body as {
    enabled?: boolean
    host?: string
    port?: number
    secure?: boolean
    user?: string
    pass?: string
    fromName?: string
    fromAddress?: string
  }

  const updates: Array<{ key: string; value: string }> = []

  if (enabled !== undefined) {
    updates.push({ key: 'email_enabled', value: enabled ? 'true' : 'false' })
  }
  if (host !== undefined) {
    updates.push({ key: 'email_host', value: host })
  }
  if (port !== undefined) {
    updates.push({ key: 'email_port', value: String(port) })
  }
  if (secure !== undefined) {
    updates.push({ key: 'email_secure', value: secure ? 'true' : 'false' })
  }
  if (user !== undefined) {
    updates.push({ key: 'email_user', value: user })
  }
  if (pass !== undefined && pass !== '******') {
    updates.push({ key: 'email_pass', value: pass })
  }
  if (fromName !== undefined) {
    updates.push({ key: 'email_from_name', value: fromName })
  }
  if (fromAddress !== undefined) {
    updates.push({ key: 'email_from_address', value: fromAddress })
  }

  for (const update of updates) {
    await prisma.systemConfig.upsert({
      where: { key: update.key },
      create: { key: update.key, value: update.value },
      update: { value: update.value },
    })
  }

  await initEmailService()

  res.json({
    success: true,
    message: 'Email configuration updated successfully',
  })
})

router.post('/email-test', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { to } = req.body as { to: string }

  if (!to) {
    res.status(400).json({ success: false, message: 'Email address is required' })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(to)) {
    res.status(400).json({ success: false, message: 'Invalid email address' })
    return
  }

  await initEmailService()

  const result = await emailService.sendTestEmail(to)

  if (result.success) {
    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: { messageId: result.messageId },
    })
  } else {
    res.status(400).json({
      success: false,
      message: 'Failed to send test email',
      error: result.error,
    })
  }
})

router.get('/email-logs', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', status } = req.query as Record<string, string>
  const skip = (Number(page) - 1) * Number(limit)

  const where = status ? { status } : {}

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.emailLog.count({ where }),
  ])

  res.json({
    success: true,
    data: logs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  })
})

router.get('/email-status', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  await initEmailService()

  res.json({
    success: true,
    data: {
      configured: emailService.isConfigured(),
      config: emailService.getConfig() ? {
        host: emailService.getConfig()!.host,
        port: emailService.getConfig()!.port,
        secure: emailService.getConfig()!.secure,
        fromName: emailService.getConfig()!.fromName,
        fromAddress: emailService.getConfig()!.fromAddress,
      } : null,
    },
  })
})

router.post('/demo-reset', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  await prisma.attendanceRecord.deleteMany({})
  await prisma.attendanceSession.deleteMany({})
  await prisma.submission.deleteMany({})
  await prisma.fileAsset.deleteMany({})
  await prisma.payment.deleteMany({})
  await prisma.invoiceAdjustment.deleteMany({})
  await prisma.feeInvoice.deleteMany({})
  await prisma.enrolment.deleteMany({})
  await prisma.courseOffering.updateMany({ data: { seatsTaken: 0 } })
  await prisma.studentGpaRecord.deleteMany({})
  await prisma.studentRiskScore.deleteMany({})
  await prisma.campusCardTransaction.deleteMany({})
  await prisma.campusCard.deleteMany({})
  await prisma.libraryAccount.deleteMany({})
  await prisma.student.deleteMany({})
  await prisma.user.deleteMany({ where: { role: 'student' } })
  await prisma.applicant.deleteMany({})
  await prisma.chatbotConversation.deleteMany({})

  res.json({
    success: true,
    message: 'Demo data reset successfully. Re-seed required to restore demo state.',
  })
})

export default router
