/**
 * Unit tests for admissions routes
 * Covers: POST /admissions/apply duplicate-IC logic
 *         GET  /admissions/intakes
 *         GET  /admissions/stats
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import { createServer, type Server } from 'node:http'

// ── Mock auth middleware ───────────────────────────────────────────────────────
vi.mock('../middleware/auth', () => ({
  authenticate:  (_req: any, _res: any, next: any) => next(),
  requireRole:   () => (_req: any, _res: any, next: any) => next(),
}))

// ── Shared mock Prisma client ─────────────────────────────────────────────────
const mockPrisma = {
  applicant:             { findFirst: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  applicantSubjectGrade: { deleteMany: vi.fn(), create: vi.fn() },
  intake:                { findMany: vi.fn() },
}

vi.mock('../lib/prisma', () => ({ default: mockPrisma }))

// ── Test server setup ─────────────────────────────────────────────────────────
async function buildTestServer() {
  const { default: admissionsRoutes } = await import('../routes/admissions')
  const app = express()
  app.use(express.json())
  app.use('/admissions', admissionsRoutes)
  return app
}

async function startServer(app: express.Express): Promise<{ server: Server; url: string }> {
  return new Promise(resolve => {
    const server = createServer(app)
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      resolve({ server, url: `http://127.0.0.1:${port}` })
    })
  })
}

// ── Shared valid apply payload ────────────────────────────────────────────────
const validPayload = {
  fullName:             'Siti Aminah binti Haji',
  icPassport:           'IC-900101-12-3456',
  dateOfBirth:          '1990-01-01',
  gender:               'female',
  nationality:          'Brunei Darussalam',
  email:                'siti@example.com',
  mobile:               '6731234567',
  homeAddress:          'No. 1, Jalan Mulia, Bandar Seri Begawan',
  highestQualification: 'A_LEVEL',
  previousInstitution:  'Sekolah Menengah Raja Isteri',
  yearOfCompletion:     '2010',
  cgpa:                 '3.75',
  intakeId:             'intake-001',
  programmeId:          'prog-001',
  modeOfStudy:          'full_time',
  scholarshipApplied:   false,
}

const fakeApplicant = {
  id:             'app-uuid-1',
  applicationRef: 'APP-2026-1234',
  ...validPayload,
  dateOfBirth:    new Date('1990-01-01'),
  yearOfCompletion: 2010,
  cgpa:           3.75,
  status:         'submitted',
  submittedAt:    new Date(),
  createdAt:      new Date(),
}

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /admissions/apply', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  // ── Happy path: brand new applicant ──────────────────────────────────────
  it('creates application and returns applicationRef for new IC', async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue(null)          // no existing
    mockPrisma.applicant.upsert.mockResolvedValue(fakeApplicant)

    const res  = await fetch(`${url}/admissions/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(validPayload),
    })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.applicationRef).toBe('APP-2026-1234')
    expect(body.message).toMatch(/APP-2026-1234/)
    expect(mockPrisma.applicant.upsert).toHaveBeenCalledOnce()
  })

  // ── Re-submit: same IC with status 'submitted' → now allowed (upsert) ───
  it('allows re-submission when existing application is in submitted status', async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue({ ...fakeApplicant, status: 'submitted' })
    mockPrisma.applicant.upsert.mockResolvedValue({ ...fakeApplicant, status: 'submitted' })

    const res  = await fetch(`${url}/admissions/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(validPayload),
    })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.applicant.upsert).toHaveBeenCalledOnce()
  })

  // ── Re-submit: same IC with status 'rejected' → allowed ─────────────────
  it('allows re-submission when previous application was rejected', async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue({ ...fakeApplicant, status: 'rejected' })
    mockPrisma.applicant.upsert.mockResolvedValue({ ...fakeApplicant, status: 'submitted' })

    const res  = await fetch(`${url}/admissions/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(validPayload),
    })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.applicant.upsert).toHaveBeenCalledOnce()
  })

  // ── Re-submit: same IC with status 'draft' → allowed ────────────────────
  it('allows re-submission when existing application is still a draft', async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue({ ...fakeApplicant, status: 'draft' })
    mockPrisma.applicant.upsert.mockResolvedValue({ ...fakeApplicant, status: 'submitted' })

    const res  = await fetch(`${url}/admissions/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(validPayload),
    })
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  // ── Hard block: already accepted (enrolled student) ──────────────────────
  it('returns 400 when applicant is already accepted (enrolled)', async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue({ ...fakeApplicant, status: 'accepted' })

    const res  = await fetch(`${url}/admissions/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(validPayload),
    })
    const body = await res.json() as any

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/enrolled student/i)
    expect(body.message).toMatch(/APP-2026-1234/)        // ref included in message
    expect(mockPrisma.applicant.upsert).not.toHaveBeenCalled()
  })

  // ── Subject grades are upserted correctly ────────────────────────────────
  it('deletes old grades and inserts new ones when subjectGrades provided', async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue(null)
    mockPrisma.applicant.upsert.mockResolvedValue(fakeApplicant)
    mockPrisma.applicantSubjectGrade.deleteMany.mockResolvedValue({ count: 2 })
    mockPrisma.applicantSubjectGrade.create.mockResolvedValue({})

    const payload = {
      ...validPayload,
      subjectGrades: [
        { subjectName: 'Mathematics', grade: 'A', qualificationType: 'A_LEVEL' },
        { subjectName: 'Physics',     grade: 'B', qualificationType: 'A_LEVEL' },
      ],
    }

    const res = await fetch(`${url}/admissions/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    expect(mockPrisma.applicantSubjectGrade.deleteMany).toHaveBeenCalledWith({ where: { applicantId: 'app-uuid-1' } })
    expect(mockPrisma.applicantSubjectGrade.create).toHaveBeenCalledTimes(2)
  })

  // ── No grades inserted when subjectGrades is absent ──────────────────────
  it('skips grade upsert when subjectGrades is not provided', async () => {
    mockPrisma.applicant.findFirst.mockResolvedValue(null)
    mockPrisma.applicant.upsert.mockResolvedValue(fakeApplicant)

    await fetch(`${url}/admissions/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(validPayload),      // no subjectGrades field
    })

    expect(mockPrisma.applicantSubjectGrade.deleteMany).not.toHaveBeenCalled()
    expect(mockPrisma.applicantSubjectGrade.create).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admissions/intakes', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  it('returns only open intakes', async () => {
    const openIntake = {
      id: 'intake-001', isOpen: true,
      programme: { id: 'prog-001', name: 'BSc Computer Science', code: 'BSC-CS' },
      semester:  { id: 'sem-1', name: 'Semester 1 2026' },
      intakeStart: '2026-03-01', maxCapacity: 30,
    }
    mockPrisma.intake.findMany.mockResolvedValue([openIntake])

    const res  = await fetch(`${url}/admissions/intakes`)
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].isOpen).toBe(true)
    expect(mockPrisma.intake.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isOpen: true } })
    )
  })

  it('returns empty array when no intakes are open', async () => {
    mockPrisma.intake.findMany.mockResolvedValue([])

    const res  = await fetch(`${url}/admissions/intakes`)
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admissions/stats', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  it('returns aggregated application counts by status', async () => {
    mockPrisma.applicant.count
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(4)    // submitted
      .mockResolvedValueOnce(2)    // under_review
      .mockResolvedValueOnce(3)    // accepted
      .mockResolvedValueOnce(1)    // rejected
      .mockResolvedValueOnce(0)    // waitlisted

    const res  = await fetch(`${url}/admissions/stats`)
    const body = await res.json() as any

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      total:       10,
      submitted:   4,
      underReview: 2,
      accepted:    3,
      rejected:    1,
      waitlisted:  0,
    })
  })

  it('counts are non-negative even with empty database', async () => {
    mockPrisma.applicant.count.mockResolvedValue(0)

    const res  = await fetch(`${url}/admissions/stats`)
    const body = await res.json() as any

    expect(res.status).toBe(200)
    Object.values(body.data as Record<string, number>).forEach(v =>
      expect(v).toBeGreaterThanOrEqual(0)
    )
  })
})
