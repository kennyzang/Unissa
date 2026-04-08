import { Router, Response } from 'express'
import { sign, verify } from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { upload, sessionMaterialUpload } from '../lib/upload'
import { scoreSubmission } from '../services/aiService'

const router = Router()
router.use(authenticate)

// ── Payment gate helper ────────────────────────────────────────────────────────
// Returns true (blocked) when the student's most recent invoice is not 'paid'.
// Non-students and students without any invoice are always allowed through.
async function isPaymentBlocked(userId: string | undefined): Promise<boolean> {
  if (!userId) return false
  const student = await prisma.student.findFirst({
    where: { userId },
    select: { id: true },
  })
  if (!student) return false
  const invoice = await prisma.feeInvoice.findFirst({
    where: { studentId: student.id },
    orderBy: { generatedAt: 'desc' },
    select: { status: true },
  })
  if (!invoice) return false
  return invoice.status !== 'paid'
}
const PAYMENT_BLOCKED_MSG = 'Please complete tuition payment before accessing course content.'

// GET /api/v1/lms/materials/:offeringId
router.get('/materials/:offeringId', async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'student' && await isPaymentBlocked(req.user.userId)) {
    res.status(403).json({ success: false, message: PAYMENT_BLOCKED_MSG }); return
  }
  const materials = await prisma.courseMaterial.findMany({
    where: {
      offeringId: String(req.params.offeringId),
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

// POST /api/v1/lms/materials/:offeringId - Upload course material
router.post('/materials/:offeringId', sessionMaterialUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, materialType, externalUrl, isPublished } = req.body
    const offeringId = req.params.offeringId
    const file = req.file

    if (!title) {
      res.status(400).json({ success: false, message: 'Title is required' })
      return
    }

    if (!file && !externalUrl && materialType !== 'link') {
      res.status(400).json({ success: false, message: 'Either file or externalUrl is required' })
      return
    }

    // Check if user is lecturer of this offering or admin
    const offering = await prisma.courseOffering.findUnique({
      where: { id: String(offeringId) },
      include: { lecturer: true },
    })

    if (!offering) {
      res.status(404).json({ success: false, message: 'Course offering not found' })
      return
    }

    const isAdmin = req.user?.role === 'admin'
    const isLecturer = offering.lecturer?.userId === req.user?.userId

    if (!isAdmin && !isLecturer) {
      res.status(403).json({ success: false, message: 'You are not authorized to upload materials for this course' })
      return
    }

    // Get max order index
    const maxOrder = await prisma.courseMaterial.aggregate({
      where: { offeringId: String(offeringId) },
      _max: { orderIndex: true },
    })
    const nextOrder = (maxOrder._max.orderIndex ?? -1) + 1

    // Create file asset if file uploaded
    let assetId: string | null = null
    if (file) {
      const asset = await prisma.fileAsset.create({
        data: {
          fileName: file.filename,
          originalName: file.originalname,
          fileUrl: `/uploads/session-materials/${file.filename}`,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          uploadedById: req.user?.userId ?? '',
        },
      })
      assetId = asset.id
    }

    // Determine material type from file if not provided
    let finalMaterialType = materialType || 'document'
    if (file && !materialType) {
      if (file.mimetype.includes('presentation') || file.originalname.match(/\.pptx?$/i)) {
        finalMaterialType = 'presentation'
      } else if (file.mimetype.includes('video')) {
        finalMaterialType = 'video'
      } else {
        finalMaterialType = 'document'
      }
    }

    const material = await prisma.courseMaterial.create({
      data: {
        offeringId: String(offeringId),
        title,
        description: description || null,
        materialType: finalMaterialType,
        assetId,
        externalUrl: externalUrl || null,
        isPublished: isPublished === 'true' || isPublished === true,
        orderIndex: nextOrder,
        uploadedById: req.user?.userId ?? '',
      },
      include: {
        asset: true,
        uploadedBy: { select: { displayName: true } },
      },
    })

    res.status(201).json({ success: true, data: material, message: 'Material uploaded successfully' })
  } catch (error) {
    console.error('Error uploading material:', error)
    res.status(500).json({ success: false, message: 'Failed to upload material', error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// DELETE /api/v1/lms/materials/:materialId - Delete course material
router.delete('/materials/:materialId', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.courseMaterial.findUnique({
      where: { id: String(req.params.materialId) },
      include: { offering: { include: { lecturer: true } } },
    })

    if (!material) {
      res.status(404).json({ success: false, message: 'Material not found' })
      return
    }

    const isAdmin = req.user?.role === 'admin'
    const isLecturer = material.offering.lecturer?.userId === req.user?.userId

    if (!isAdmin && !isLecturer) {
      res.status(403).json({ success: false, message: 'You are not authorized to delete this material' })
      return
    }

    await prisma.courseMaterial.delete({
      where: { id: String(req.params.materialId) },
    })

    res.json({ success: true, message: 'Material deleted successfully' })
  } catch (error) {
    console.error('Error deleting material:', error)
    res.status(500).json({ success: false, message: 'Failed to delete material' })
  }
})

// PATCH /api/v1/lms/materials/:materialId - Update course material
router.patch('/materials/:materialId', sessionMaterialUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, isPublished, orderIndex } = req.body
    const file = req.file

    // Parse boolean values from string
    const parsedIsPublished = isPublished === 'true'
    const parsedOrderIndex = orderIndex ? parseInt(orderIndex) : undefined

    const material = await prisma.courseMaterial.findUnique({
      where: { id: String(req.params.materialId) },
      include: { offering: { include: { lecturer: true } } },
    })

    if (!material) {
      res.status(404).json({ success: false, message: 'Material not found' })
      return
    }

    const isAdmin = req.user?.role === 'admin'
    const isLecturer = material.offering.lecturer?.userId === req.user?.userId

    if (!isAdmin && !isLecturer) {
      res.status(403).json({ success: false, message: 'You are not authorized to update this material' })
      return
    }

    // Create file asset if new file uploaded
    let assetId: string | null = material.assetId
    if (file) {
      // Delete old asset if exists
      if (material.assetId) {
        await prisma.fileAsset.delete({ where: { id: material.assetId } })
      }
      
      const asset = await prisma.fileAsset.create({
        data: {
          fileName: file.filename,
          originalName: file.originalname,
          fileUrl: `/uploads/${file.filename}`,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          uploadedById: req.user?.userId || 'system',
        },
      })
      assetId = asset.id
    }

    const updated = await prisma.courseMaterial.update({
      where: { id: String(req.params.materialId) },
      data: {
        title: title ?? material.title,
        description: description ?? material.description,
        isPublished: isPublished !== undefined ? parsedIsPublished : material.isPublished,
        orderIndex: parsedOrderIndex ?? material.orderIndex,
        assetId: assetId,
      },
      include: {
        asset: true,
        uploadedBy: { select: { displayName: true } },
      },
    })

    res.json({ success: true, data: updated, message: 'Material updated successfully' })
  } catch (error) {
    console.error('Error updating material:', error)
    res.status(500).json({ success: false, message: 'Failed to update material', error: process.env.NODE_ENV === 'development' ? (error as any).message : undefined })
  }
})

