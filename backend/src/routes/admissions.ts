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

  // Block re-application only if the user is already an accepted/enrolled applicant
  const existing = await prisma.applicant.findFirst({ where: { userId: currentUserId } })
  if (existing && existing.status === 'accepted') {
    res.status(400).json({
      success: false,
      message: `You are already enrolled as a student (${existing.applicationRef}). Please contact the Admissions Office if you need assistance.`,
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
    // Delete existing grades first to avoid duplicates on re-submit
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

  res.json({ success: true, data: applicant, message: `Application submitted successfully. Reference: ${applicant.applicationRef}` })
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

  // ── Auto-create Student account when ACCEPTED ──────────────
  let studentAccount = null
  if (action === 'accepted' && !app.student) {
    try {
      const year = new Date().getFullYear()

      // Generate student ID (e.g. 2026001)
      const studentCount = await prisma.student.count()
      const studentId = `${year}${String(studentCount + 1).padStart(3, '0')}`

      // Generate username from name + year
      const baseUsername = app.fullName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '').slice(0, 15)
      const username = `${baseUsername}.${studentId.slice(-3)}`

      // Temporary password: FirstName@Year
      const firstName = app.fullName.split(' ')[0]
      const tempPassword = `${firstName}@${year}`
      const passwordHash = await bcrypt.hash(tempPassword, 10)

      // Create User account
      const user = await prisma.user.create({
        data: {
          username,
          passwordHash,
          displayName: app.fullName,
          role: 'student',
          email: app.email,
        },
      })

      // Create Student record
      studentAccount = await prisma.student.create({
        data: {
          studentId,
          userId: user.id,
          applicantId: app.id,
          programmeId: app.programmeId,
          intakeId: app.intakeId,
          modeOfStudy: app.modeOfStudy,
          nationality: app.nationality,
          scholarshipPct: app.scholarshipApplied ? 25 : 0, // default 25% if scholarship applied
          status: 'active',
          enrolledAt: new Date(),
        },
      })

      // Update applicant with userId link
      await prisma.applicant.update({
        where: { id: app.id },
        data: { userId: user.id },
      })
    } catch (err) {
      console.error('[Admissions] Failed to create student account:', err)
      // Don't fail the whole request – admission still recorded
    }
  }

  res.json({
    success: true,
    data: { application: updated, studentAccount },
    message: action === 'accepted'
      ? `Application accepted. Student account created successfully.`
      : `Application ${action} successfully.`,
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
