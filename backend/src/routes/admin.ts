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

// ── Departments ──────────────────────────────────────────────────────────────

// GET /admin/departments — all departments with children (admin/manager)
router.get('/departments', requireRole('admin', 'manager'), async (_req: AuthRequest, res: Response) => {
  const departments = await prisma.department.findMany({
    where: { parentId: null },        // top-level only; children are nested
    include: { children: true },
    orderBy: { name: 'asc' },
  })
  res.json({ success: true, data: departments })
})

// GET /admin/programmes — list all programmes (for filter dropdowns)
router.get('/programmes', requireRole('admin', 'manager'), async (_req: AuthRequest, res: Response) => {
  const programmes = await prisma.programme.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  })
  res.json({ success: true, data: programmes })
})

// ── Courses ───────────────────────────────────────────────────────────────────

// GET /admin/courses — all courses with dept name, programmes, offerings summary
router.get('/courses', requireRole('admin', 'manager'), async (_req: AuthRequest, res: Response) => {
  const [courses, departments] = await Promise.all([
    prisma.course.findMany({
      include: {
        _count: { select: { offerings: true } },
        programmeCourses: {
          include: { programme: { select: { id: true, name: true, code: true } } },
        },
        offerings: {
          include: {
            semester: { select: { id: true, name: true, isActive: true } },
            lecturer: { include: { user: { select: { displayName: true } } } },
            _count: { select: { enrolments: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { code: 'asc' },
    }),
    prisma.department.findMany({ select: { id: true, name: true, code: true } }),
  ])

  const deptById = Object.fromEntries(departments.map(d => [d.id, d]))

  const data = courses.map(({ offerings, programmeCourses, ...rest }) => {
    const totalEnrolled = offerings.reduce((s, o) => s + o._count.enrolments, 0)
    const activeOfferings = offerings.filter(o => o.semester.isActive).length
    // Primary lecturer: first active-semester offering, else first offering overall
    const primaryOffering = offerings.find(o => o.semester.isActive) ?? offerings[0]
    return {
      ...rest,
      department: deptById[rest.departmentId] ?? null,
      programmes: programmeCourses.map(pc => pc.programme),
      totalEnrolled,
      activeOfferings,
      primaryLecturer: primaryOffering?.lecturer?.user?.displayName ?? null,
      offerings: offerings.map(({ _count, ...o }) => ({
        ...o,
        enrolledCount: _count.enrolments,
      })),
    }
  })

  res.json({ success: true, data })
})

// POST /admin/courses — create course (admin only)
router.post('/courses', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { code, name, departmentId, creditHours, level, isOpenToInternational, maxSeats } = req.body as {
    code: string; name: string; departmentId: string
    creditHours?: number; level?: number; isOpenToInternational?: boolean; maxSeats?: number
  }

  if (!code || !name || !departmentId) {
    res.status(400).json({ success: false, message: 'code, name and departmentId are required' })
    return
  }

  const existing = await prisma.course.findUnique({ where: { code } })
  if (existing) {
    res.status(409).json({ success: false, message: `Course code "${code}" already exists` })
    return
  }

  const course = await prisma.course.create({
    data: {
      code,
      name,
      departmentId,
      creditHours:            Number(creditHours ?? 3),
      level:                  Number(level ?? 1),
      isOpenToInternational:  isOpenToInternational ?? true,
      maxSeats:               Number(maxSeats ?? 40),
      status:                 'published',
    },
  })
  res.status(201).json({ success: true, data: course, message: 'Course created' })
})

// PUT /admin/courses/:id — update course (admin/manager)
router.put('/courses/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, departmentId, creditHours, level, isOpenToInternational, maxSeats } = req.body as {
    name?: string; departmentId?: string; creditHours?: number
    level?: number; isOpenToInternational?: boolean; maxSeats?: number
  }

  const course = await prisma.course.update({
    where: { id: req.params.id },
    data: { name, departmentId, creditHours, level, isOpenToInternational, maxSeats },
  })
  res.json({ success: true, data: course, message: 'Course updated' })
})

// DELETE /admin/courses/:id — delete course (admin only; blocked if offerings exist)
router.delete('/courses/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const offeringCount = await prisma.courseOffering.count({ where: { courseId: req.params.id } })
  if (offeringCount > 0) {
    res.status(409).json({
      success: false,
      message: `Cannot delete: course has ${offeringCount} offering(s). Remove offerings first.`,
    })
    return
  }
  await prisma.course.delete({ where: { id: req.params.id } })
  res.json({ success: true, message: 'Course deleted' })
})

// GET /admin/courses/:id/enrolments — all offerings with student rosters + assignments
router.get('/courses/:id/enrolments', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const offerings = await prisma.courseOffering.findMany({
    where: { courseId: req.params.id },
    include: {
      semester: { select: { name: true, isActive: true } },
      lecturer: { include: { user: { select: { displayName: true } } } },
      enrolments: {
        where:   { status: 'registered' },
        include: { student: { include: { user: { select: { displayName: true } } } } },
        orderBy: { registeredAt: 'asc' },
      },
      assignments: {
        select: { id: true, title: true, dueDate: true, maxMarks: true, weightPct: true },
        orderBy: { dueDate: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ success: true, data: offerings })
})

// PATCH /admin/courses/:id/approve — approve or reject a pending course proposal
router.patch('/courses/:id/approve', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const { action } = req.body as { action: 'approve' | 'reject' }
  if (!action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' })
    return
  }
  const course = await prisma.course.update({
    where: { id: req.params.id },
    data:  { status: action === 'approve' ? 'published' : 'draft' },
  })
  res.json({ success: true, data: course, message: action === 'approve' ? 'Course approved' : 'Course proposal rejected' })
})

// ── Enrolments ────────────────────────────────────────────────────────────────

// DELETE /admin/enrolments/:enrolmentId — remove student from course offering
router.delete('/enrolments/:enrolmentId', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const enrolment = await prisma.enrolment.findUnique({ where: { id: req.params.enrolmentId } })
  if (!enrolment) {
    res.status(404).json({ success: false, message: 'Enrolment not found' })
    return
  }
  await prisma.enrolment.delete({ where: { id: req.params.enrolmentId } })
  await prisma.courseOffering.updateMany({
    where: { id: enrolment.offeringId, seatsTaken: { gt: 0 } },
    data:  { seatsTaken: { decrement: 1 } },
  })
  res.json({ success: true, message: 'Student removed from course' })
})

// ─────────────────────────────────────────────────────────────────────────────

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
