import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { chat, loadAiConfig, saveAiConfig, testConnection } from '../services/aiService'

const router = Router()
router.use(authenticate)

// POST /api/v1/ai/chat
router.post('/chat', async (req: AuthRequest, res: Response) => {
  const { message, conversationId } = req.body as { message: string; conversationId?: string }
  const userId = req.user!.userId

  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'Message is required' }); return
  }

  // RAG: pull student context if role is student
  let contextData: any = {}
  if (req.user!.role === 'student') {
    const student = await prisma.student.findFirst({
      where: { userId },
      include: {
        programme: true,
        user: { select: { displayName: true } },
        enrolments: {
          where: { status: 'registered' },
          include: { offering: { include: { course: true } } },
        },
        feeInvoices: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
    })
    if (student) contextData = { student }
  }

  // Load previous conversation history for context
  let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
  let existingConversation: any = null

  if (conversationId) {
    existingConversation = await prisma.chatbotConversation.findUnique({ where: { id: conversationId } })
    if (existingConversation) {
      try {
        const prev = JSON.parse(existingConversation.messages)
        // Extract last 10 messages for LLM context (skip timestamps)
        conversationHistory = prev.slice(-10).map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      } catch { /* ignore parse errors */ }
    }
  }

  // Call AI service (real LLM or demo fallback)
  const answer = await chat(message, contextData, conversationHistory)

  // Persist conversation
  const newMessages = [
    { role: 'user',      content: message, timestamp: new Date().toISOString() },
    { role: 'assistant', content: answer,  timestamp: new Date().toISOString() },
  ]

  let conversation
  if (existingConversation) {
    const prev = JSON.parse(existingConversation.messages)
    conversation = await prisma.chatbotConversation.update({
      where: { id: conversationId! },
      data: {
        messages:       JSON.stringify([...prev, ...newMessages]),
        lastActivityAt: new Date(),
        contextData:    JSON.stringify(contextData),
      },
    })
  } else {
    conversation = await prisma.chatbotConversation.create({
      data: {
        userId,
        messages:       JSON.stringify(newMessages),
        contextData:    JSON.stringify(contextData),
        lastActivityAt: new Date(),
      },
    })
  }

  res.json({
    success: true,
    data: { answer, conversationId: conversation.id, sources: Object.keys(contextData) },
  })
})

// GET /api/v1/ai/risk-dashboard/:offeringId
router.get('/risk-dashboard/:offeringId', async (req: AuthRequest, res: Response) => {
  const scores = await prisma.studentRiskScore.findMany({
    where: { offeringId: req.params.offeringId },
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
    where: { id: offeringId },
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

  const results = []

  for (const { studentId } of offering.enrolments) {
    // Attendance rate
    const presentCount = await prisma.attendanceRecord.count({
      where: { studentId, session: { offeringId }, status: 'present' },
    })
    const attendancePct = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 100

    // Submission rate
    const submissionsCount = await prisma.submission.count({
      where: { studentId, assignment: { offeringId } },
    })
    const submissionRate = totalAssignments > 0 ? (submissionsCount / totalAssignments) * 100 : 100

    // Quiz average from graded submissions (normalised to 0-100)
    const gradedSubmissions = await prisma.submission.findMany({
      where: { studentId, assignment: { offeringId }, finalMarks: { not: null } },
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
      where: { studentId_offeringId: { studentId, offeringId } },
      create: {
        studentId, offeringId,
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
