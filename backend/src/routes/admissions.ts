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
    where: { userId: req.user?.userId ?? null },
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

  // Input validation
  const missing = (['fullName', 'icPassport', 'dateOfBirth', 'gender', 'intakeId', 'programmeId', 'modeOfStudy'] as const)
    .filter(f => !req.body[f])
  if (missing.length > 0) {
    res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` })
    return
  }
  if (isNaN(Date.parse(dateOfBirth))) {
    res.status(400).json({ success: false, message: 'Invalid dateOfBirth format' })
    return
  }
  const cgpaNum = cgpa !== undefined && cgpa !== null && cgpa !== '' ? Number(cgpa) : null
  if (cgpaNum !== null && (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 4)) {
    res.status(400).json({ success: false, message: 'CGPA must be between 0 and 4' })
    return
  }

  // Validate intake is open
  const intake = await prisma.intake.findFirst({ where: { id: intakeId } })
  if (intake && !intake.isOpen) {
    res.status(400).json({ success: false, message: 'This intake is closed and no longer accepting applications.' })
    return
  }

  // Check for duplicate icPassport from another user
  const existingByIc = await prisma.applicant.findFirst({ where: { icPassport } })
  if (existingByIc && existingByIc.userId !== (req.user?.userId ?? null)) {
    res.status(400).json({ success: false, message: 'An application with this IC/Passport number already exists.' })
    return
  }

  const currentUserId = req.user?.userId ?? null
  const year = new Date().getFullYear()
  const seq  = String(Math.floor(Math.random() * 9000) + 1000)
  const newRef = `APP-${year}-${seq}`

  // Auto-qualification check
  const qualOrder = ['O_LEVEL', 'A_LEVEL', 'DIPLOMA', 'DEGREE', 'MASTERS',
                     'o_level', 'a_level', 'diploma', 'degree', 'masters']
  const qualIdx = qualOrder.indexOf(String(highestQualification))
  const completionYear = Number(yearOfCompletion)
  const currentYear = new Date().getFullYear()
  const autoCheckPassed = qualIdx >= 0 && (!yearOfCompletion || (currentYear - completionYear) <= 10)
  const autoStatus = autoCheckPassed ? 'under_review' : 'auto_check_failed'

  let applicant
  if (existingByIc) {
    // Re-submission by the same user
    applicant = await prisma.applicant.update({
      where: { id: existingByIc.id },
      data: {
        status: autoStatus,
        submittedAt: new Date(),
        fullName, icPassport, gender,
        nationality: nationality ?? 'Brunei Darussalam',
        dateOfBirth: new Date(dateOfBirth),
        email, mobile, homeAddress,
        highestQualification, previousInstitution,
        yearOfCompletion: yearOfCompletion ? Number(yearOfCompletion) : 0,
        cgpa: cgpaNum,
        intakeId, programmeId, modeOfStudy,
        scholarshipApplied: Boolean(scholarshipApplied),
        scholarshipType: scholarshipApplied ? scholarshipType : null,
        eligibilityCheckResult: autoCheckPassed ? 'eligible' : 'ineligible',
      },
    })
  } else {
    applicant = await prisma.applicant.create({
      data: {
        applicationRef: newRef,
        userId: currentUserId,
        fullName, icPassport,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        nationality: nationality ?? 'Brunei Darussalam',
        email: email ?? '', mobile: mobile ?? '', homeAddress: homeAddress ?? '',
        highestQualification, previousInstitution,
        yearOfCompletion: yearOfCompletion ? Number(yearOfCompletion) : 0,
        cgpa: cgpaNum,
        intakeId, programmeId, modeOfStudy,
        scholarshipApplied: Boolean(scholarshipApplied),
        scholarshipType: scholarshipApplied ? scholarshipType : null,
        status: autoStatus,
        eligibilityCheckResult: autoCheckPassed ? 'eligible' : 'ineligible',
        submittedAt: new Date(),
      },
    })
  }

  // Upsert subject grades
  if (Array.isArray(subjectGrades) && subjectGrades.length > 0) {
    await prisma.applicantSubjectGrade.deleteMany({ where: { applicantId: applicant.id } })
    for (const g of subjectGrades) {
      await prisma.applicantSubjectGrade.create({
        data: {
          applicantId: applicant.id,
          subjectName: String(g.subjectName ?? '').slice(0, 100),
          grade: String(g.grade ?? '').slice(0, 10),
          qualificationType: g.qualificationType ?? highestQualification,
        },
      })
    }
  }

  res.status(201).json({
    success: true,
    data: applicant,
    message: `Application submitted. Reference: ${applicant.applicationRef}`,
    autoCheckPassed,
  })
})

// PATCH /api/v1/admissions/applications/:id/decision
router.patch('/applications/:id/decision', authenticate, requireRole('admissions', 'admin'), async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body as { action: 'accepted' | 'rejected' | 'waitlisted'; remarks?: string }

  if (!['accepted', 'rejected', 'waitlisted'].includes(action)) {
    res.status(400).json({ success: false, message: "action must be 'accepted', 'rejected', or 'waitlisted'" })
    return
  }

  const app = await prisma.applicant.findUnique({
    where: { id: String(req.params.id) },
    include: { intake: { include: { semester: true } }, programme: true, student: true },
  })
  if (!app) { res.status(404).json({ success: false, message: 'Application not found' }); return }

  // Update applicant status
  const previousStatus = app.status
  const updated = await prisma.applicant.update({
    where: { id: String(req.params.id) },
    data: {
      status: action,
      officerRemarks: remarks,
      decisionMadeAt: new Date(),
    },
  })

  // Record history
  await prisma.applicantHistory.create({
    data: {
      applicantId: app.id,
      previousStatus,
      newStatus: action,
      reason: remarks,
      changedBy: req.user?.userId,
    },
  })

  // ── Create in-app notification for the applicant ────────────
  if (app.userId) {
    const applicantName = app.fullName || 'Applicant'
    const applicationRef = app.applicationRef || 'N/A'
    
    const notifBody = action === 'accepted'
      ? `Congratulations ${applicantName}, you have been admitted to UNISSA! Please log in to accept your offer and complete enrolment. Application Ref: ${applicationRef}`
      : action === 'rejected'
        ? `Sorry ${applicantName}, you have not been admitted.${remarks ? ' Reason: ' + remarks : ''} Application Ref: ${applicationRef}`
        : `Hello ${applicantName}, your application has been waitlisted. You will be notified if a place becomes available. Application Ref: ${applicationRef}`

    await prisma.notification.create({
      data: {
        userId: app.userId,
        type: 'push',
        subject: `Admission Result - ${applicantName} (${applicationRef})`,
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

  // Generate student ID (use transaction to prevent race condition on count)
  const student = await prisma.$transaction(async (tx) => {
    const year = new Date().getFullYear()
    const count = await tx.student.count()
    const studentId = `${year}${String(count + 1).padStart(3, '0')}`
    return tx.student.create({
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
  })

  // Mark admission notifications as read
  await prisma.notification.updateMany({
    where: { userId, triggeredByEvent: { in: ['admission_accepted', 'admission_rejected', 'admission_waitlisted'] }, isRead: false },
    data: { isRead: true },
  })

  res.json({
    success: true,
    data: student,
    message: `Welcome to UNISSA! Your student ID is ${student.studentId}.`,
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

// PATCH /api/v1/admissions/:id/resubmit — resubmit a rejected application
router.patch('/:id/resubmit', authenticate, async (req: AuthRequest, res: Response) => {
  const {
    fullName, icPassport, dateOfBirth, gender, nationality, email, mobile,
    homeAddress, highestQualification, previousInstitution, yearOfCompletion,
    cgpa, intakeId, programmeId, modeOfStudy, scholarshipApplied, scholarshipType,
    subjectGrades,
  } = req.body

  const app = await prisma.applicant.findUnique({
    where: { id: String(req.params.id) },
    include: { subjectGrades: true },
  })

  if (!app) {
    res.status(404).json({ success: false, message: 'Application not found' })
    return
  }

  if (app.userId !== req.user?.userId) {
    res.status(403).json({ success: false, message: 'You can only resubmit your own application' })
    return
  }

  if (app.status !== 'rejected') {
    res.status(400).json({ success: false, message: 'Only rejected applications can be resubmitted' })
    return
  }

  const cgpaNum = cgpa !== undefined && cgpa !== null && cgpa !== '' ? Number(cgpa) : null
  if (cgpaNum !== null && (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 4)) {
    res.status(400).json({ success: false, message: 'CGPA must be between 0 and 4' })
    return
  }

  const previousStatus = app.status
  const updated = await prisma.applicant.update({
    where: { id: String(req.params.id) },
    data: {
      fullName: fullName ?? app.fullName,
      icPassport: icPassport ?? app.icPassport,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : app.dateOfBirth,
      gender: gender ?? app.gender,
      nationality: nationality ?? app.nationality,
      email: email ?? app.email,
      mobile: mobile ?? app.mobile,
      homeAddress: homeAddress ?? app.homeAddress,
      highestQualification: highestQualification ?? app.highestQualification,
      previousInstitution: previousInstitution ?? app.previousInstitution,
      yearOfCompletion: yearOfCompletion ? Number(yearOfCompletion) : app.yearOfCompletion,
      cgpa: cgpaNum,
      intakeId: intakeId ?? app.intakeId,
      programmeId: programmeId ?? app.programmeId,
      modeOfStudy: modeOfStudy ?? app.modeOfStudy,
      scholarshipApplied: scholarshipApplied !== undefined ? Boolean(scholarshipApplied) : app.scholarshipApplied,
      scholarshipType: scholarshipApplied ? (scholarshipType ?? app.scholarshipType) : null,
      status: 'under_review',
      submittedAt: new Date(),
      officerRemarks: null,
      decisionMadeAt: null,
    },
  })

  await prisma.applicantHistory.create({
    data: {
      applicantId: app.id,
      previousStatus,
      newStatus: 'under_review',
      reason: 'Application resubmitted after rejection',
      changedBy: req.user?.userId,
    },
  })

  if (Array.isArray(subjectGrades) && subjectGrades.length > 0) {
    await prisma.applicantSubjectGrade.deleteMany({ where: { applicantId: app.id } })
    for (const g of subjectGrades) {
      await prisma.applicantSubjectGrade.create({
        data: {
          applicantId: app.id,
          subjectName: String(g.subjectName ?? '').slice(0, 100),
          grade: String(g.grade ?? '').slice(0, 10),
          qualificationType: g.qualificationType ?? updated.highestQualification,
        },
      })
    }
  }

  res.status(200).json({
    success: true,
    data: updated,
    message: 'Application resubmitted successfully. Reference: ' + updated.applicationRef,
  })
})

// PATCH /api/v1/admissions/:id/status — simplified status update (test-compatible alias)
router.patch('/:id/status', authenticate, requireRole('admissions', 'admin'), async (req: AuthRequest, res: Response) => {
  const { status } = req.body
  if (!['accepted', 'rejected', 'waitlisted', 'under_review', 'submitted'].includes(status)) {
    res.status(400).json({ success: false, message: 'Invalid status value' })
    return
  }
  const app = await prisma.applicant.findFirst({ where: { id: String(req.params.id) } })
  if (!app) { res.status(404).json({ success: false, message: 'Application not found' }); return }
  const updated = await prisma.applicant.update({
    where: { id: String(req.params.id) },
    data: { status, decisionMadeAt: new Date() },
  })
  res.json({ success: true, data: updated })
})

// GET /api/v1/admissions — list with optional ?status= filter and ?page=&limit= pagination
router.get('/', authenticate, requireRole('admissions', 'admin'), async (req: AuthRequest, res: Response) => {
  const { status, page = '1', limit = '50' } = req.query as Record<string, string>
  const skip = (Number(page) - 1) * Number(limit)
  const where = status ? { status } : {}
  const apps = await prisma.applicant.findMany({
    where,
    include: { intake: { include: { semester: true } }, programme: { include: { department: true } } },
    orderBy: { createdAt: 'desc' },
    skip,
    take: Number(limit),
  })
  res.json({ success: true, data: apps })
})

export default router
