import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router: Router = Router()

// GET /api/v1/admissions/intakes  (public for apply form)
router.get('/intakes', authenticate, async (_req: AuthRequest, res: Response) => {
  const intakes = await prisma.intake.findMany({
    where: { isOpen: true },
    include: { programme: { include: { department: true } }, semester: true },
    orderBy: { intakeStart: 'asc' },
  })
  res.json({ success: true, data: intakes })
})

// GET /api/v1/admissions/applications
router.get('/applications', authenticate, requireRole('admissions', 'admin'), async (_req: AuthRequest, res: Response) => {
  const apps = await prisma.applicant.findMany({
    include: { intake: { include: { semester: true } }, programme: { include: { department: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ success: true, data: apps })
})

// GET /api/v1/admissions/applications/:id
router.get('/applications/:id', authenticate, requireRole('admissions', 'admin'), async (req: AuthRequest, res: Response) => {
  const app = await prisma.applicant.findUnique({
    where: { id: String(req.params.id) },
    include: {
      intake: { include: { semester: true } },
      programme: { include: { department: true } },
      subjectGrades: true,
      student: { include: { user: { select: { username: true, email: true } } } },
    },
  })
  if (!app) { res.status(404).json({ success: false, message: 'Application not found' }); return }
  res.json({ success: true, data: app })
})

// GET /api/v1/admissions/my-application  — current user's own application status
router.get('/my-application', authenticate, async (req: AuthRequest, res: Response) => {
  const app = await prisma.applicant.findFirst({
    where: { userId: req.user!.userId },
    include: {
      intake: { include: { semester: true } },
      programme: true,
      subjectGrades: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!app) { res.status(404).json({ success: false, message: 'No application found' }); return }
  res.json({ success: true, data: app })
})

// POST /api/v1/admissions/apply
router.post('/apply', authenticate, async (req: AuthRequest, res: Response) => {
  const {
    fullName, icPassport, dateOfBirth, gender, nationality, email, mobile,
    homeAddress, highestQualification, previousInstitution, yearOfCompletion,
    cgpa, intakeId, programmeId, modeOfStudy, scholarshipApplied, scholarshipType,
    subjectGrades,
  } = req.body

  const currentUserId = req.user!.userId

  // Block re-application only if the user already has an active student record
  const existingStudent = await prisma.student.findFirst({ where: { userId: currentUserId } })
  if (existingStudent) {
    res.status(400).json({
      success: false,
      message: 'You are already enrolled as a student. Please contact the Admissions Office if you need assistance.',
    })
    return
  }

  const year = new Date().getFullYear()
  const seq  = String(Math.floor(Math.random() * 9000) + 1000)
  const newRef = `APP-${year}-${seq}`

  const applicant = await prisma.applicant.upsert({
    where: { userId: currentUserId },
    create: {
      applicationRef: newRef,
      userId: currentUserId,
      fullName, icPassport,
      dateOfBirth: new Date(dateOfBirth),
      gender, nationality, email, mobile, homeAddress,
      highestQualification, previousInstitution,
      yearOfCompletion: Number(yearOfCompletion),
      cgpa: cgpa ? Number(cgpa) : null,
      intakeId, programmeId, modeOfStudy,
      scholarshipApplied: Boolean(scholarshipApplied),
      scholarshipType: scholarshipApplied ? scholarshipType : null,
      status: 'submitted',
      submittedAt: new Date(),
    },
    update: {
      status: 'submitted',
      submittedAt: new Date(),
      fullName, icPassport, gender, nationality, dateOfBirth: new Date(dateOfBirth),
      email, mobile, homeAddress,
      highestQualification, previousInstitution,
      yearOfCompletion: Number(yearOfCompletion),
      cgpa: cgpa ? Number(cgpa) : null,
      intakeId, programmeId, modeOfStudy,
      scholarshipApplied: Boolean(scholarshipApplied),
      scholarshipType: scholarshipApplied ? scholarshipType : null,
    },
  })

  // Upsert subject grades
  if (Array.isArray(subjectGrades) && subjectGrades.length > 0) {
    await prisma.applicantSubjectGrade.deleteMany({ where: { applicantId: applicant.id } })
    for (const g of subjectGrades) {
      await prisma.applicantSubjectGrade.create({
        data: {
          applicantId: applicant.id,
          subjectName: g.subjectName,
          grade: g.grade,
          qualificationType: g.qualificationType ?? highestQualification,
        },
      })
    }
  }

  // ── Auto-qualification check ────────────────────────────────
  const qualOrder = ['O_LEVEL', 'A_LEVEL', 'DIPLOMA', 'DEGREE', 'MASTERS']
  const qualIdx = qualOrder.indexOf((String(highestQualification)).toUpperCase())
  const completionYear = Number(yearOfCompletion)
  const currentYear = new Date().getFullYear()
  const autoCheckPassed = qualIdx >= 0 && (currentYear - completionYear) <= 10
  const autoStatus = autoCheckPassed ? 'under_review' : 'auto_check_failed'

  const finalApplicant = await prisma.applicant.update({
    where: { id: applicant.id },
    data: {
      status: autoStatus,
      eligibilityCheckResult: autoCheckPassed ? 'eligible' : 'ineligible',
    },
  })

  res.json({
    success: true,
    data: finalApplicant,
    message: `Application submitted. Reference: ${applicant.applicationRef}`,
    autoCheckPassed,
  })
})

// PATCH /api/v1/admissions/applications/:id/decision
router.patch('/applications/:id/decision', authenticate, requireRole('admissions', 'admin'), async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body as { action: 'accepted' | 'rejected' | 'waitlisted'; remarks?: string }

  const app = await prisma.applicant.findUnique({
    where: { id: String(req.params.id) },
    include: { intake: { include: { semester: true } }, programme: true, student: true },
  })
  if (!app) { res.status(404).json({ success: false, message: 'Application not found' }); return }

  // Update applicant status
  const updated = await prisma.applicant.update({
    where: { id: String(req.params.id) },
    data: {
      status: action,
      officerRemarks: remarks,
      decisionMadeAt: new Date(),
    },
  })

  // ── Create in-app notification for the applicant ────────────
  if (app.userId) {
    const notifBody = action === 'accepted'
      ? 'Congratulations, you have been admitted to UNISSA! Please log in to accept your offer and complete enrolment.'
      : action === 'rejected'
        ? `Sorry, you have not been admitted.${remarks ? ' Reason: ' + remarks : ''}`
        : 'Your application has been waitlisted. You will be notified if a place becomes available.'

    await prisma.notification.create({
      data: {
        userId: app.userId,
        type: 'push',
        subject: 'Admission Result',
        body: notifBody,
        status: 'sent',
        sentAt: new Date(),
        triggeredByEvent: `admission_${action}`,
        isRead: false,
      },
    }).catch(err => console.error('[Admissions] Failed to create notification:', err))
  }

  res.json({
    success: true,
    data: { application: updated },
    message: action === 'accepted'
      ? 'Application accepted. Student has been notified to accept the offer.'
      : `Application ${action} successfully.`,
  })
})

// POST /api/v1/admissions/accept-offer  — student formally accepts their admission offer
router.post('/accept-offer', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId

  // Find the accepted application for this user
  const app = await prisma.applicant.findFirst({
    where: { userId, status: 'accepted' },
    include: { programme: true, intake: { include: { semester: true } } },
  })
  if (!app) {
    res.status(400).json({ success: false, message: 'No accepted offer found for your account.' })
    return
  }

  // If student record already exists, return it (idempotent)
  const existing = await prisma.student.findFirst({
    where: { applicantId: app.id },
    include: { programme: true, intake: { include: { semester: true } } },
  })
  if (existing) {
    res.json({ success: true, data: existing, message: 'Already enrolled.' })
    return
  }

  // Generate student ID
  const year = new Date().getFullYear()
  const count = await prisma.student.count()
  const studentId = `${year}${String(count + 1).padStart(3, '0')}`

  // Create student record
  const student = await prisma.student.create({
    data: {
      studentId,
      userId,
      applicantId: app.id,
      programmeId: app.programmeId,
      intakeId: app.intakeId,
      modeOfStudy: app.modeOfStudy,
      nationality: app.nationality,
      scholarshipPct: app.scholarshipApplied ? 25 : 0,
      status: 'active',
      enrolledAt: new Date(),
    },
    include: {
      programme: true,
      intake: { include: { semester: true } },
    },
  })

  // Mark admission notifications as read
  await prisma.notification.updateMany({
    where: { userId, triggeredByEvent: { in: ['admission_accepted', 'admission_rejected', 'admission_waitlisted'] }, isRead: false },
    data: { isRead: true },
  })

  res.json({
    success: true,
    data: student,
    message: `Welcome to UNISSA! Your student ID is ${studentId}.`,
  })
})

// GET /api/v1/admissions/stats
router.get('/stats', authenticate, requireRole('admissions', 'admin', 'manager'), async (_req: AuthRequest, res: Response) => {
  const [total, submitted, underReview, accepted, rejected, waitlisted] = await Promise.all([
    prisma.applicant.count(),
    prisma.applicant.count({ where: { status: 'submitted' } }),
    prisma.applicant.count({ where: { status: 'under_review' } }),
    prisma.applicant.count({ where: { status: 'accepted' } }),
    prisma.applicant.count({ where: { status: 'rejected' } }),
    prisma.applicant.count({ where: { status: 'waitlisted' } }),
  ])
  res.json({ success: true, data: { total, submitted, underReview, accepted, rejected, waitlisted } })
})

export default router
