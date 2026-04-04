import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { emailService } from '../services/emailService'

const router = Router()
router.use(authenticate)

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

// GET /api/v1/students/me — current logged-in student's own profile
router.get('/me', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { userId: req.user!.userId },
    include: {
      user:    { select: { displayName: true, email: true, username: true } },
      programme: { include: { department: true } },
      intake:  { include: { semester: true } },
      libraryAccount: true,
    },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student profile not found' }); return }
  res.json({ success: true, data: student })
})

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

// GET /api/v1/students/:id/gpa-records
router.get('/:id/gpa-records', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.id }, { studentId: req.params.id }] },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  const gpaRecords = await prisma.studentGpaRecord.findMany({
    where: { studentId: student.id },
    include: { semester: { select: { id: true, name: true } } },
    orderBy: { semester: { startDate: 'asc' } },
  })
  res.json({ success: true, data: gpaRecords })
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

// POST /api/v1/students/:id/register-courses
router.post('/:id/register-courses', async (req: AuthRequest, res: Response) => {
  const { offeringIds, semesterId } = req.body as { offeringIds: string[]; semesterId: string }

  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.id }, { studentId: req.params.id }, { userId: req.params.id }] },
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
  const completedCourseIds = new Set((completedEnrolments ?? []).map(e => e.offering.courseId))
  const registeringCourseIds = new Set(offerings.map(o => o.courseId))

  const prereqErrors: string[] = []
  for (const offering of offerings) {
    for (const prereq of offering.course.prerequisites) {
      const prereqCourseId = (prereq as any).courseId ?? prereq.prerequisiteCourseId
      if (!completedCourseIds.has(prereqCourseId) && !registeringCourseIds.has(prereqCourseId)) {
        const prereqCode = prereq.prerequisite?.code ?? prereqCourseId
        prereqErrors.push(`${offering.course.code} requires ${prereqCode} (min grade: ${prereq.minGrade})`)
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

  // CH validation — include already-registered enrolments so a student can re-add
  // a single course dropped by admin without failing the minimum-CH check
  const existingEnrolments = await prisma.enrolment.findMany({
    where: { studentId: student.id, status: 'registered', offeringId: { notIn: offeringIds } },
    include: { offering: { include: { course: { select: { creditHours: true } } } } },
  })
  const existingCH = (existingEnrolments ?? []).reduce((sum, e) => sum + e.offering.course.creditHours, 0)
  const newCH = offerings.reduce((sum, o) => sum + o.course.creditHours, 0)
  const totalCH = newCH + existingCH
  const maxCH = student.studentType === 'probation' ? 6 : 18
  const minCH = student.studentType === 'probation' ? 3 : 6

  if (totalCH < minCH || totalCH > maxCH) {
    res.status(400).json({
      success: false,
      message: `Credit hours must be between ${minCH} and ${maxCH}. Total: ${totalCH} CH.`,
    })
    return
  }

  // Create enrolments + cascade
  const enrolments = await Promise.all(
    offeringIds.map(offeringId =>
      prisma.enrolment.upsert({
        where: { studentId_offeringId: { studentId: student.id, offeringId } },
        create: { studentId: student.id, offeringId, semesterId, status: 'registered', registeredAt: new Date() },
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

  const tuitionFee = newCH * (feePerCh ?? 800)
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
    data: { enrolments, invoice, campusCardNo: campusCard, totalCH: newCH },
    message: `Successfully registered ${offeringIds.length} courses (${newCH} CH). Invoice generated.`,
  })
})

// DELETE /api/v1/students/:id/courses/:offeringId  — drop a course
router.delete('/:id/courses/:offeringId', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.id }, { studentId: req.params.id }] },
    include: { programme: true, user: true },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  const enrolment = await prisma.enrolment.findFirst({
    where: { studentId: student.id, offeringId: req.params.offeringId, status: 'registered' },
    include: { offering: { include: { course: true, semester: true } } },
  })
  if (!enrolment) { res.status(404).json({ success: false, message: 'Enrolment not found' }); return }

  const offering = enrolment.offering
  const creditHours = offering.course.creditHours || 3

  const feePerCh = student.nationality === 'Brunei Darussalam'
    ? (student.programme as any).feeLocalPerCh || 800
    : (student.programme as any).feeInternationalPerCh || 1200

  const refundAmount = creditHours * feePerCh

  const invoice = await prisma.feeInvoice.findFirst({
    where: { studentId: student.id, semesterId: offering.semesterId },
    orderBy: { generatedAt: 'desc' },
  })

  const result = await prisma.$transaction(async (tx) => {
    await tx.enrolment.delete({ where: { id: enrolment.id } })

    if (invoice) {
      const previousAmount = invoice.totalAmount
      const previousStatus = invoice.status
      const newAmount = Math.max(0, invoice.totalAmount - refundAmount)
      const newOutstanding = Math.max(0, invoice.outstandingBalance - refundAmount)
      
      let newStatus = invoice.status
      if (newOutstanding <= 0) {
        newStatus = 'paid'
      } else if (newOutstanding < invoice.totalAmount) {
        newStatus = 'partial'
      }

      await tx.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          tuitionFee: Math.max(0, invoice.tuitionFee - refundAmount),
          totalAmount: newAmount,
          outstandingBalance: newOutstanding,
          status: newStatus,
        },
      })

      await tx.invoiceAdjustment.create({
        data: {
          invoiceId: invoice.id,
          adjustmentType: 'refund',
          amount: refundAmount,
          reason: `Course drop: ${offering.course.code} - ${offering.course.name}`,
          previousAmount,
          newAmount,
          previousStatus,
          newStatus,
          operatedBy: req.user?.userId || 'system',
        },
      })
    }

    return { enrolment, invoice, refundAmount }
  })

  if (result.invoice && result.refundAmount > 0 && student.user?.email) {
    try {
      if (emailService.isConfigured()) {
        await emailService.sendEmail({
          to: student.user.email,
          subject: `Course Drop Confirmation - ${offering.course.code}`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #165DFF;">Course Drop Confirmation</h2>
              <p>Dear ${student.user.displayName || 'Student'},</p>
              <p>You have successfully dropped the following course:</p>
              <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0;"><strong>Course:</strong> ${offering.course.code} - ${offering.course.name}</p>
                <p style="margin: 10px 0 0 0;"><strong>Credit Hours:</strong> ${creditHours}</p>
                <p style="margin: 10px 0 0 0;"><strong>Refund Amount:</strong> BND ${refundAmount.toLocaleString()}</p>
              </div>
              <p>Your invoice has been updated accordingly.</p>
              <hr style="border: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">
                UNISSA - Universiti Islam Sultan Sharif Ali<br>
                Finance Department
              </p>
            </div>
          `,
        })
      }
    } catch (err) {
      console.error('[Students] Failed to send drop confirmation email:', err)
    }
  }

  res.json({ 
    success: true, 
    message: 'Course dropped successfully',
    data: {
      refundAmount,
      invoiceUpdated: !!result.invoice,
    },
  })
})

export default router
