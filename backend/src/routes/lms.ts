import { Router, Response } from 'express'
import { sign, verify } from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/lms/materials/:offeringId
router.get('/materials/:offeringId', async (req: AuthRequest, res: Response) => {
  const materials = await prisma.courseMaterial.findMany({
    where: {
      offeringId: req.params.offeringId,
      isPublished: true,
    },
    include: {
      asset: true,
      uploadedBy: { select: { displayName: true } },
    },
    orderBy: { orderIndex: 'asc' },
  })
  materials.sort((a, b) => a.orderIndex - b.orderIndex)
  res.json({ success: true, data: materials })
})

// GET /api/v1/lms/submissions/pending/:lecturerId
router.get('/submissions/pending/:lecturerId', async (req: AuthRequest, res: Response) => {
  const staff = await prisma.staff.findFirst({
    where: { OR: [{ id: req.params.lecturerId }, { staffId: req.params.lecturerId }, { userId: req.params.lecturerId }] },
  })
  if (!staff) { res.status(404).json({ success: false, message: 'Lecturer not found' }); return }

  const offerings = await prisma.courseOffering.findMany({
    where: { lecturerId: staff.id },
    include: {
      course: true,
      assignments: {
        include: {
          submissions: {
            where: { finalMarks: null },
            include: {
              student: { include: { user: { select: { displayName: true } } } },
            },
          },
        },
      },
    },
  })

  const pendingSubmissions: any[] = []
  for (const offering of offerings) {
    for (const assignment of offering.assignments) {
      for (const submission of assignment.submissions) {
        pendingSubmissions.push({
          ...submission,
          assignment: { id: assignment.id, title: assignment.title, maxMarks: assignment.maxMarks },
          offering: { id: offering.id, course: offering.course },
        })
      }
    }
  }

  res.json({ success: true, data: pendingSubmissions })
})

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
  res.json({ success: true, data: enrolments.filter(e => e.status === 'registered') })
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
      uploadedById: req.user?.userId ?? '',
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

  // Get assignment and offering details for notification
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { offering: { include: { lecturer: true } } },
  })

  // Create notification for lecturer
  if (assignment?.offering?.lecturer?.userId) {
    await prisma.notification.create({
      data: {
        userId: assignment.offering.lecturer.userId,
        type: 'assignment_submission',
        subject: `New submission for ${assignment.title}`,
        body: `A student has submitted their work for ${assignment.title}. AI rubric scores are ready for your review.`,
        status: 'pending',
        triggeredByEvent: 'submission_created',
      },
    })
  }

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
      gradedById: req.user?.userId ?? '',
    },
    include: {
      assignment: {
        include: {
          offering: {
            include: { course: true, semester: true },
          },
        },
      },
      student: true,
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

  // Update enrolment with final grade
  await prisma.enrolment.update({
    where: {
      studentId_offeringId: {
        studentId: submission.studentId,
        offeringId: submission.assignment.offeringId,
      },
    },
    data: {
      finalGrade: grade,
      gradePoints: gradePoints[grade],
    },
  })

  // Calculate and update GPA
  const allEnrolments = await prisma.enrolment.findMany({
    where: {
      studentId: submission.studentId,
      finalGrade: { not: null },
    },
    include: {
      offering: { include: { course: true } },
    },
  })

  let totalGradePoints = 0
  let totalCreditHours = 0

  for (const enrol of allEnrolments) {
    if (enrol.gradePoints && enrol.offering.course.creditHours) {
      totalGradePoints += enrol.gradePoints * enrol.offering.course.creditHours
      totalCreditHours += enrol.offering.course.creditHours
    }
  }

  const currentGpa = totalCreditHours > 0 ? totalGradePoints / totalCreditHours : 0

  // Update student's current CGPA
  await prisma.student.update({
    where: { id: submission.studentId },
    data: { currentCgpa: Math.round(currentGpa * 100) / 100 },
  })

  // Create or update GPA record for the semester
  const semId = (submission.assignment.offering as any).semester?.id ?? submission.assignment.offering.semesterId
  await prisma.studentGpaRecord.upsert({
    where: {
      studentId_semesterId: {
        studentId: submission.studentId,
        semesterId: semId,
      },
    },
    create: {
      studentId: submission.studentId,
      semesterId: semId,
      semesterGpa: Math.round(currentGpa * 100) / 100,
      cumulativeGpa: Math.round(currentGpa * 100) / 100,
      totalChPassed: totalCreditHours,
    },
    update: {
      semesterGpa: Math.round(currentGpa * 100) / 100,
      cumulativeGpa: Math.round(currentGpa * 100) / 100,
      totalChPassed: totalCreditHours,
    },
  })

  // Create notification for student
  await prisma.notification.create({
    data: {
      userId: submission.student.userId,
      type: 'grade_updated',
      subject: `Grade updated for ${submission.assignment.title}`,
      body: `Your grade for ${submission.assignment.title} has been updated to ${grade}. Your current GPA is ${currentGpa.toFixed(2)}.`,
      status: 'pending',
      triggeredByEvent: 'grade_confirmed',
    },
  })

  res.json({
    success: true,
    data: {
      submission,
      grade,
      gradePoints: gradePoints[grade],
      currentGpa: Math.round(currentGpa * 100) / 100,
    },
    message: 'Grade confirmed and GPA updated',
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

// POST /api/v1/attendance/check-in  — Student submits token (JWT or sessionId)
router.post('/attendance/check-in', async (req: AuthRequest, res: Response) => {
  const { token, studentId } = req.body as { token: string; studentId: string }

  let session: any = null

  // Try matching as sessionId directly (short form)
  if (!token.includes('.')) {
    session = await prisma.attendanceSession.findUnique({ where: { id: token } })
  } else {
    // Validate JWT token
    try {
      verify(token, process.env.JWT_SECRET ?? 'secret')
    } catch {
      res.status(400).json({ success: false, message: 'Invalid or expired token' })
      return
    }
    session = await prisma.attendanceSession.findUnique({ where: { sessionToken: token } })
  }

  if (!session || session.qrExpiresAt < new Date()) {
    res.status(400).json({ success: false, message: 'Session not found or expired' })
    return
  }
  if (session.endedAt) {
    res.status(400).json({ success: false, message: 'Session has been closed by lecturer' })
    return
  }

  // Look up student by userId or studentId
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: studentId }, { studentId }, { userId: studentId }] },
  })
  if (!student) {
    res.status(404).json({ success: false, message: 'Student record not found' })
    return
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    create: { sessionId: session.id, studentId: student.id, status: 'present' },
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

// GET /api/v1/attendance/sessions/offering/:offeringId  — List sessions for a course offering
router.get('/attendance/sessions/offering/:offeringId', async (req: AuthRequest, res: Response) => {
  const sessions = await prisma.attendanceSession.findMany({
    where: { offeringId: req.params.offeringId },
    include: {
      records: { select: { id: true, status: true, scannedAt: true, studentId: true } },
    },
    orderBy: { startedAt: 'desc' },
  })
  res.json({ success: true, data: sessions })
})

// PATCH /api/v1/attendance/sessions/:sessionId/close  — Lecturer closes session
router.patch('/attendance/sessions/:sessionId/close', async (req: AuthRequest, res: Response) => {
  const session = await prisma.attendanceSession.update({
    where: { id: req.params.sessionId },
    data: { endedAt: new Date() },
  })
  res.json({ success: true, data: session })
})

// GET /api/v1/attendance/records/offering/:offeringId  — Full attendance report for a course
router.get('/attendance/records/offering/:offeringId', async (req: AuthRequest, res: Response) => {
  const sessions = await prisma.attendanceSession.findMany({
    where: { offeringId: req.params.offeringId as string },
    include: {
      records: {
        include: {
          student: { include: { user: { select: { displayName: true } } } },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  }) as any[]

  // Build per-student summary
  const studentMap: Record<string, { studentId: string; name: string; present: number; total: number }> = {}
  const totalSessions = sessions.length

  for (const sess of sessions) {
    for (const rec of sess.records) {
      if (!studentMap[rec.studentId]) {
        studentMap[rec.studentId] = {
          studentId: rec.studentId,
          name: rec.student.user.displayName,
          present: 0,
          total: totalSessions,
        }
      }
      if (rec.status === 'present') studentMap[rec.studentId].present++
    }
  }

  res.json({
    success: true,
    data: {
      sessions,
      summary: Object.values(studentMap).map(s => ({
        ...s,
        attendancePct: totalSessions > 0 ? Math.round((s.present / totalSessions) * 100) : 0,
      })),
    },
  })
})

// GET /api/v1/attendance/records/student/:studentId  — Student's own attendance across all courses
router.get('/attendance/records/student/:studentId', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.studentId }, { studentId: req.params.studentId }, { userId: req.params.studentId }] },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id },
    include: {
      session: {
        include: {
          offering: { include: { course: true } },
        },
      },
    },
    orderBy: { scannedAt: 'desc' },
  })

  // Group by offering
  const offeringMap: Record<string, { offeringId: string; courseName: string; courseCode: string; present: number; total: number }> = {}
  for (const rec of records) {
    const oid = rec.session.offeringId
    if (!offeringMap[oid]) {
      offeringMap[oid] = {
        offeringId: oid,
        courseName: rec.session.offering.course.name,
        courseCode: rec.session.offering.course.code,
        present: 0,
        total: 0,
      }
    }
    offeringMap[oid].total++
    if (rec.status === 'present') offeringMap[oid].present++
  }

  res.json({
    success: true,
    data: {
      records,
      summary: Object.values(offeringMap).map(o => ({
        ...o,
        attendancePct: o.total > 0 ? Math.round((o.present / o.total) * 100) : 0,
      })),
    },
  })
})

// GET /api/v1/attendance/offerings/lecturer/:lecturerId — Offerings taught by lecturer
router.get('/attendance/offerings/lecturer/:lecturerId', async (req: AuthRequest, res: Response) => {
  const param = req.params.lecturerId

  // Admin "all" sentinel — return all offerings
  if (param === 'all') {
    const offerings = await prisma.courseOffering.findMany({
      include: {
        course: true,
        _count: { select: { enrolments: true, attendanceSessions: true } },
      },
    })
    res.json({ success: true, data: offerings })
    return
  }

  const staff = await prisma.staff.findFirst({
    where: { OR: [{ id: param }, { staffId: param }, { userId: param }] },
  })
  if (!staff) { res.status(404).json({ success: false, message: 'Lecturer not found' }); return }

  const offerings = await prisma.courseOffering.findMany({
    where: { lecturerId: staff.id },
    include: {
      course: true,
      _count: { select: { enrolments: true, attendanceSessions: true } },
    },
  })
  res.json({ success: true, data: offerings })
})

export default router