// GET /api/v1/lms/submissions/pending/:lecturerId
router.get('/submissions/pending/:lecturerId', async (req: AuthRequest, res: Response) => {
  const staff = await prisma.staff.findFirst({
    where: { OR: [{ id: String(req.params.lecturerId) }, { staffId: String(req.params.lecturerId) }, { userId: String(req.params.lecturerId) }] },
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
    where: { OR: [{ id: String(req.params.lecturerId) }, { staffId: String(req.params.lecturerId) }, { userId: String(req.params.lecturerId) }] },
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
              asset: true,
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
    where: { id: String(req.params.id) },
    include: {
      assignment: {
        include: {
          offering: true
        }
      },
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
  const totalScore = aiScores.reduce((sum: number, s: any) => sum + s.ai_score, 0)
  const maxPossible = aiScores.length * 10
  const finalMarks = maxPossible > 0 ? Math.round((totalScore / maxPossible) * submission.assignment.maxMarks) : 0

  const updated = await prisma.submission.update({
    where: { id: String(req.params.id) },
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
    const totalChPassed = gpaRecord.totalChPassed + (submission.assignment.weightPct ?? 0)
    const currentGpa = gpaRecord.semesterGpa
    const newGpa = ((currentGpa * gpaRecord.totalChPassed) + (finalMarks / 10 * (submission.assignment.weightPct ?? 0))) / totalChPassed

    await prisma.studentGpaRecord.update({
      where: { id: gpaRecord.id },
      data: {
        semesterGpa: newGpa,
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

// GET /api/v1/lms/offerings/:offeringId — Offering detail with course/lecturer/assignments/sessions
router.get('/offerings/:offeringId', async (req: AuthRequest, res: Response) => {
  const offeringId = String(req.params.offeringId)
  const requestingUser = req.user

  const offering = await prisma.courseOffering.findUnique({
    where: { id: String(offeringId) },
    include: {
      course: true,
      lecturer: { include: { user: { select: { displayName: true, email: true } } } },
      assignments: { orderBy: { dueDate: 'asc' } },
      materials: {
        where: { isPublished: true },
        include: { asset: true },
        orderBy: { orderIndex: 'asc' },
      },
      attendanceSessions: {
        orderBy: { startedAt: 'desc' },
        select: { id: true, name: true, startedAt: true, endedAt: true, _count: { select: { records: true } } },
      },
      _count: { select: { enrolments: true, attendanceSessions: true } },
    },
  })

  if (!offering) {
    res.status(404).json({ success: false, message: 'Offering not found' })
    return
  }

  // Access control: lecturers can only view their own offerings
  if (requestingUser?.role === 'lecturer') {
    const staff = await prisma.staff.findFirst({
      where: { userId: requestingUser.userId },
    })
    if (!staff || offering.lecturerId !== staff.id) {
      res.status(403).json({ success: false, message: 'Access denied' })
      return
    }
  }

  // Access control: students can only view offerings they are enrolled in
  if (requestingUser?.role === 'student') {
    const student = await prisma.student.findFirst({ where: { userId: requestingUser.userId } })
    if (student) {
      const enrolment = await prisma.enrolment.findFirst({
        where: { studentId: student.id, offeringId, status: 'registered' },
      })
      if (!enrolment) {
        res.status(403).json({ success: false, message: 'Access denied' })
        return
      }
    }
  }

  res.json({ success: true, data: offering })
})

// GET /api/v1/lms/offerings/:offeringId/enrolments — Student roster for a course offering
router.get('/offerings/:offeringId/enrolments', async (req: AuthRequest, res: Response) => {
  const offeringId = String(req.params.offeringId)
  const requestingUser = req.user

  if (requestingUser?.role === 'student') {
    res.status(403).json({ success: false, message: 'Access denied' })
    return
  }

  if (requestingUser?.role === 'lecturer') {
    const staff = await prisma.staff.findFirst({ where: { userId: requestingUser.userId } })
    const off = await prisma.courseOffering.findUnique({ where: { id: offeringId }, select: { lecturerId: true } })
    if (!staff || off?.lecturerId !== staff.id) {
      res.status(403).json({ success: false, message: 'Access denied' })
      return
    }
  }

  const enrolments = await prisma.enrolment.findMany({
    where: { offeringId, status: 'registered' },
    include: {
      student: {
        include: { user: { select: { displayName: true, email: true } } },
      },
    },
    orderBy: { registeredAt: 'asc' },
  })

  res.json({ success: true, data: enrolments })
})

// POST /api/v1/lms/assignments — Create a new assignment (lecturer/admin)
router.post('/assignments', async (req: AuthRequest, res: Response) => {
  try {
    const { offeringId, title, description, dueDate, maxMarks, weightPct, rubricCriteria } = req.body as {
      offeringId: string
      title: string
      description?: string
      dueDate: string
      maxMarks?: number
      weightPct?: number
      rubricCriteria?: any
    }
    if (!offeringId || !title || !dueDate) {
      res.status(400).json({ success: false, message: 'offeringId, title, and dueDate are required' })
      return
    }
    const assignment = await prisma.assignment.create({
      data: {
        offeringId,
        title: title.trim(),
        description: (description ?? title).trim(),
        dueDate: new Date(dueDate),
        maxMarks: maxMarks ?? 100,
        weightPct: weightPct ?? 10,
        rubricCriteria: rubricCriteria ? JSON.stringify(rubricCriteria) : null,
      },
    })
    res.status(201).json({ success: true, data: assignment })
  } catch (error) {
    console.error('Error creating assignment:', error)
    res.status(500).json({ success: false, message: 'Failed to create assignment' })
  }
})

// GET /api/v1/lms/submissions/offering/:offeringId — All submissions for a course offering (lecturer/admin only)
router.get('/submissions/offering/:offeringId', async (req: AuthRequest, res: Response) => {
  const offeringId = String(req.params.offeringId)
  const requestingUser = req.user

  if (requestingUser?.role === 'student') {
    res.status(403).json({ success: false, message: 'Access denied' })
    return
  }

  if (requestingUser?.role === 'lecturer') {
    const staff = await prisma.staff.findFirst({ where: { userId: requestingUser.userId } })
    const off = await prisma.courseOffering.findUnique({ where: { id: offeringId }, select: { lecturerId: true } })
    if (!staff || off?.lecturerId !== staff.id) {
      res.status(403).json({ success: false, message: 'Access denied' })
      return
    }
  }

  const assignments = await prisma.assignment.findMany({
    where: { offeringId },
    include: {
      submissions: {
        include: {
          student: { include: { user: { select: { displayName: true } } } },
          asset: true,
        },
        orderBy: { submittedAt: 'desc' },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  res.json({ success: true, data: assignments })
})

// GET /api/v1/lms/courses/:studentId
router.get('/courses/:studentId', async (req: AuthRequest, res: Response) => {
  const studentId = String(req.params.studentId)
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: studentId }, { studentId }] },
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
    if (req.user?.role === 'student' && await isPaymentBlocked(req.user.userId)) {
      res.status(403).json({ success: false, message: PAYMENT_BLOCKED_MSG }); return
    }

    const { assignmentId, studentId, content } = req.body as {
      assignmentId: string; studentId: string; content?: string
    }

    const files = req.files as Express.Multer.File[] || []
    const trimmedContent = content?.trim() || ''

    // Parse student answers from request body
    let studentAnswers: Array<{ questionIndex: number; type: string; answer: string | string[] }> = []
    try {
      if (req.body.answers) {
        studentAnswers = typeof req.body.answers === 'string'
          ? JSON.parse(req.body.answers)
          : req.body.answers
      }
    } catch { studentAnswers = [] }

    // Validate: must have either answers, content, or files
    if (studentAnswers.length === 0 && !trimmedContent && files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Please provide answers, content, or at least one file attachment'
      })
      return
    }

    // Validate file types
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        res.status(400).json({
          success: false,
          message: `Invalid file type: ${file.originalname}. Allowed: JPG, PNG, PDF, DOC, DOCX, TXT.`
        })
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        res.status(400).json({
          success: false,
          message: `File too large: ${file.originalname}. Maximum size is 10MB.`
        })
        return
      }
    }

    // Create file assets for uploaded files
    const fileAssets: Awaited<ReturnType<typeof prisma.fileAsset.create>>[] = []
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
    let contentAsset: Awaited<ReturnType<typeof prisma.fileAsset.create>> | null = null
    if (trimmedContent) {
      contentAsset = await prisma.fileAsset.create({
        data: {
          fileName: `submission_${Date.now()}.txt`,
          originalName: `submission_content_${assignmentId}_${studentId}.txt`,
          fileUrl: `/uploads/submissions/submission_${Date.now()}.txt`,
          mimeType: 'text/plain',
          fileSizeBytes: trimmedContent.length,
          uploadedById: req.user?.userId ?? '',
        },
      })

      // Write content to file
      const fs = await import('fs')
      const path = await import('path')
      const filePath = path.join(process.cwd(), 'uploads', 'submissions', `submission_${Date.now()}.txt`)
      fs.writeFileSync(filePath, trimmedContent)
    }

    // Fetch assignment for rubric/questions and scoring
    const assignmentForScoring = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    })

    // Parse assignment rubric and questions
    let rubricCriteria: Array<{ criterion: string; max_marks: number; ai_suggestion?: string }> = []
    let assignmentQuestions: Array<{ type: string; text: string; options?: string[]; marks: number; correctAnswer?: string | string[] }> = []
    try {
      if (assignmentForScoring?.rubricCriteria) {
        const parsed = JSON.parse(assignmentForScoring.rubricCriteria)
        // Support both array format (legacy) and object format with criteria/questions
        if (Array.isArray(parsed)) {
          rubricCriteria = parsed
        } else {
          rubricCriteria = parsed.criteria ?? []
          assignmentQuestions = parsed.questions ?? []
        }
      }
    } catch { /* ignore parse errors */ }

    // Run real AI scoring
    let aiRubricScores = '[]'
    try {
      const scores = await scoreSubmission({
        assignmentTitle: assignmentForScoring?.title ?? assignmentId,
        rubricCriteria,
        questions: assignmentQuestions as any,
        answers: studentAnswers,
        textContent: trimmedContent || undefined,
        maxMarks: assignmentForScoring?.maxMarks ?? 100,
      })
      aiRubricScores = JSON.stringify(scores)
    } catch (err) {
      console.error('[submissions] AI scoring failed:', err)
      aiRubricScores = JSON.stringify(rubricCriteria.map(c => ({
        criterion: c.criterion,
        ai_score: 5,
        max_marks: c.max_marks,
        ai_comment: 'AI grading temporarily unavailable.',
        ai_suggestions: 'Please review manually.',
      })))
    }

    // Use the first file asset or content asset (optional for Q&A submissions)
    const primaryAssetId = fileAssets.length > 0 ? fileAssets[0].id : (contentAsset?.id ?? null)

    const submission = await prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: {
        assignmentId,
        studentId,
        ...(primaryAssetId ? { assetId: primaryAssetId } : {}),
        content: trimmedContent || null,
        answers: studentAnswers.length > 0 ? JSON.stringify(studentAnswers) : null,
        aiRubricScores,
        aiGeneratedAt: new Date(),
        submittedAt: new Date(),
      },
      update: {
        ...(primaryAssetId ? { assetId: primaryAssetId } : {}),
        content: trimmedContent || null,
        answers: studentAnswers.length > 0 ? JSON.stringify(studentAnswers) : null,
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
    const offeringId = String(req.params.offeringId)
    const studentId = String(req.params.studentId)

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
        asset: {
          select: {
            id: true,
            fileName: true,
            originalName: true,
            fileUrl: true,
            mimeType: true,
            fileSizeBytes: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' as const },
    })

    res.json({ success: true, data: submissions })
  })

// PATCH /api/v1/lms/submissions/:id/grade
router.patch('/submissions/:id/grade', async (req: AuthRequest, res: Response) => {
  const submissionId = String(req.params.id)
  const { instructorScores, finalMarks } = req.body as {
    instructorScores: any[]; finalMarks: number
  }

  // Validate finalMarks basic presence
  if (finalMarks === undefined || finalMarks === null || isNaN(finalMarks)) {
    res.status(400).json({ success: false, message: 'Final marks are required' })
    return
  }

  // Validate instructorScores
  if (!Array.isArray(instructorScores) || instructorScores.length === 0) {
    res.status(400).json({ success: false, message: 'Instructor scores are required' })
    return
  }

  for (const score of instructorScores) {
    if (score.instructor_score !== undefined && (score.instructor_score < 0 || score.instructor_score > 10)) {
      res.status(400).json({ success: false, message: 'Instructor scores must be between 0 and 10 for each criterion' })
      return
    }
  }

  // Fetch submission to validate finalMarks against assignment.maxMarks
  const existingSubmission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { maxMarks: true } } },
  })
  if (!existingSubmission) {
    res.status(404).json({ success: false, message: 'Submission not found' })
    return
  }
  const maxMarks = existingSubmission.assignment.maxMarks
  if (finalMarks < 0 || finalMarks > maxMarks) {
    res.status(400).json({ success: false, message: `Final marks must be between 0 and ${maxMarks}` })
    return
  }

  const submission = await prisma.submission.update({
    where: { id: submissionId },
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
  const sessionId = String(req.params.sessionId)
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      records: { select: { id: true, status: true, scannedAt: true, studentId: true } },
    },
  })
  if (!session) { res.status(404).json({ success: false, message: 'Session not found' }); return }
  res.json({ success: true, data: { ...session, qrData: session.sessionToken } })
})

// GET /api/v1/lms/attendance/active-sessions  — All currently open sessions (for students to detect check-in availability)
router.get('/attendance/active-sessions', async (_req: AuthRequest, res: Response) => {
  const sessions = await prisma.attendanceSession.findMany({
    where: { endedAt: null, qrExpiresAt: { gte: new Date() } },
    select: { id: true, offeringId: true, sessionToken: true, qrExpiresAt: true, startedAt: true, name: true },
    orderBy: { startedAt: 'desc' },
  })
  res.json({ success: true, data: sessions })
})

// GET /api/v1/attendance/sessions/lecturer/:lecturerId/active  — Fetch active session for lecturer
router.get('/attendance/sessions/lecturer/:lecturerId/active', async (req: AuthRequest, res: Response) => {
  const lecturerId = String(req.params.lecturerId)
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      offering: { lecturerId },
      endedAt: null,
      qrExpiresAt: { gte: new Date() }
    },
    include: {
      records: { select: { id: true, status: true, scannedAt: true, studentId: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 1
  })
  res.json({ success: true, data: sessions.map(s => ({ ...s, qrData: s.sessionToken })) })
})

// POST /api/v1/attendance/sessions/:sessionId/materials  — Upload course materials
router.post(
  '/attendance/sessions/:sessionId/materials',
  sessionMaterialUpload.array('files', 10),
  async (req: AuthRequest, res: Response) => {
    const sessionId = String(req.params.sessionId)
    const files = (req.files ?? []) as Express.Multer.File[]
    const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } })
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
      where: { id: sessionId },
      data: { materials: JSON.stringify([...existing, ...added]) },
    })
    res.json({ success: true, data: { ...updated, qrData: updated.sessionToken } })
  },
)

