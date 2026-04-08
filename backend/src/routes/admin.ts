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
  const { code, name, departmentId, creditHours, level, isOpenToInternational, maxSeats, lecturerId } = req.body as {
    code: string; name: string; departmentId: string
    creditHours?: number; level?: number; isOpenToInternational?: boolean; maxSeats?: number
    lecturerId?: string
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

  // If a lecturer is assigned, create a CourseOffering in the active semester
  if (lecturerId) {
    try {
      const activeSemester = await prisma.semester.findFirst({ where: { isActive: true } })
      if (activeSemester) {
        await prisma.courseOffering.create({
          data: {
            courseId:     course.id,
            semesterId:   activeSemester.id,
            lecturerId,
            departmentId,
            dayOfWeek:    'Monday',
            startTime:    '08:00',
            endTime:      '10:00',
            room:         'TBD',
          },
        })

        // Notify the assigned lecturer
        const lecturer = await prisma.staff.findUnique({
          where: { id: lecturerId },
          select: { userId: true, fullName: true },
        })
        if (lecturer?.userId) {
          await prisma.notification.create({
            data: {
              userId:            lecturer.userId,
              type:              'course_assigned',
              subject:           `New course assigned: ${code} – ${name}`,
              body:              `You have been assigned to teach ${code} – ${name} for ${activeSemester.name}. Please log in to the LMS to review the course details and set up your materials.`,
              status:            'pending',
              triggeredByEvent:  'course_offering_created',
            },
          })
        }
      }
    } catch (err) {
      console.error('[admin/courses] Failed to create offering or notification:', err)
      // Course was created successfully; offering failure is non-fatal
    }
  }

  res.status(201).json({ success: true, data: course, message: lecturerId ? 'Course created and lecturer assigned' : 'Course created' })
})

// PUT /admin/courses/:id — update course (admin/manager)
router.put('/courses/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, departmentId, creditHours, level, isOpenToInternational, maxSeats } = req.body as {
    name?: string; departmentId?: string; creditHours?: number
    level?: number; isOpenToInternational?: boolean; maxSeats?: number
  }

  const course = await prisma.course.update({
    where: { id: String(req.params.id) },
    data: { name, departmentId, creditHours, level, isOpenToInternational, maxSeats },
  })
  res.json({ success: true, data: course, message: 'Course updated' })
})

// DELETE /admin/courses/:id — delete course (admin only; blocked if offerings exist)
router.delete('/courses/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const offeringCount = await prisma.courseOffering.count({ where: { courseId: String(req.params.id) } })
  if (offeringCount > 0) {
    res.status(409).json({
      success: false,
      message: `Cannot delete: course has ${offeringCount} offering(s). Remove offerings first.`,
    })
    return
  }
  await prisma.course.delete({ where: { id: String(req.params.id) } })
  res.json({ success: true, message: 'Course deleted' })
})

// GET /admin/courses/:id/enrolments — all offerings with student rosters + assignments
router.get('/courses/:id/enrolments', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const offerings = await prisma.courseOffering.findMany({
    where: { courseId: String(req.params.id) },
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
    where: { id: String(req.params.id) },
    data:  { status: action === 'approve' ? 'published' : 'draft' },
  })
  res.json({ success: true, data: course, message: action === 'approve' ? 'Course approved' : 'Course proposal rejected' })
})

// ── Enrolments ────────────────────────────────────────────────────────────────

