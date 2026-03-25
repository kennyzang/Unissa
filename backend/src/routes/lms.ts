import { Router, Response } from 'express'
import { sign, verify } from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/lms/courses/:studentId
router.get('/courses/:studentId', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.studentId }, { studentId: req.params.studentId }] },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  const enrolments = await prisma.enrolment.findMany({
    where: { studentId: student.id, status: 'registered' },
    include: {
      offering: {
        include: {
          course: true,
          lecturer: { include: { user: { select: { displayName: true } } } },
          assignments: true,
        },
      },
    },
  })
  res.json({ success: true, data: enrolments })
})

// POST /api/v1/lms/submissions
router.post('/submissions', async (req: AuthRequest, res: Response) => {
  const { assignmentId, studentId, content } = req.body as {
    assignmentId: string; studentId: string; content?: string
  }

  // Create placeholder file asset
  const asset = await prisma.fileAsset.create({
    data: {
      fileName: `submission_${Date.now()}.txt`,
      originalName: `submission_${assignmentId}.txt`,
      fileUrl: `/uploads/submissions/${assignmentId}_${studentId}.txt`,
      mimeType: 'text/plain',
      fileSizeBytes: content?.length ?? 0,
      uploadedById: req.user!.userId,
    },
  })

  // Pre-seeded AI rubric scores (demo)
  const aiRubricScores = JSON.stringify([
    { criterion: 'Clarity', ai_score: 8, ai_comment: 'Well-structured argument with clear thesis' },
    { criterion: 'References', ai_score: 6, ai_comment: 'Needs more citations from peer-reviewed sources' },
    { criterion: 'Analysis', ai_score: 7, ai_comment: 'Good critical thinking demonstrated' },
    { criterion: 'Presentation', ai_score: 9, ai_comment: 'Excellent formatting and organisation' },
  ])

  const submission = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    create: {
      assignmentId,
      studentId,
      assetId: asset.id,
      aiRubricScores,
      aiGeneratedAt: new Date(),
    },
    update: { assetId: asset.id, aiRubricScores, aiGeneratedAt: new Date() },
  })

  res.status(201).json({ success: true, data: submission, message: 'Submission received' })
})

// PATCH /api/v1/lms/submissions/:id/grade
router.patch('/submissions/:id/grade', async (req: AuthRequest, res: Response) => {
  const { instructorScores, finalMarks } = req.body as {
    instructorScores: any[]; finalMarks: number
  }

  const submission = await prisma.submission.update({
    where: { id: req.params.id },
    data: {
      instructorScores: JSON.stringify(instructorScores),
      finalMarks,
      gradedAt: new Date(),
      gradedById: req.user!.userId,
    },
  })

  // Compute grade enum
  const grade =
    finalMarks >= 90 ? 'A_plus' :
    finalMarks >= 80 ? 'A' :
    finalMarks >= 75 ? 'B_plus' :
    finalMarks >= 70 ? 'B' :
    finalMarks >= 65 ? 'C_plus' :
    finalMarks >= 60 ? 'C' :
    finalMarks >= 50 ? 'D' : 'F'

  const gradePoints: Record<string, number> = {
    A_plus: 4.0, A: 4.0, B_plus: 3.67, B: 3.33, C_plus: 3.0, C: 2.67, D: 2.0, F: 0,
  }

  res.json({
    success: true,
    data: { submission, grade, gradePoints: gradePoints[grade] },
    message: 'Grade confirmed',
  })
})

// POST /api/v1/attendance/sessions  — Lecturer starts QR session
router.post('/attendance/sessions', async (req: AuthRequest, res: Response) => {
  const { offeringId } = req.body as { offeringId: string }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 min
  const sessionToken = sign(
    { offeringId, type: 'attendance', exp: Math.floor(expiresAt.getTime() / 1000) },
    process.env.JWT_SECRET ?? 'secret'
  )

  const session = await prisma.attendanceSession.create({
    data: { offeringId, sessionToken, qrExpiresAt: expiresAt },
  })

  res.status(201).json({ success: true, data: { ...session, qrData: sessionToken } })
})

// POST /api/v1/attendance/check-in  — Student scans QR
router.post('/attendance/check-in', async (req: AuthRequest, res: Response) => {
  const { token, studentId } = req.body as { token: string; studentId: string }

  let payload: any
  try {
    payload = verify(token, process.env.JWT_SECRET ?? 'secret')
  } catch {
    res.status(400).json({ success: false, message: 'Invalid or expired QR code' })
    return
  }

  const session = await prisma.attendanceSession.findUnique({
    where: { sessionToken: token },
  })
  if (!session || session.qrExpiresAt < new Date()) {
    res.status(400).json({ success: false, message: 'QR session expired' })
    return
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
    create: { sessionId: session.id, studentId, status: 'present' },
    update: { status: 'present', scannedAt: new Date() },
  })

  res.json({ success: true, data: record, message: 'Attendance recorded ✓' })
})

// GET /api/v1/attendance/live-count/:sessionId
router.get('/attendance/live-count/:sessionId', async (req: AuthRequest, res: Response) => {
  const count = await prisma.attendanceRecord.count({
    where: { sessionId: req.params.sessionId, status: 'present' },
  })
  res.json({ success: true, data: { count } })
})

export default router