// POST /api/v1/attendance/check-in  — Student submits token (JWT or sessionId)
router.post('/attendance/check-in', async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'student' && await isPaymentBlocked(req.user.userId)) {
    res.status(403).json({ success: false, message: PAYMENT_BLOCKED_MSG }); return
  }

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
    where: { sessionId: String(req.params.sessionId), status: 'present' },
  })
  res.json({ success: true, data: { count } })
})

// GET /api/v1/attendance/sessions/offering/:offeringId  — List sessions for a course offering
router.get('/attendance/sessions/offering/:offeringId', async (req: AuthRequest, res: Response) => {
  const sessions = await prisma.attendanceSession.findMany({
    where: { offeringId: String(req.params.offeringId) },
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
    where: { id: String(req.params.sessionId) },
    data: { endedAt: new Date() },
  })
  res.json({ success: true, data: session })
})

// GET /api/v1/attendance/records/offering/:offeringId  — Full attendance report for a course
router.get('/attendance/records/offering/:offeringId', async (req: AuthRequest, res: Response) => {
  const sessions = await prisma.attendanceSession.findMany({
    where: { offeringId: String(req.params.offeringId) },
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
  const studentId = String(req.params.studentId)
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: studentId }, { studentId }, { userId: studentId }] },
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

// POST /api/v1/lms/courses/propose — Lecturer submits a new course proposal
router.post('/courses/propose', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'lecturer' && req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Only lecturers can propose courses' })
    return
  }
  const { code, name, departmentId, creditHours, level, isOpenToInternational, maxSeats } = req.body as {
    code: string; name: string; departmentId: string
    creditHours?: number; level?: number; isOpenToInternational?: boolean; maxSeats?: number
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

  const staff = await prisma.staff.findFirst({ where: { userId: req.user!.userId } })
  if (!staff) {
    res.status(404).json({ success: false, message: 'Staff record not found' })
    return
  }

  const course = await prisma.course.create({
    data: {
      code,
      name,
      departmentId,
      creditHours:           Number(creditHours ?? 3),
      level:                 Number(level ?? 1),
      isOpenToInternational: isOpenToInternational ?? true,
      maxSeats:              Number(maxSeats ?? 40),
      status:                'pending_approval',
      proposedByStaffId:     staff.id,
    },
  })
  res.status(201).json({ success: true, data: course, message: 'Course proposal submitted — pending admin approval' })
})