// DELETE /admin/enrolments/:enrolmentId — remove student from course offering
router.delete('/enrolments/:enrolmentId', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const enrolment = await prisma.enrolment.findUnique({ where: { id: String(req.params.enrolmentId) } })
  if (!enrolment) {
    res.status(404).json({ success: false, message: 'Enrolment not found' })
    return
  }
  await prisma.enrolment.delete({ where: { id: String(req.params.enrolmentId) } })
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

    // Step 3: course materials (FK: uploadedBy → user, may reference fileAsset)
    await prisma.courseMaterial.deleteMany({})

    // Step 4: now delete file assets (all references should be removed)
    await prisma.fileAsset.deleteMany({})

    // Step 5: payments, invoice adjustments, invoices (FK order)
    const { count: payments } = await prisma.payment.deleteMany({})
    await prisma.invoiceAdjustment.deleteMany({})
    const { count: invoices } = await prisma.feeInvoice.deleteMany({})

    // Step 6: enrolments, then reset seat counts
    const { count: enrolments } = await prisma.enrolment.deleteMany({})
    await prisma.courseOffering.updateMany({ data: { seatsTaken: 0 } })

    // Step 7: analytics records
    await prisma.studentGpaRecord.deleteMany({})
    await prisma.studentRiskScore.deleteMany({})

    // Step 8: campus cards
    const { count: campusCardTransactions } = await prisma.campusCardTransaction.deleteMany({})
    await prisma.campusCard.deleteMany({})

    // Step 9: library accounts, then students (FK: student → user)
    await prisma.libraryAccount.deleteMany({})
    const { count: students } = await prisma.student.deleteMany({})

    // Step 10: chatbot conversations (FK: userId → user)
    const { count: chatbotConversations } = await prisma.chatbotConversation.deleteMany({})

    // Step 11: notifications (FK: userId → user)
    await prisma.notification.deleteMany({})

    // Step 12: push subscriptions (FK: userId → user)
    await prisma.pushSubscription.deleteMany({})

    // Step 13: audit logs (FK: userId → user)
    await prisma.auditLog.deleteMany({})

    // Step 14: esignatures (FK: userId → user)
    await prisma.esignature.deleteMany({})

    // Step 15: applicants (after student FK removed)
    const { count: applicants } = await prisma.applicant.deleteMany({})

    // Step 16: users with role = student (after all FK removed), except noor and zara
    const { count: users } = await prisma.user.deleteMany({ 
      where: { 
        role: 'student',
        username: { notIn: ['noor', 'zara'] }
      } 
    })

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

router.post('/reset-student-enrollment', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { usernames } = req.body as { usernames: string[] }

    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      res.status(400).json({ success: false, message: 'Usernames array is required' })
      return
    }

    // Get users by usernames
    const users = await prisma.user.findMany({
      where: { username: { in: usernames } },
      include: { student: true }
    })

    const deleted = {
      enrolments: 0,
      submissions: 0,
      attendanceRecords: 0,
      payments: 0,
      invoices: 0,
      libraryAccounts: 0,
      gpaRecords: 0,
      riskScores: 0,
      campusCards: 0,
      campusCardTransactions: 0,
      applicants: 0
    }

    for (const user of users) {
      // Process student-related data if exists
      if (user.student) {
        // Step 1: Attendance records
        const { count: attendanceCount } = await prisma.attendanceRecord.deleteMany({
          where: { studentId: user.student.id }
        })
        deleted.attendanceRecords += attendanceCount

        // Step 2: Submissions
        const { count: submissionCount } = await prisma.submission.deleteMany({
          where: { studentId: user.student.id }
        })
        deleted.submissions += submissionCount

        // Step 3: Enrolments
        const enrolments = await prisma.enrolment.findMany({
          where: { studentId: user.student.id }
        })
        deleted.enrolments += enrolments.length

        // Reset seat counts for course offerings
        for (const enrolment of enrolments) {
          await prisma.courseOffering.updateMany({
            where: { id: enrolment.offeringId, seatsTaken: { gt: 0 } },
            data: { seatsTaken: { decrement: 1 } }
          })
        }

        await prisma.enrolment.deleteMany({ where: { studentId: user.student.id } })

        // Step 4: Invoices and payments
        const invoices = await prisma.feeInvoice.findMany({
          where: { studentId: user.student.id }
        })
        deleted.invoices += invoices.length

        for (const invoice of invoices) {
          // Delete payments for this invoice
          const { count: paymentCount } = await prisma.payment.deleteMany({
            where: { invoiceId: invoice.id }
          })
          deleted.payments += paymentCount

          // Delete invoice adjustments
          await prisma.invoiceAdjustment.deleteMany({ where: { invoiceId: invoice.id } })
        }

        // Delete invoices
        await prisma.feeInvoice.deleteMany({ where: { studentId: user.student.id } })

        // Step 5: Library account
        const { count: libraryCount } = await prisma.libraryAccount.deleteMany({
          where: { studentId: user.student.id }
        })
        deleted.libraryAccounts += libraryCount

        // Step 6: GPA and risk records
        const { count: gpaCount } = await prisma.studentGpaRecord.deleteMany({
          where: { studentId: user.student.id }
        })
        deleted.gpaRecords += gpaCount

        const { count: riskCount } = await prisma.studentRiskScore.deleteMany({
          where: { studentId: user.student.id }
        })
        deleted.riskScores += riskCount

        // Step 7: Campus card and transactions
        const campusCard = await prisma.campusCard.findUnique({
          where: { studentId: user.student.id }
        })

        if (campusCard) {
          const { count: transactionCount } = await prisma.campusCardTransaction.deleteMany({
            where: { cardId: campusCard.id }
          })
          deleted.campusCardTransactions += transactionCount

          await prisma.campusCard.delete({ where: { id: campusCard.id } })
          deleted.campusCards += 1
        }

        // Step 8: Delete student record (will not delete user)
        await prisma.student.delete({ where: { id: user.student.id } })
      }

      // Step 9: Delete applicant record if exists (regardless of student status)
      const { count: applicantCount } = await prisma.applicant.deleteMany({
        where: { userId: user.id }
      })
      deleted.applicants += applicantCount
    }

    // After reset, set up initial state for noor (admitted) and zara (no application)
    for (const user of users) {
      if (user.username === 'noor') {
        // Create applicant record for noor with admitted status
        const intake = await prisma.intake.findFirst({ orderBy: { id: 'desc' } })
        if (intake) {
          await prisma.applicant.create({
            data: {
              userId: user.id,
              applicationRef: `APP-${Date.now()}-NOOR`,
              fullName: 'Noor Ahmad',
              icPassport: '123456789',
              dateOfBirth: new Date('2000-01-01'),
              gender: 'male',
              nationality: 'Brunei Darussalam',
              email: user.email,
              mobile: '8888888',
              homeAddress: 'Bandar Seri Begawan, Brunei',
              highestQualification: 'High School',
              previousInstitution: 'Sultan Omar Ali Saifuddien College',
              yearOfCompletion: 2024,
              intakeId: intake.id,
              programmeId: intake.programmeId,
              modeOfStudy: 'full_time',
              scholarshipApplied: false,
              status: 'admitted',
              submittedAt: new Date(),
              decisionMadeAt: new Date(),
              accountCreated: true,
              accountCreatedAt: new Date()
            }
          })
        }
      }
      // zara remains with no application record
    }

    res.json({
      success: true,
      message: 'Student enrollment reset completed',
      deleted,
      resetUsers: users.map(u => u.username)
    })
  } catch (error: any) {
    console.error('Student enrollment reset failed:', error)
    res.status(500).json({
      success: false,
      message: 'Student enrollment reset failed',
      error: error.message,
    })
  }
})

export default router
