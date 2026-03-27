/**
 * Unit tests for POST /students/:id/register-courses
 * Focus: re-enrolment after admin drops a student from a course
 *
 * Bug that was fixed:
 *   CH validation only counted the submitted offeringIds, so a student re-adding
 *   a single dropped course (3 CH) failed the 12 CH minimum even though their
 *   total load (existing + new) was within limits.
 *
 * Fix:
 *   CH validation now fetches existing registered enrolments and adds them to
 *   the submitted CH before checking min/max bounds.
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
  student: { findFirst: vi.fn(), update: vi.fn() },
  courseOffering: { findMany: vi.fn(), findFirst: vi.fn() },
  enrolment: { findMany: vi.fn(), upsert: vi.fn() },
  feeInvoice: { upsert: vi.fn() },
  libraryAccount: { upsert: vi.fn() },
  semester: { findFirst: vi.fn() },
}

vi.mock('../lib/prisma', () => ({ default: mockPrisma }))

// ── Test server setup ─────────────────────────────────────────────────────────
async function buildTestServer() {
  const { default: studentRoutes } = await import('../routes/students')
  const app = express()
  app.use(express.json())
  app.use('/students', studentRoutes)
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

// ── Shared fixtures ───────────────────────────────────────────────────────────

const fakeStudent = {
  id: 's1',
  studentId: 'UNISSA-2024-001',
  currentCgpa: 3.0,
  studentType: 'standard',
  scholarshipPct: 0,
  nationality: 'Brunei Darussalam',
  campusCardNo: null,
  programme: { feeLocalPerCh: 800, feeInternationalPerCh: 1200 },
}

/** An offering worth 3 CH (the one that was dropped by admin) */
const droppedOffering = {
  id: 'o-dropped',
  courseId: 'c-dropped',
  semesterId: 'sem1',
  dayOfWeek: 'Monday',
  startTime: '08:00',
  endTime: '10:00',
  course: {
    id: 'c-dropped',
    code: 'IFN301',
    creditHours: 3,
    prerequisites: [],
  },
}

/** Three existing offerings (15 CH) the student is already registered for */
const existingOfferingIds = ['o1', 'o2', 'o3']
const existingEnrolments = existingOfferingIds.map((oid, i) => ({
  id: `e${i}`,
  studentId: 's1',
  offeringId: oid,
  status: 'registered',
  offering: { course: { creditHours: 5 } },
}))

function mockHappyPath(overrideExistingEnrolments = existingEnrolments) {
  // student lookup
  mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)

  // validate offerings (only the dropped one is being submitted)
  mockPrisma.courseOffering.findMany.mockResolvedValueOnce([droppedOffering])

  // prereq check: no completed enrolments
  mockPrisma.enrolment.findMany.mockResolvedValueOnce([])

  // existing registered enrolments (the ones NOT in offeringIds)
  mockPrisma.enrolment.findMany.mockResolvedValueOnce(overrideExistingEnrolments)

  // upsert creates the new enrolment
  mockPrisma.enrolment.upsert.mockResolvedValue({
    id: 'e-new',
    studentId: 's1',
    offeringId: 'o-dropped',
    status: 'registered',
  })

  // fee invoice
  mockPrisma.feeInvoice.upsert.mockResolvedValue({ id: 'inv1', invoiceNo: 'INV-2024-1234' })

  // student update (campus card / services)
  mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, campusCardNo: 'CC-2024001' })

  // library account
  mockPrisma.libraryAccount.upsert.mockResolvedValue({ id: 'lib1' })
}

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /students/:id/register-courses — re-enrolment after admin drop', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  // ── Core re-enrolment scenario ─────────────────────────────────────────────

  it('allows re-adding a single dropped course when existing enrolments cover minimum CH', async () => {
    // noor already has 15 CH in existing registered courses (3 × 5 CH)
    // admin dropped noor from 1 course (3 CH); total would be 15 + 3 = 18 CH ≤ maxCH(18) ✓
    mockHappyPath()

    const res = await fetch(`${url}/students/s1/register-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeringIds: ['o-dropped'], semesterId: 'sem1' }),
    })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.enrolments).toHaveLength(1)
    expect(body.data.enrolments[0].offeringId).toBe('o-dropped')
  })

  it('creates a new enrolment record (upsert) for the re-added course', async () => {
    mockHappyPath()

    await fetch(`${url}/students/s1/register-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeringIds: ['o-dropped'], semesterId: 'sem1' }),
    })

    expect(mockPrisma.enrolment.upsert).toHaveBeenCalledOnce()
    expect(mockPrisma.enrolment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_offeringId: { studentId: 's1', offeringId: 'o-dropped' } },
        create: expect.objectContaining({ studentId: 's1', offeringId: 'o-dropped', semesterId: 'sem1' }),
        update: { status: 'registered' },
      })
    )
  })

  it('charges fee only for the newly re-added course CH, not existing enrolments', async () => {
    mockHappyPath()

    const res = await fetch(`${url}/students/s1/register-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeringIds: ['o-dropped'], semesterId: 'sem1' }),
    })
    const body = await res.json() as any

    // totalCH in response should be 3 (new only), not 18 (combined)
    expect(body.data.totalCH).toBe(3)

    // feeInvoice.upsert should have been called with tuitionFee = 3 CH × 800
    expect(mockPrisma.feeInvoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tuitionFee: 2400 }), // 3 × 800
      })
    )
  })

  // ── CH boundary checks ─────────────────────────────────────────────────────

  it('rejects when combined CH (existing + new) exceeds maxCH', async () => {
    // existing 15 CH + new 6 CH = 21 CH; but student.currentCgpa = 3.0 so maxCH = 18 → reject
    const sixChOffering = {
      ...droppedOffering,
      course: { ...droppedOffering.course, creditHours: 6 },
    }

    mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
    mockPrisma.courseOffering.findMany.mockResolvedValueOnce([sixChOffering])
    mockPrisma.enrolment.findMany.mockResolvedValueOnce([])       // prereqs
    mockPrisma.enrolment.findMany.mockResolvedValueOnce(existingEnrolments) // existing (15 CH)

    const res = await fetch(`${url}/students/s1/register-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeringIds: ['o-dropped'], semesterId: 'sem1' }),
    })
    const body = await res.json() as any

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/credit hours/i)
    expect(mockPrisma.enrolment.upsert).not.toHaveBeenCalled()
  })

  it('rejects when combined CH is below minCH even with existing enrolments', async () => {
    // 0 existing + 3 new = 3 CH < minCH(12)  → still reject (no existing enrolments)
    mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
    mockPrisma.courseOffering.findMany.mockResolvedValueOnce([droppedOffering])
    mockPrisma.enrolment.findMany.mockResolvedValueOnce([])  // prereqs
    mockPrisma.enrolment.findMany.mockResolvedValueOnce([])  // no existing enrolments

    const res = await fetch(`${url}/students/s1/register-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeringIds: ['o-dropped'], semesterId: 'sem1' }),
    })
    const body = await res.json() as any

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/credit hours/i)
  })

  it('returns 404 when student is not found', async () => {
    mockPrisma.student.findFirst.mockResolvedValue(null)

    const res = await fetch(`${url}/students/nonexistent/register-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeringIds: ['o-dropped'], semesterId: 'sem1' }),
    })
    const body = await res.json() as any

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(mockPrisma.enrolment.upsert).not.toHaveBeenCalled()
  })
})
