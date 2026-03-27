/**
 * Unit tests for admin course management routes
 * Covers: GET /courses (totalEnrolled), DELETE /enrolments/:id (seatsTaken protection)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import { createServer, type Server } from 'node:http'

// ── Mock auth middleware (bypass JWT checks) ──────────────────────────────────
vi.mock('../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}))

// ── Mock Prisma client ────────────────────────────────────────────────────────
const mockPrisma = {
  department: { findMany: vi.fn() },
  course:     { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  courseOffering: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  enrolment: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
}

vi.mock('../lib/prisma', () => ({ default: mockPrisma }))

// ── Test server setup ─────────────────────────────────────────────────────────
async function buildTestServer() {
  // Import after mocks are registered
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
    expect(body.data[0].totalEnrolled).toBe(8)        // 5 + 3
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

    // enrolment.delete called with correct id
    expect(mockPrisma.enrolment.delete).toHaveBeenCalledWith({ where: { id: 'e1' } })

    // updateMany called with gt:0 guard to prevent negative seatsTaken
    expect(mockPrisma.courseOffering.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', seatsTaken: { gt: 0 } },
      data: { seatsTaken: { decrement: 1 } },
    })
  })

  it('still deletes enrolment even when seatsTaken is 0 (updateMany skips silently)', async () => {
    const fakeEnrolment = { id: 'e2', offeringId: 'o2', studentId: 's2', status: 'registered' }
    mockPrisma.enrolment.findUnique.mockResolvedValue(fakeEnrolment)
    mockPrisma.enrolment.delete.mockResolvedValue(fakeEnrolment)
    // updateMany with gt:0 finds no rows → count: 0 (no decrement applied)
    mockPrisma.courseOffering.updateMany.mockResolvedValue({ count: 0 })

    const res = await fetch(`${url}/admin/enrolments/e2`, { method: 'DELETE' })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    // Enrolment is deleted regardless
    expect(mockPrisma.enrolment.delete).toHaveBeenCalledWith({ where: { id: 'e2' } })
    // updateMany still called with the guard — it just matches 0 rows, seatsTaken stays ≥ 0
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
    // Neither delete nor updateMany should be called
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
    mockPrisma.enrolment.deleteMany.mockResolvedValue({ count: 4 })
    mockPrisma.courseOffering.updateMany.mockResolvedValue({ count: 5 })

    const res = await fetch(`${url}/admin/demo-reset`, { method: 'POST' })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/reset/i)
  })

  it('calls enrolment.deleteMany with no filter to wipe all records', async () => {
    mockPrisma.enrolment.deleteMany.mockResolvedValue({ count: 4 })
    mockPrisma.courseOffering.updateMany.mockResolvedValue({ count: 5 })

    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.enrolment.deleteMany).toHaveBeenCalledWith({})
  })

  it('calls courseOffering.updateMany to reset seatsTaken to 0', async () => {
    mockPrisma.enrolment.deleteMany.mockResolvedValue({ count: 4 })
    mockPrisma.courseOffering.updateMany.mockResolvedValue({ count: 5 })

    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    expect(mockPrisma.courseOffering.updateMany).toHaveBeenCalledWith({ data: { seatsTaken: 0 } })
  })

  it('wraps both operations in a single transaction', async () => {
    mockPrisma.enrolment.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.courseOffering.updateMany.mockResolvedValue({ count: 0 })

    await fetch(`${url}/admin/demo-reset`, { method: 'POST' })

    // $transaction must be called once with an array of exactly 2 promises
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
    const [ops] = mockPrisma.$transaction.mock.calls[0]
    expect(Array.isArray(ops)).toBe(true)
    expect(ops).toHaveLength(2)
  })
})
