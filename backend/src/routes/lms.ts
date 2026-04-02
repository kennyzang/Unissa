import { Router, Response } from 'express'
import { sign, verify } from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { upload, sessionMaterialUpload } from '../lib/upload'

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

// GET /api/v1/lms/submissions/lecturer/:lecturerId
router.get('/submissions/lecturer/:lecturerId', async (req: AuthRequest, res: Response) => {
  const { status } = req.query as { status?: 'pending' | 'graded' | 'all' }
  
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
            where: status === 'pending' ? { finalMarks: null } : status === 'graded' ? { finalMarks: { not: null } } : undefined,
            include: {
              student: { include: { user: { select: { displayName: true } } } },
            },
          },
        },
      },
    },
  })

  const submissions: any[] = []
  for (const offering of offerings) {
    for (const assignment of offering.assignments) {
      for (const submission of assignment.submissions) {
        submissions.push({
          ...submission,
          assignment: { id: assignment.id, title: assignment.title, maxMarks: assignment.maxMarks },
          offering: { id: offering.id, course: offering.course },
        })
      }
    }
  }

  res.json({ success: true, data: submissions })
})

// PATCH /api/v1/lms/submissions/:id/accept-ai
router.patch('/submissions/:id/accept-ai', async (req: AuthRequest, res: Response) => {
  const submission = await prisma.submission.findUnique({
    where: { id: req.params.id },
    include: {
      assignment: true,
      student: true,
    },
  })

  if (!submission) {
    res.status(404).json({ success: false, message: 'Submission not found' })
    return
  }

  if (!submission.aiRubricScores) {
    res.status(400).json({ success: false, message: 'No AI scores available' })
    return
  }

  const aiScores: any[] = JSON.parse(submission.aiRubricScores)
  const avgScore = aiScores.reduce((sum: number, s: any) => sum + s.ai_score, 0) / aiScores.length
  const finalMarks = Math.round(avgScore * 10)

  const updated = await prisma.submission.update({
    where: { id: req.params.id },
    data: {
      instructorScores: JSON.stringify(aiScores.map((s: any) => ({
        criterion: s.criterion,
        ai_score: s.ai_score,
        ai_comment: s.ai_comment,
        instructor_score: s.ai_score,
        instructor_comment: s.ai_comment,
      }))),
      finalMarks,
      gradedAt: new Date(),
      gradedById: req.user?.userId ?? '',
    },
    include: {
      student: true,
      assignment: {
        include: {
          offering: {
            include: {
              course: true,
              semester: true,
            },
          },
        },
      },
    },
  })

  const gpaRecord = await prisma.studentGpaRecord.findFirst({
    where: {
      studentId: submission.studentId,
      semesterId: submission.assignment.offering.semesterId,
    },
  })

  if (gpaRecord) {
    const totalCredits = gpaRecord.totalCredits + submission.assignment.weightPct ?? 0
    const currentGpa = gpaRecord.currentGpa
    const newGpa = ((currentGpa * gpaRecord.totalCredits) + (finalMarks / 10 * (submission.assignment.weightPct ?? 0))) / totalCredits

    await prisma.studentGpaRecord.update({
      where: { id: gpaRecord.id },
      data: {
        totalCredits,
        currentGpa: newGpa,
      },
    })
  }

  await prisma.notification.create({
    data: {
      userId: submission.student.userId,
      type: 'grade_updated',
      subject: `Grade updated for ${submission.assignment.title}`,
      body: `Your grade for ${submission.assignment.title} has been updated to ${finalMarks}/${submission.assignment.maxMarks}. Your current GPA is ${(updated.student.currentCgpa).toFixed(2)}.`,
      status: 'pending',
      triggeredByEvent: 'grade_updated',
    },
  })

  res.json({
    success: true,
    data: {
      ...updated,
      currentGpa: updated.student.currentCgpa,
    },
    message: 'AI scores accepted and grade confirmed',
  })
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
router.post('/submissions', upload.array('files', 5), async (req: AuthRequest, res: Response) => {
  try {
    const { assignmentId, studentId, content } = req.body as {
      assignmentId: string; studentId: string; content?: string
    }
    
    const files = req.files as Express.Multer.File[] || []

    // Create file assets for uploaded files
    const fileAssets = []
    for (const file of files) {
      const asset = await prisma.fileAsset.create({
        data: {
          fileName: file.filename,
          originalName: file.originalname,
          fileUrl: `/uploads/submissions/${file.filename}`,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          uploadedById: req.user?.userId ?? '',
        },
      })
      fileAssets.push(asset)
    }

    // Create content file if provided
    let contentAsset = null
    if (content && content.trim()) {
      contentAsset = await prisma.fileAsset.create({
        data: {
          fileName: `submission_${Date.now()}.txt`,
          originalName: `submission_content_${assignmentId}_${studentId}.txt`,
          fileUrl: `/uploads/submissions/submission_${Date.now()}.txt`,
          mimeType: 'text/plain',
          fileSizeBytes: content.length,
          uploadedById: req.user?.userId ?? '',
        },
      })
      
      // Write content to file
      const fs = await import('fs')
      const path = await import('path')
      const filePath = path.join(process.cwd(), 'uploads', 'submissions', `submission_${Date.now()}.txt`)
      fs.writeFileSync(filePath, content)
    }

    // Pre-seeded AI rubric scores (demo)
    const aiRubricScores = JSON.stringify([
      { criterion: '内容完整性', ai_score: 8.5, ai_comment: '回答内容较为完整，涵盖了主要知识点，但在某些细节上可以进一步展开。', ai_suggestions: '建议补充具体的例子和实际应用场景，以增强回答的说服力。' },
      { criterion: '逻辑清晰度', ai_score: 9.0, ai_comment: '逻辑结构清晰，论证过程合理，能够很好地表达思想。', ai_suggestions: '可以尝试使用更简洁的语言表达复杂概念，提高可读性。' },
      { criterion: '深度与创新性', ai_score: 7.5, ai_comment: '对问题有一定的理解深度，但创新性不足，缺乏独特的见解。', ai_suggestions: '建议从不同角度思考问题，提出一些有创意的解决方案。' },
      { criterion: '表达准确性', ai_score: 8.0, ai_comment: '表达基本准确，没有明显的错误，但在专业术语的使用上可以更加精确。', ai_suggestions: '建议查阅相关资料，确保专业术语的正确使用。' }
    ])

    // Use the first file asset or content asset
    const primaryAssetId = fileAssets.length > 0 ? fileAssets[0].id : (contentAsset?.id ?? null)
    
    if (!primaryAssetId) {
      res.status(400).json({ success: false, message: 'No content or files provided' })
      return
    }

    const submission = await prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: {
        assignmentId,
        studentId,
        assetId: primaryAssetId,
        aiRubricScores,
        aiGeneratedAt: new Date(),
        submittedAt: new Date(),
      },
      update: { 
        assetId: primaryAssetId, 
        aiRubricScores, 
        aiGeneratedAt: new Date(),
        submittedAt: new Date()
      },
    })

    // Get assignment and offering details for notification
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { offering: { include: { lecturer: true } } },
    })

    // Get student details for notification
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, applicant: true }
    })
    const studentName = student?.applicant?.fullName || student?.user?.displayName || 'Student'

    // Create notification for lecturer
    if (assignment?.offering?.lecturer?.userId) {
      await prisma.notification.create({
        data: {
          userId: assignment.offering.lecturer.userId,
          type: 'assignment_submission',
          subject: `New submission for ${assignment.title} - ${studentName}`,
          body: `${studentName} has submitted their work for ${assignment.title}. AI rubric scores are ready for your review.`,
          status: 'pending',
          triggeredByEvent: 'submission_created',
        },
      })
    }

    res.status(201).json({ success: true, data: submission, message: 'Submission received' })
  } catch (error) {
    console.error('Error creating submission:', error)
    res.status(500).json({ success: false, message: 'Failed to create submission', error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// GET /api/v1/lms/submissions/history/:offeringId/:studentId
  router.get('/submissions/history/:offeringId/:studentId', async (req: AuthRequest, res: Response) => {
    const { offeringId, studentId } = req.params

    const submissions = await prisma.submission.findMany({
      where: {
        studentId,
        assignment: {
          offeringId,
        },
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            maxMarks: true,
            dueDate: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' as const },
    })

    res.json({ success: true, data: submissions })
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
  const { offeringId, name, description } = req.body as {
    offeringId: string
    name?: string
    description?: string
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 min
  const sessionToken = sign(
    { offeringId, type: 'attendance', exp: Math.floor(expiresAt.getTime() / 1000) },
    process.env.JWT_SECRET ?? 'secret'
  )

  const session = await prisma.attendanceSession.create({
    data: {
      offeringId,
      sessionToken,
      qrExpiresAt: expiresAt,
      name: name?.trim() || null,
      description: description?.trim() || null,
    },
  })

  res.status(201).json({ success: true, data: { ...session, qrData: sessionToken } })
})

// GET /api/v1/attendance/sessions/:sessionId  — Fetch single session details
router.get('/attendance/sessions/:sessionId', async (req: AuthRequest, res: Response) => {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: req.params.sessionId },
    include: {
      records: { select: { id: true, status: true, scannedAt: true, studentId: true } },
    },
  })
  if (!session) { res.status(404).json({ success: false, message: 'Session not found' }); return }
  res.json({ success: true, data: { ...session, qrData: session.sessionToken } })
})

// POST /api/v1/attendance/sessions/:sessionId/materials  — Upload course materials
router.post(
  '/attendance/sessions/:sessionId/materials',
  sessionMaterialUpload.array('files', 10),
  async (req: AuthRequest, res: Response) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const session = await prisma.attendanceSession.findUnique({ where: { id: req.params.sessionId } })
    if (!session) { res.status(404).json({ success: false, message: 'Session not found' }); return }

    const existing: any[] = session.materials ? JSON.parse(session.materials as string) : []
    const added = files.map(f => ({
      filename: f.originalname,
      path: f.path,
      size: f.size,
      mimetype: f.mimetype,
      uploadedAt: new Date().toISOString(),
    }))

    const updated = await prisma.attendanceSession.update({
      where: { id: req.params.sessionId },
      data: { materials: JSON.stringify([...existing, ...added]) },
    })
    res.json({ success: true, data: { ...updated, qrData: updated.sessionToken } })
  },
)

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
  const parsed = sessions.map(s => ({
    ...s,
    materials: s.materials ? JSON.parse(s.materials as string) : [],
    qrData: s.sessionToken,
  }))
  res.json({ success: true, data: parsed })
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
