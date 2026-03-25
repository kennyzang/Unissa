import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/students/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.id }, { studentId: req.params.id }] },
    include: {
      user: { select: { displayName: true, email: true } },
      programme: { include: { department: true } },
      intake: { include: { semester: true } },
      libraryAccount: true,
    },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }
  res.json({ success: true, data: student })
})

// GET /api/v1/students/:id/timetable
router.get('/:id/timetable', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.id }, { studentId: req.params.id }] },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  const enrolments = await prisma.enrolment.findMany({
    where: { studentId: student.id, status: 'registered' },
    include: {
      offering: {
        include: {
          course: true,
          lecturer: { include: { user: { select: { displayName: true } } } },
        },
      },
    },
  })
  res.json({ success: true, data: enrolments.map(e => e.offering) })
})

// GET /api/v1/students/:id/transcript
router.get('/:id/transcript', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.id }, { studentId: req.params.id }] },
    include: { programme: true },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  const enrolments = await prisma.enrolment.findMany({
    where: { studentId: student.id, status: { in: ['completed', 'failed'] } },
    include: { offering: { include: { course: true, semester: true } } },
    orderBy: { registeredAt: 'asc' },
  })
  res.json({ success: true, data: { student, enrolments } })
})

// GET /api/v1/students/:id/campus-services
router.get('/:id/campus-services', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.id }, { studentId: req.params.id }] },
    include: { libraryAccount: true, user: { select: { email: true } } },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  res.json({
    success: true,
    data: {
      campusCardNo: student.campusCardNo,
      libraryAccountActive: student.libraryAccountActive,
      emailAccountActive: student.emailAccountActive,
      libraryAccount: student.libraryAccount,
    },
  })
})

// GET /api/v1/students/offerings  — list all available offerings for current semester
router.get('/offerings', async (_req: AuthRequest, res: Response) => {
  const activeSemester = await prisma.semester.findFirst({
    where: { isActive: true },
    orderBy: { startDate: 'desc' },
  })

  const offerings = await prisma.courseOffering.findMany({
    where: activeSemester ? { semesterId: activeSemester.id } : {},
    include: {
      course: {
        include: {
          prerequisites: {
            include: { prerequisite: { select: { id: true, code: true, name: true } } },
          },
        },
      },
      lecturer: { include: { user: { select: { displayName: true } } } },
      semester: { select: { id: true, name: true } },
    },
    orderBy: [{ course: { level: 'asc' } }, { dayOfWeek: 'asc' }],
  })

  res.json({ success: true, data: offerings })
})

// POST /api/v1/students/:id/register-courses
router.post('/:id/register-courses', async (req: AuthRequest, res: Response) => {
  const { offeringIds, semesterId } = req.body as { offeringIds: string[]; semesterId: string }

  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.id }, { studentId: req.params.id }] },
    include: { programme: true },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  // Validate offerings exist
  const offerings = await prisma.courseOffering.findMany({
    where: { id: { in: offeringIds } },
    include: {
      course: {
        include: {
          prerequisites: {
            include: { prerequisite: { select: { id: true, code: true, name: true } } },
          },
        },
      },
    },
  })
  if (offerings.length !== offeringIds.length) {
    res.status(400).json({ success: false, message: 'One or more course offerings not found' })
    return
  }

  // Prerequisite check
  const completedEnrolments = await prisma.enrolment.findMany({
    where: { studentId: student.id, status: 'completed' },
    include: { offering: { select: { courseId: true } } },
  })
  const completedCourseIds = new Set(completedEnrolments.map(e => e.offering.courseId))

  const prereqErrors: string[] = []
  for (const offering of offerings) {
    for (const prereq of offering.course.prerequisites) {
      if (!completedCourseIds.has(prereq.prerequisiteCourseId)) {
        prereqErrors.push(`${offering.course.code} requires ${prereq.prerequisite.code} (min grade: ${prereq.minGrade})`)
      }
    }
  }
  if (prereqErrors.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Prerequisite requirements not met',
      prereqErrors,
    })
    return
  }

  // Schedule conflict detection
  type ConflictInfo = { course1: string; course2: string; day: string; time: string }
  const conflicts: ConflictInfo[] = []
  for (let i = 0; i < offerings.length; i++) {
    for (let j = i + 1; j < offerings.length; j++) {
      const a = offerings[i]
      const b = offerings[j]
      if (a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && a.endTime > b.startTime) {
        conflicts.push({
          course1: a.course.code,
          course2: b.course.code,
          day: a.dayOfWeek,
          time: `${a.startTime}–${a.endTime}`,
        })
      }
    }
  }
  if (conflicts.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Schedule conflicts detected between selected courses',
      conflicts,
    })
    return
  }

  // CH validation
  const totalCH = offerings.reduce((sum, o) => sum + o.course.creditHours, 0)
  const maxCH = student.currentCgpa >= 3.5 ? 21 : student.studentType === 'probation' ? 6 : 18
  const minCH = student.studentType === 'probation' ? 3 : 12

  if (totalCH < minCH || totalCH > maxCH) {
    res.status(400).json({
      success: false,
      message: `Credit hours must be between ${minCH} and ${maxCH}. Selected: ${totalCH} CH.`,
    })
    return
  }

  // Create enrolments + cascade
  const enrolments = await Promise.all(
    offeringIds.map(offeringId =>
      prisma.enrolment.upsert({
        where: { studentId_offeringId: { studentId: student.id, offeringId } },
        create: { studentId: student.id, offeringId, semesterId, registeredAt: new Date() },
        update: { status: 'registered' },
      })
    )
  )

  // Generate campus card if not exists
  const year = new Date().getFullYear()
  const campusCard = student.campusCardNo ?? `CC-${year}${student.studentId.slice(-3).padStart(3, '0')}`

  // Auto-generate fee invoice
  const feePerCh = student.nationality === 'Brunei Darussalam'
    ? (student.programme as any).feeLocalPerCh
    : (student.programme as any).feeInternationalPerCh

  const tuitionFee = totalCH * (feePerCh ?? 800)
  const scholarshipDeduction = (tuitionFee * student.scholarshipPct) / 100
  const total = tuitionFee + 50 + 0 - scholarshipDeduction

  const invoiceNo = `INV-${year}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const invoice = await prisma.feeInvoice.upsert({
    where: { invoiceNo },
    create: {
      invoiceNo,
      studentId: student.id,
      semesterId,
      tuitionFee,
      libraryFee: 50,
      scholarshipDeduction,
      totalAmount: total,
      outstandingBalance: total,
      dueDate,
    },
    update: {},
  })

  // Activate campus services
  await prisma.student.update({
    where: { id: student.id },
    data: {
      campusCardNo: campusCard,
      libraryAccountActive: true,
      emailAccountActive: true,
    },
  })

  // Create/activate library account
  await prisma.libraryAccount.upsert({
    where: { studentId: student.id },
    create: {
      studentId: student.id,
      accountNo: `LIB-${student.studentId}`,
      isActive: true,
      activatedAt: new Date(),
    },
    update: { isActive: true, activatedAt: new Date() },
  })

  res.json({
    success: true,
    data: { enrolments, invoice, campusCardNo: campusCard, totalCH },
    message: `Successfully registered ${offeringIds.length} courses (${totalCH} CH). Invoice generated.`,
  })
})

export default router