// GET /api/v1/lms/lecturer/dashboard — Full lecturer dashboard snapshot
// Returns: staff record, all offerings (course, semester, enrolled count),
//          student rosters per offering, assignment submission progress,
//          and recent attendance session summaries.
router.get('/lecturer/dashboard', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId

  const staff = await prisma.staff.findFirst({
    where: { userId },
    include: {
      user:       { select: { displayName: true, email: true } },
      department: { select: { name: true, code: true } },
    },
  })
  if (!staff) {
    res.status(404).json({ success: false, message: 'Staff record not found' })
    return
  }

  const offerings = await prisma.courseOffering.findMany({
    where: { lecturerId: staff.id },
    include: {
      course:   { select: { code: true, name: true, creditHours: true } },
      semester: { select: { id: true, name: true, isActive: true } },
      enrolments: {
        where: { status: 'registered' },
        include: {
          student: {
            select: {
              studentId:    true,
              currentCgpa:  true,
              user: { select: { displayName: true } },
            },
          },
        },
      },
      assignments: {
        orderBy: { dueDate: 'asc' },
        include: { _count: { select: { submissions: true } } },
      },
      attendanceSessions: {
        orderBy: { startedAt: 'desc' },
        take: 5,
        include: {
          _count:  { select: { records: true } },
          records: { where: { status: 'present' }, select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const data = {
    staff: {
      id:          staff.id,
      staffId:     staff.staffId,
      fullName:    staff.fullName,
      designation: staff.designation,
      department:  staff.department?.name ?? null,
      email:       staff.user?.email ?? null,
    },
    offerings: offerings.map(o => {
      const enrolledCount = o.enrolments.length
      return {
        id:         o.id,
        dayOfWeek:  o.dayOfWeek,
        startTime:  o.startTime,
        endTime:    o.endTime,
        room:       o.room,
        course:     o.course,
        semester:   o.semester,
        enrolledCount,
        students: o.enrolments.map(e => ({
          name:      e.student.user.displayName,
          studentId: e.student.studentId,
          cgpa:      e.student.currentCgpa,
        })),
        assignments: o.assignments.map(a => ({
          id:              a.id,
          title:           a.title,
          dueDate:         a.dueDate,
          maxMarks:        a.maxMarks,
          weightPct:       a.weightPct,
          submissionCount: a._count.submissions,
          enrolledCount,
        })),
        recentAttendanceSessions: o.attendanceSessions.map(s => ({
          id:           s.id,
          name:         s.name,
          startedAt:    s.startedAt,
          endedAt:      s.endedAt,
          presentCount: s.records.length,
          totalEnrolled: enrolledCount,
        })),
      }
    }),
  }

  res.json({ success: true, data })
})

// GET /api/v1/attendance/offerings/lecturer/:lecturerId — Offerings taught by lecturer
router.get('/attendance/offerings/lecturer/:lecturerId', async (req: AuthRequest, res: Response) => {
  const param = String(req.params.lecturerId)

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
