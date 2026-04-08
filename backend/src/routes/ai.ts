import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { chat, chatStream, loadAiConfig, saveAiConfig, testConnection } from '../services/aiService'

const router = Router()
router.use(authenticate)

// ── Shared helpers ──────────────────────────────────────────

/** Build RAG context data from DB based on the caller's role */
async function buildContextData(userId: string, role: string) {
  if (role === 'student') {
    const student = await prisma.student.findFirst({
      where: { userId },
      include: {
        programme: true,
        user: { select: { displayName: true } },
        enrolments: {
          where: { status: 'registered' },
          include: { offering: { include: { course: true, semester: true } } },
        },
        feeInvoices: { orderBy: { generatedAt: 'desc' }, take: 3 },
        submissions: {
          include: { assignment: { select: { title: true, dueDate: true, maxMarks: true } } },
          orderBy: { submittedAt: 'desc' },
        },
        attendanceRecords: {
          include: { session: { include: { offering: { include: { course: { select: { code: true, name: true } } } } } } },
          orderBy: { scannedAt: 'desc' },
          take: 50,
        },
        gpaRecords: {
          include: { semester: { select: { name: true, academicYear: { select: { year: true } } } } },
          orderBy: { computedAt: 'desc' },
        },
      },
    })
    return student ? { student } : {}

  } else if (role === 'lecturer') {
    const staff = await prisma.staff.findFirst({
      where: { userId },
      include: {
        department: { select: { name: true, code: true } },
        courseOfferings: {
          include: {
            course: { select: { code: true, name: true } },
            semester: { select: { name: true, academicYear: { select: { year: true } } } },
            enrolments: {
              where: { status: 'registered' },
              include: { student: { select: { id: true, studentId: true, currentCgpa: true, user: { select: { displayName: true } } } } },
            },
            assignments: {
              include: { submissions: { select: { studentId: true, finalMarks: true, submittedAt: true } } },
              orderBy: { dueDate: 'asc' },
            },
            attendanceSessions: {
              orderBy: { startedAt: 'desc' },
              take: 5,
              include: { records: { select: { studentId: true, status: true } } },
            },
          },
        },
      },
    })
    return staff ? { lecturer: staff } : {}

  } else if (role === 'admin' || role === 'manager') {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [activeStudents, activeStaff, pendingPRs, pendingLeaves, pendingGrants, recentApplicants, glCodes] = await Promise.all([
      prisma.student.count({ where: { status: 'active' } }),
      prisma.staff.count({ where: { status: 'active' } }),
      prisma.purchaseRequest.count({ where: { status: 'submitted' } }),
      prisma.leaveRequest.count({ where: { status: 'pending' } }),
      prisma.researchGrant.count({ where: { status: 'proposal_submitted' } }),
      prisma.applicant.count({ where: { submittedAt: { gte: thirtyDaysAgo }, status: { not: 'draft' } } }),
      prisma.glCode.findMany({
        where: { isActive: true },
        select: { code: true, description: true, totalBudget: true, committedAmount: true, spentAmount: true },
        orderBy: { code: 'asc' },
      }),
    ])
    return { admin: { activeStudents, activeStaff, pendingPRs, pendingLeaves, pendingGrants, recentApplicants, glCodes } }

  } else if (role === 'finance') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [outstandingAgg, recentPaymentsAgg, glCodes] = await Promise.all([
      prisma.feeInvoice.aggregate({
        where: { status: { in: ['unpaid', 'overdue', 'partial'] } },
        _count: { id: true },
        _sum: { outstandingBalance: true },
      }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: sevenDaysAgo }, status: 'completed' },
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.glCode.findMany({
        where: { isActive: true },
        select: { code: true, description: true, totalBudget: true, committedAmount: true, spentAmount: true },
        orderBy: { code: 'asc' },
      }),
    ])
    return {
      finance: {
        outstandingInvoiceCount: outstandingAgg._count.id,
        outstandingTotal: outstandingAgg._sum.outstandingBalance ?? 0,
        recentPaymentCount: recentPaymentsAgg._count.id,
        recentPaymentTotal: recentPaymentsAgg._sum.amount ?? 0,
        glCodes,
      },
    }

  } else if (role === 'hr') {
    const [allStaff, pendingLeaves, pendingOnboarding] = await Promise.all([
      prisma.staff.findMany({
        where: { status: 'active' },
        select: {
          staffId: true, fullName: true, designation: true, employmentType: true, joinDate: true,
          department: { select: { name: true } },
          user: { select: { displayName: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      prisma.leaveRequest.findMany({
        where: { status: 'pending' },
        include: { staff: { select: { fullName: true, designation: true, department: { select: { name: true } } } } },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.onboardingRequest.findMany({
        where: { status: 'pending_approval' },
        include: { staff: { select: { fullName: true, designation: true, department: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return { hr: { allStaff, pendingLeaves, pendingOnboarding } }
  }

  return {}
}

/** Load up to 10 recent messages from an existing conversation */
async function loadConversationHistory(conversationId?: string) {
  if (!conversationId) return { history: [], existing: null }
  const existing = await prisma.chatbotConversation.findUnique({ where: { id: conversationId } })
  if (!existing) return { history: [], existing: null }
  try {
    const prev = JSON.parse(existing.messages)
    const history = prev.slice(-10).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    return { history, existing }
  } catch {
    return { history: [], existing }
  }
}

/** Persist a completed chat turn to the database */
async function persistConversation(
  userId: string,
  message: string,
  answer: string,
  contextData: any,
  existing: any,
  conversationId?: string,
) {
  const newMessages = [
    { role: 'user',      content: message, timestamp: new Date().toISOString() },
    { role: 'assistant', content: answer,  timestamp: new Date().toISOString() },
  ]
  if (existing) {
    const prev = JSON.parse(existing.messages)
    return prisma.chatbotConversation.update({
      where: { id: conversationId! },
      data: {
        messages:       JSON.stringify([...prev, ...newMessages]),
        lastActivityAt: new Date(),
        contextData:    JSON.stringify(contextData),
      },
    })
  }
  return prisma.chatbotConversation.create({
    data: {
      userId,
      messages:       JSON.stringify(newMessages),
      contextData:    JSON.stringify(contextData),
      lastActivityAt: new Date(),
    },
  })
}

// ── Routes ──────────────────────────────────────────────────

// POST /api/v1/ai/chat  (non-streaming, kept for compatibility)
router.post('/chat', async (req: AuthRequest, res: Response) => {
  const { message, conversationId } = req.body as { message: string; conversationId?: string }
  const userId = req.user!.userId

  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'Message is required' }); return
  }

  const [contextData, { history, existing }] = await Promise.all([
    buildContextData(userId, req.user!.role),
    loadConversationHistory(conversationId),
  ])

  const answer = await chat(message, contextData, history)
  const conversation = await persistConversation(userId, message, answer, contextData, existing, conversationId)

  res.json({
    success: true,
    data: { answer, conversationId: conversation.id, sources: Object.keys(contextData) },
  })
})

// POST /api/v1/ai/chat/stream  (SSE streaming)
router.post('/chat/stream', async (req: AuthRequest, res: Response) => {
  const { message, conversationId } = req.body as { message: string; conversationId?: string }
  const userId = req.user!.userId

  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'Message is required' }); return
  }

  // Set SSE headers before any async work so the browser can start reading
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const [contextData, { history, existing }] = await Promise.all([
    buildContextData(userId, req.user!.role),
    loadConversationHistory(conversationId),
  ])

  const answer = await chatStream(message, contextData, history, (chunk) => {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
  })

  const conversation = await persistConversation(userId, message, answer, contextData, existing, conversationId)

  res.write(`data: ${JSON.stringify({ done: true, conversationId: conversation.id })}\n\n`)
  res.end()
})

// GET /api/v1/ai/risk-dashboard/:offeringId
router.get('/risk-dashboard/:offeringId', async (req: AuthRequest, res: Response) => {
  const scores = await prisma.studentRiskScore.findMany({
    where: { offeringId: String(req.params.offeringId) },
    include: {
      student: { include: { user: { select: { displayName: true } } } },
    },
    orderBy: { riskScore: 'desc' },
  })
  res.json({ success: true, data: scores })
})

// POST /api/v1/ai/risk-scores/compute/:offeringId
// Computes (or recomputes) StudentRiskScore for every enrolled student in the offering
router.post('/risk-scores/compute/:offeringId', async (req: AuthRequest, res: Response) => {
  const { offeringId } = req.params

  const offering = await prisma.courseOffering.findUnique({
    where: { id: String(offeringId) },
    include: {
      enrolments: {
        where: { status: 'registered' },
        select: { studentId: true },
      },
      assignments: { select: { id: true } },
      attendanceSessions: { select: { id: true } },
    },
  })

  if (!offering) {
    res.status(404).json({ success: false, message: 'Offering not found' })
    return
  }

  const totalSessions = offering.attendanceSessions.length
  const totalAssignments = offering.assignments.length

  const results: Awaited<ReturnType<typeof prisma.studentRiskScore.upsert>>[] = []

  for (const { studentId } of offering.enrolments) {
    // Attendance rate
    const presentCount = await prisma.attendanceRecord.count({
      where: { studentId: String(studentId), session: { offeringId: String(offeringId) }, status: 'present' },
    })
    const attendancePct = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 100

    // Submission rate
    const submissionsCount = await prisma.submission.count({
      where: { studentId: String(studentId), assignment: { offeringId: String(offeringId) } },
    })
    const submissionRate = totalAssignments > 0 ? (submissionsCount / totalAssignments) * 100 : 100

    // Quiz average from graded submissions (normalised to 0-100)
    const gradedSubmissions = await prisma.submission.findMany({
      where: { studentId: String(studentId), assignment: { offeringId: String(offeringId) }, finalMarks: { not: null } },
      include: { assignment: { select: { maxMarks: true } } },
    })
    const quizAvg = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, s) => sum + ((s.finalMarks ?? 0) / s.assignment.maxMarks) * 100, 0) / gradedSubmissions.length
      : 50 // neutral default when nothing graded yet

    // Risk score: 0 = safe, 1 = high risk
    const riskScore = 1 - (
      (attendancePct / 100) * 0.4 +
      (submissionRate / 100) * 0.3 +
      (quizAvg / 100) * 0.3
    )

    const predictedOutcome = riskScore > 0.65 ? 'fail' : riskScore > 0.35 ? 'at_risk' : 'pass'
    const dataPoints = submissionsCount + (totalSessions > 0 ? presentCount : 0)
    const confidence = Math.min(0.60 + dataPoints * 0.04, 0.97)

    const round1 = (n: number) => Math.round(n * 10) / 10
    const round3 = (n: number) => Math.round(n * 1000) / 1000

    const record = await prisma.studentRiskScore.upsert({
      where: { studentId_offeringId: { studentId: String(studentId), offeringId: String(offeringId) } },
      create: {
        studentId: String(studentId), offeringId: String(offeringId),
        attendancePct: round1(attendancePct),
        quizAvg: round1(quizAvg),
        submissionRate: round1(submissionRate),
        riskScore: round3(riskScore),
        predictedOutcome,
        confidence: round3(confidence),
        computedAt: new Date(),
      },
      update: {
        attendancePct: round1(attendancePct),
        quizAvg: round1(quizAvg),
        submissionRate: round1(submissionRate),
        riskScore: round3(riskScore),
        predictedOutcome,
        confidence: round3(confidence),
        computedAt: new Date(),
      },
      include: {
        student: { include: { user: { select: { displayName: true } } } },
      },
    })
    results.push(record)
  }

  // Sort by riskScore descending (highest risk first)
  results.sort((a, b) => b.riskScore - a.riskScore)

  res.json({ success: true, data: results })
})

// GET /api/v1/ai/executive-insights
router.get('/executive-insights', async (_req, res: Response) => {
  const insights = await prisma.executiveInsight.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { generatedAt: 'desc' },
    take: 6,
  })
  res.json({ success: true, data: insights })
})

// GET /api/v1/ai/config  (admin only)
router.get('/config', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  const cfg = await loadAiConfig()
  // Mask API key for security
  res.json({
    success: true,
    data: {
      ...cfg,
      apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, cfg.apiKey.length - 10))}${cfg.apiKey.slice(-4)}` : '',
    },
  })
})

// PUT /api/v1/ai/config  (admin only)
router.put('/config', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { enabled, provider, apiKey, model, baseUrl, systemPrompt, temperature, maxTokens } = req.body

  await saveAiConfig({
    ...(enabled      !== undefined && { enabled:      Boolean(enabled) }),
    ...(provider     !== undefined && { provider }),
    ...(apiKey       !== undefined && apiKey !== '' && !apiKey.includes('*') && { apiKey }),
    ...(model        !== undefined && { model }),
    ...(baseUrl      !== undefined && { baseUrl }),
    ...(systemPrompt !== undefined && { systemPrompt }),
    ...(temperature  !== undefined && { temperature: Number(temperature) }),
    ...(maxTokens    !== undefined && { maxTokens:   Number(maxTokens) }),
  })

  res.json({ success: true, message: 'AI configuration saved successfully' })
})

// POST /api/v1/ai/config/test  (admin only)
router.post('/config/test', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  const result = await testConnection()
  res.json({ success: result.success, data: result })
})

export default router
