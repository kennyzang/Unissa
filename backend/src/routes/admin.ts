import { Router, type IRouter, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { execSync } from 'child_process'
import { join } from 'path'

const router: IRouter = Router()
router.use(authenticate)
router.use(requireRole('admin'))

// GET /api/v1/admin/departments
router.get('/departments', async (_req: AuthRequest, res: Response) => {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  })
  res.json({ success: true, data: departments })
})

// GET /api/v1/admin/courses
router.get('/courses', async (_req: AuthRequest, res: Response) => {
  const courses = await prisma.course.findMany({
    include: {
      _count: { select: { offerings: true } },
      offerings: {
        select: {
          _count: { select: { enrolments: true } },
        },
      },
    },
    orderBy: { code: 'asc' },
  })

  const data = courses.map(({ offerings, ...c }) => ({
    ...c,
    totalEnrolled: offerings.reduce((sum, o) => sum + o._count.enrolments, 0),
  }))

  res.json({ success: true, data })
})

// POST /api/v1/admin/courses
router.post('/courses', async (req: AuthRequest, res: Response) => {
  const { code, name, departmentId, creditHours, level, isOpenToInternational, maxSeats } = req.body as {
    code: string; name: string; departmentId: string
    creditHours: number; level: number; isOpenToInternational: boolean; maxSeats: number
  }

  if (!code || !name || !departmentId || !creditHours || !level || !maxSeats) {
    res.status(400).json({ success: false, message: 'Missing required fields' })
    return
  }

  const existing = await prisma.course.findUnique({ where: { code } })
  if (existing) {
    res.status(409).json({ success: false, message: `Course code "${code}" already exists` })
    return
  }

  const course = await prisma.course.create({
    data: {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      departmentId,
      creditHours: Number(creditHours),
      level: Number(level),
      isOpenToInternational: Boolean(isOpenToInternational),
      maxSeats: Number(maxSeats),
    },
    include: { _count: { select: { offerings: true } } },
  })

  res.status(201).json({ success: true, data: course, message: 'Course created successfully' })
})

// PUT /api/v1/admin/courses/:id
router.put('/courses/:id', async (req: AuthRequest, res: Response) => {
  const { name, departmentId, creditHours, level, isOpenToInternational, maxSeats } = req.body as {
    name: string; departmentId: string
    creditHours: number; level: number; isOpenToInternational: boolean; maxSeats: number
  }

  const course = await prisma.course.update({
    where: { id: req.params.id as string },
    data: {
      name: name.trim(),
      departmentId,
      creditHours: Number(creditHours),
      level: Number(level),
      isOpenToInternational: Boolean(isOpenToInternational),
      maxSeats: Number(maxSeats),
    },
    include: { _count: { select: { offerings: true } } },
  })

  res.json({ success: true, data: course, message: 'Course updated successfully' })
})

// GET /api/v1/admin/courses/:id/enrolments  — list all active enrolments grouped by offering
router.get('/courses/:id/enrolments', async (req: AuthRequest, res: Response) => {
  const offerings = await prisma.courseOffering.findMany({
    where: { courseId: req.params.id as string },
    include: {
      semester: { select: { name: true } },
      lecturer: { include: { user: { select: { displayName: true } } } },
      enrolments: {
        where: { status: 'registered' },
        include: {
          student: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: { registeredAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  res.json({ success: true, data: offerings })
})

// DELETE /api/v1/admin/enrolments/:enrolmentId  — drop a student and free up the seat
router.delete('/enrolments/:enrolmentId', async (req: AuthRequest, res: Response) => {
  const enrolment = await prisma.enrolment.findUnique({
    where: { id: req.params.enrolmentId as string },
  })
  if (!enrolment) {
    res.status(404).json({ success: false, message: 'Enrolment not found' })
    return
  }

  await prisma.$transaction([
    prisma.enrolment.delete({ where: { id: enrolment.id } }),
    // Only decrement when > 0 to prevent negative values
    prisma.courseOffering.updateMany({
      where: { id: enrolment.offeringId, seatsTaken: { gt: 0 } },
      data: { seatsTaken: { decrement: 1 } },
    }),
  ])

  res.json({ success: true, message: 'Student removed and seat released' })
})

// POST /api/v1/admin/demo-reset  — full lifecycle wipe for a clean re-demo
router.post('/demo-reset', async (_req: AuthRequest, res: Response) => {
  // ── 1. Attendance (records before sessions — FK dependency) ──────────────
  await prisma.attendanceRecord.deleteMany({})
  await prisma.attendanceSession.deleteMany({})

  // ── 2. Academic activity ─────────────────────────────────────────────────
  await prisma.submission.deleteMany({})

  // ── 3. Finance ───────────────────────────────────────────────────────────
  await prisma.payment.deleteMany({})
  await prisma.feeInvoice.deleteMany({})

  // ── 4. Enrolments & seat counters ────────────────────────────────────────
  await prisma.enrolment.deleteMany({})
  await prisma.courseOffering.updateMany({ data: { seatsTaken: 0 } })

  // ── 5. Campus services / library (delete before students) ───────────────
  await prisma.libraryAccount.deleteMany({})

  // ── 6. Student GPA & risk scores (FK children of Student) ───────────────
  await prisma.studentGpaRecord.deleteMany({})
  await prisma.studentRiskScore.deleteMany({})

  // ── 7. Student records (after all FK children are gone) ─────────────────
  await prisma.student.deleteMany({})

  // ── 8. Applicant records + cascade (subject grades, documents) ──────────
  // Student user accounts are KEPT so demo accounts (e.g. noor) can log in again
  await prisma.applicant.deleteMany({})

  // ── 9. HR leave requests ─────────────────────────────────────────────────
  await prisma.leaveRequest.deleteMany({})

  // ── 10. Chatbot history ──────────────────────────────────────────────────
  await prisma.chatbotConversation.deleteMany({})

  // ── 11. Admission notifications ──────────────────────────────────────────
  await prisma.notification.deleteMany({
    where: { triggeredByEvent: { in: ['admission_accepted', 'admission_rejected', 'admission_waitlisted'] } },
  })

  res.json({ success: true, message: 'System reset complete: all student lifecycle data cleared, ready for re-demo' })
})

// DELETE /api/v1/admin/courses/:id
router.delete('/courses/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const offeringsCount = await prisma.courseOffering.count({ where: { courseId: id } })
  if (offeringsCount > 0) {
    res.status(409).json({
      success: false,
      message: `Cannot delete: course has ${offeringsCount} active offering(s)`,
    })
    return
  }

  await prisma.course.delete({ where: { id } })
  res.json({ success: true, message: 'Course deleted successfully' })
})

// POST /api/v1/admin/init-db — full database initialization
router.post('/init-db', async (_req: AuthRequest, res: Response) => {
  try {
    console.log('开始初始化数据库...')
    
    // 获取 backend 目录的绝对路径
    const backendDir = join(__dirname, '..', '..')
    
    // 执行数据库重置和种子数据填充
    execSync('npx prisma migrate reset --force && npx tsx prisma/seed.ts', {
      cwd: backendDir,
      stdio: 'inherit'
    })
    
    res.status(200).json({ 
      success: true, 
      message: '数据库初始化完成！' 
    })
  } catch (error: any) {
    console.error('数据库初始化失败:', error)
    res.status(500).json({ 
      success: false, 
      message: '数据库初始化失败',
      error: error.message 
    })
  }
})

export default router
