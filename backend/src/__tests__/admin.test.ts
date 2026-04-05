/**
 * Unit tests for admin routes
 * Covers: GET /courses, DELETE /enrolments/:id, POST /demo-reset
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import { createServer, type Server } from 'node:http'

// ── Mock auth middleware (bypass JWT checks) ──────────────────────────────────
vi.mock('../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}))

// ── Shared mock Prisma client ─────────────────────────────────────────────────
const mockPrisma = {
  department:          { findMany: vi.fn() },
  course:              { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  courseOffering:      { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  enrolment:           { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  payment:             { deleteMany: vi.fn() },
  feeInvoice:          { deleteMany: vi.fn() },
  submission:          { deleteMany: vi.fn() },
  fileAsset:           { deleteMany: vi.fn() },
  invoiceAdjustment:   { deleteMany: vi.fn() },
  attendanceRecord:    { deleteMany: vi.fn() },
  attendanceSession:   { deleteMany: vi.fn() },
  student:             { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  studentGpaRecord:    { deleteMany: vi.fn() },
  studentRiskScore:    { deleteMany: vi.fn() },
  campusCard:          { deleteMany: vi.fn() },
  campusCardTransaction:{ deleteMany: vi.fn() },
  libraryAccount:      { upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  user:                { deleteMany: vi.fn() },
  applicant:           { deleteMany: vi.fn() },
  chatbotConversation: { deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
}

vi.mock('../lib/prisma', () => ({ default: mockPrisma }))

// ── Test server setup ─────────────────────────────────────────────────────────
async function buildTestServer() {
  const { default: adminRoutes } = await import('../routes/admin')
  const app = express()
  app.use(express.json())
  app.use('/admin', adminRoutes)
  return app
}

async function startServer(app: express.Express): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(app)
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      resolve({ server, url: `http://127.0.0.1:${port}` })
    })
  })
}

// helper: configure all mocks needed for a successful demo-reset
function setupDemoResetMocks() {
  mockPrisma.attendanceRecord.deleteMany.mockResolvedValue({ count: 12 })
  mockPrisma.attendanceSession.deleteMany.mockResolvedValue({ count: 3 })
  mockPrisma.submission.deleteMany.mockResolvedValue({ count: 1 })
  mockPrisma.fileAsset.deleteMany.mockResolvedValue({ count: 1 })
  mockPrisma.payment.deleteMany.mockResolvedValue({ count: 0 })
  mockPrisma.invoiceAdjustment.deleteMany.mockResolvedValue({ count: 0 })
  mockPrisma.feeInvoice.deleteMany.mockResolvedValue({ count: 2 })
  mockPrisma.enrolment.deleteMany.mockResolvedValue({ count: 26 })
  mockPrisma.courseOffering.updateMany.mockResolvedValue({ count: 6 })
  mockPrisma.studentGpaRecord.deleteMany.mockResolvedValue({ count: 12 })
  mockPrisma.studentRiskScore.deleteMany.mockResolvedValue({ count: 5 })
  mockPrisma.campusCardTransaction.deleteMany.mockResolvedValue({ count: 0 })
  mockPrisma.campusCard.deleteMany.mockResolvedValue({ count: 12 })
  mockPrisma.libraryAccount.deleteMany.mockResolvedValue({ count: 12 })
  mockPrisma.student.deleteMany.mockResolvedValue({ count: 12 })
  mockPrisma.user.deleteMany.mockResolvedValue({ count: 12 })
  mockPrisma.applicant.deleteMany.mockResolvedValue({ count: 5 })
  mockPrisma.chatbotConversation.deleteMany.mockResolvedValue({ count: 0 })
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/courses', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  it('returns totalEnrolled computed from nested offering counts', async () => {
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: 'c1', code: 'IFN101', name: 'Intro to Informatics',
        departmentId: 'd1', creditHours: 3, level: 1,
        isOpenToInternational: true, maxSeats: 40, createdAt: new Date(),
        _count: { offerings: 2 },
        offerings: [
          { _count: { enrolments: 5 } },
          { _count: { enrolments: 3 } },
        ],
      },
    ])

    const res = await fetch(`${url}/admin/courses`)
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].totalEnrolled).toBe(8)           // 5 + 3
    expect(body.data[0]).not.toHaveProperty('offerings') // stripped from response
  })

  it('returns totalEnrolled = 0 when no offerings', async () => {
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: 'c2', code: 'IFN201', name: 'Advanced Informatics',
        departmentId: 'd1', creditHours: 3, level: 2,
        isOpenToInternational: false, maxSeats: 30, createdAt: new Date(),
        _count: { offerings: 0 },
        offerings: [],
      },
    ])

    const res = await fetch(`${url}/admin/courses`)
    const body = await res.json() as any

    expect(body.data[0].totalEnrolled).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /admin/enrolments/:enrolmentId', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  it('deletes enrolment and decrements seatsTaken when seatsTaken > 0', async () => {
    const fakeEnrolment = { id: 'e1', offeringId: 'o1', studentId: 's1', status: 'registered' }
    mockPrisma.enrolment.findUnique.mockResolvedValue(fakeEnrolment)
    mockPrisma.enrolment.delete.mockResolvedValue(fakeEnrolment)
    mockPrisma.courseOffering.updateMany.mockResolvedValue({ count: 1 })

    const res = await fetch(`${url}/admin/enrolments/e1`, { method: 'DELETE' })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.enrolment.delete).toHaveBeenCalledWith({ where: { id: 'e1' } })
    expect(mockPrisma.courseOffering.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', seatsTaken: { gt: 0 } },
      data: { seatsTaken: { decrement: 1 } },
    })
  })

  it('still deletes enrolment even when seatsTaken is 0 (updateMany skips silently)', async () => {
    const fakeEnrolment = { id: 'e2', offeringId: 'o2', studentId: 's2', status: 'registered' }
    mockPrisma.enrolment.findUnique.mockResolvedValue(fakeEnrolment)
    mockPrisma.enrolment.delete.mockResolvedValue(fakeEnrolment)
    mockPrisma.courseOffering.updateMany.mockResolvedValue({ count: 0 })

    const res = await fetch(`${url}/admin/enrolments/e2`, { method: 'DELETE' })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.enrolment.delete).toHaveBeenCalledWith({ where: { id: 'e2' } })
    expect(mockPrisma.courseOffering.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ seatsTaken: { gt: 0 } }) })
    )
  })

  it('returns 404 when enrolment does not exist', async () => {
    mockPrisma.enrolment.findUnique.mockResolvedValue(null)

    const res = await fetch(`${url}/admin/enrolments/nonexistent`, { method: 'DELETE' })
    const body = await res.json() as any

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(mockPrisma.enrolment.delete).not.toHaveBeenCalled()
    expect(mockPrisma.courseOffering.updateMany).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /admin/demo-reset', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  it('returns 200 with success message', async () => {
    setupDemoResetMocks()
    const res = await fetch(`${url}/admin/demo-reset`, { method: 'POST' })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/reset/i)
  })

  it('deletes attendance records before attendance sessions (FK order)', async () => {
    setupDemoResetMocks()
    const order: string[] = []
    mockPrisma.attendanceRecord.deleteMany.mockImplementation(async () => {
      order.push('attendanceRecord')
      return { count: 0 }
    })
    mockPrisma.attendanceSession.deleteMany.mockImplementation(async () => {
      order.push('attendanceSession')
      return { count: 0 }
    })

    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(order.indexOf('attendanceRecord')).toBeLessThan(order.indexOf('attendanceSession'))
  })

  it('clears all attendance sessions and records', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.attendanceRecord.deleteMany).toHaveBeenCalledWith({})
    expect(mockPrisma.attendanceSession.deleteMany).toHaveBeenCalledWith({})
  })

  it('clears all submissions', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.submission.deleteMany).toHaveBeenCalledWith({})
  })

  it('clears all payments, invoices, and enrolments', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.payment.deleteMany).toHaveBeenCalledWith({})
    expect(mockPrisma.feeInvoice.deleteMany).toHaveBeenCalledWith({})
    expect(mockPrisma.enrolment.deleteMany).toHaveBeenCalledWith({})
  })

  it('resets seatsTaken to 0 for all offerings', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.courseOffering.updateMany).toHaveBeenCalledWith({ data: { seatsTaken: 0 } })
  })

  it('deletes library accounts, student records, and student user accounts', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.libraryAccount.deleteMany).toHaveBeenCalledWith({})
    expect(mockPrisma.student.deleteMany).toHaveBeenCalledWith({})
    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({ where: { role: 'student' } })
  })

  it('deletes all applicant records (cascades subject grades and documents)', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.applicant.deleteMany).toHaveBeenCalledWith({})
  })

  it('deletes students and applicants after enrolments are cleared (FK order)', async () => {
    setupDemoResetMocks()
    const order: string[] = []
    mockPrisma.enrolment.deleteMany.mockImplementation(async () => { order.push('enrolment'); return { count: 0 } })
    mockPrisma.student.deleteMany.mockImplementation(async () => { order.push('student'); return { count: 0 } })
    mockPrisma.applicant.deleteMany.mockImplementation(async () => { order.push('applicant'); return { count: 0 } })

    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(order.indexOf('enrolment')).toBeLessThan(order.indexOf('student'))
    expect(order.indexOf('student')).toBeLessThan(order.indexOf('applicant'))
  })

  it('only deletes users with role student, not staff or admin accounts', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'student' } })
    )
  })

  it('clears chatbot conversations', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.chatbotConversation.deleteMany).toHaveBeenCalledWith({})
  })

  it('does not create any new records (pure wipe, no re-seed)', async () => {
    setupDemoResetMocks()
    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.enrolment.create).not.toHaveBeenCalled()
    expect(mockPrisma.feeInvoice.upsert ?? vi.fn()).not.toHaveBeenCalled()
  })
})
