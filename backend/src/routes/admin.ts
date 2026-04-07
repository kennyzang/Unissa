import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { emailService, initEmailService } from '../services/emailService'

const router = Router()
router.use(authenticate)

router.get('/email-config', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  const config = await prisma.systemConfig.findUnique({
    where: { key: 'resend_api_key' },
  })

  res.json({
    success: true,
    data: {
      apiKey: config?.value ? '******' : '',
      configured: !!config?.value,
    },
  })
})

router.put('/email-config', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { apiKey } = req.body as { apiKey?: string }

  if (apiKey !== undefined && apiKey !== '******') {
    await prisma.systemConfig.upsert({
      where: { key: 'resend_api_key' },
      create: { key: 'resend_api_key', value: apiKey },
      update: { value: apiKey },
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
  try {
    // Step 1: attendance (records before sessions — FK order)
    const { count: attendanceRecords } = await prisma.attendanceRecord.deleteMany({})
    const { count: attendanceSessions } = await prisma.attendanceSession.deleteMany({})

    // Step 2: submissions and their file assets
    const { count: submissions } = await prisma.submission.deleteMany({})
    await prisma.fileAsset.deleteMany({})

    // Step 3: payments, invoice adjustments, invoices (FK order)
    const { count: payments } = await prisma.payment.deleteMany({})
    await prisma.invoiceAdjustment.deleteMany({})
    const { count: invoices } = await prisma.feeInvoice.deleteMany({})

    // Step 4: enrolments, then reset seat counts
    const { count: enrolments } = await prisma.enrolment.deleteMany({})
    await prisma.courseOffering.updateMany({ data: { seatsTaken: 0 } })

    // Step 5: analytics records
    await prisma.studentGpaRecord.deleteMany({})
    await prisma.studentRiskScore.deleteMany({})

    // Step 6: campus cards
    const { count: campusCardTransactions } = await prisma.campusCardTransaction.deleteMany({})
    await prisma.campusCard.deleteMany({})

    // Step 7: library accounts, then students (FK: student → user)
    await prisma.libraryAccount.deleteMany({})
    const { count: students } = await prisma.student.deleteMany({})

    // Step 8: course materials (FK: uploadedBy → user)
    await prisma.courseMaterial.deleteMany({})

    // Step 9: chatbot conversations (FK: userId → user)
    const { count: chatbotConversations } = await prisma.chatbotConversation.deleteMany({})

    // Step 10: notifications (FK: userId → user)
    await prisma.notification.deleteMany({})

    // Step 11: push subscriptions (FK: userId → user)
    await prisma.pushSubscription.deleteMany({})

    // Step 12: audit logs (FK: userId → user)
    await prisma.auditLog.deleteMany({})

    // Step 13: esignatures (FK: userId → user)
    await prisma.esignature.deleteMany({})

    // Step 14: applicants (after student FK removed)
    const { count: applicants } = await prisma.applicant.deleteMany({})

    // Step 15: users with role = student (after all FK removed)
    const { count: users } = await prisma.user.deleteMany({ where: { role: 'student' } })

    res.json({
      success: true,
      message: 'Demo reset complete',
      deleted: {
        students,
        users,
        applicants,
        enrolments,
        submissions,
        payments,
        invoices,
        attendanceRecords,
        attendanceSessions,
        campusCardTransactions,
        chatbotConversations,
      },
    })
  } catch (error: any) {
    console.error('Demo reset failed:', error)
    res.status(500).json({
      success: false,
      message: 'Demo reset failed',
      error: error.message,
    })
  }
})

export default router
