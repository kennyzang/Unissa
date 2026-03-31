/**
 * 入学申请场景测试用例
 * 测试范围：
 * 1. 入学申请表单提交
 * 2. 申请状态查询
 * 3. 申请审核流程
 * 4. 边界条件和异常情况
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import { createServer, type Server } from 'node:http'

vi.mock('../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}))

const mockPrisma = {
  applicant: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  programme: { findFirst: vi.fn(), findMany: vi.fn() },
  intake: { findFirst: vi.fn(), findMany: vi.fn() },
  user: { findFirst: vi.fn(), create: vi.fn() },
  applicantSubjectGrade: { createMany: vi.fn(), deleteMany: vi.fn() },
  applicantDocument: { createMany: vi.fn(), deleteMany: vi.fn() },
  fileAsset: { create: vi.fn() },
}

vi.mock('../lib/prisma', () => ({ default: mockPrisma }))

async function buildTestServer() {
  const { default: admissionsRoutes } = await import('../routes/admissions')
  const app = express()
  app.use(express.json())
  app.use('/admissions', admissionsRoutes)
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

const fakeProgramme = {
  id: 'prog1',
  code: 'CS101',
  name: 'Computer Science',
  level: 'degree',
  feeLocalPerCh: 800,
  feeInternationalPerCh: 1200,
}

const fakeIntake = {
  id: 'intake1',
  programmeId: 'prog1',
  semesterId: 'sem1',
  intakeStart: new Date('2026-09-01'),
  intakeEnd: new Date('2026-09-30'),
  isOpen: true,
  maxCapacity: 100,
}

const fakeApplicant = {
  id: 'app1',
  applicationRef: 'APP-2026-0001',
  fullName: 'Test Applicant',
  icPassport: '1234567890',
  dateOfBirth: new Date('2000-01-01'),
  gender: 'male',
  nationality: 'Brunei Darussalam',
  email: 'test@example.com',
  mobile: '+67312345678',
  homeAddress: 'Test Address',
  highestQualification: 'diploma',
  previousInstitution: 'Test Institution',
  yearOfCompletion: 2020,
  cgpa: 3.5,
  intakeId: 'intake1',
  programmeId: 'prog1',
  modeOfStudy: 'full_time',
  scholarshipApplied: false,
  status: 'draft',
}

describe('入学申请场景测试', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  describe('POST /admissions/apply - 入学申请提交', () => {
    it('应该成功提交完整的入学申请', async () => {
      mockPrisma.programme.findFirst.mockResolvedValue(fakeProgramme)
      mockPrisma.intake.findFirst.mockResolvedValue(fakeIntake)
      mockPrisma.applicant.findFirst.mockResolvedValue(null)
      mockPrisma.applicant.create.mockResolvedValue(fakeApplicant)

      const res = await fetch(`${url}/admissions/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test Applicant',
          icPassport: '1234567890',
          dateOfBirth: '2000-01-01',
          gender: 'male',
          nationality: 'Brunei Darussalam',
          email: 'test@example.com',
          mobile: '+67312345678',
          homeAddress: 'Test Address',
          highestQualification: 'diploma',
          previousInstitution: 'Test Institution',
          yearOfCompletion: 2020,
          cgpa: 3.5,
          intakeId: 'intake1',
          programmeId: 'prog1',
          modeOfStudy: 'full_time',
          scholarshipApplied: false,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data.applicationRef).toBeDefined()
    })

    it('应该拒绝重复的身份证号码申请', async () => {
      mockPrisma.programme.findFirst.mockResolvedValue(fakeProgramme)
      mockPrisma.intake.findFirst.mockResolvedValue(fakeIntake)
      mockPrisma.applicant.findFirst.mockResolvedValue(fakeApplicant)

      const res = await fetch(`${url}/admissions/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test Applicant',
          icPassport: '1234567890',
          dateOfBirth: '2000-01-01',
          gender: 'male',
          nationality: 'Brunei Darussalam',
          email: 'test2@example.com',
          mobile: '+67312345679',
          homeAddress: 'Test Address',
          highestQualification: 'diploma',
          previousInstitution: 'Test Institution',
          yearOfCompletion: 2020,
          cgpa: 3.5,
          intakeId: 'intake1',
          programmeId: 'prog1',
          modeOfStudy: 'full_time',
          scholarshipApplied: false,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/already exists/i)
    })

    it('应该拒绝无效的 CGPA 值（超出范围）', async () => {
      mockPrisma.programme.findFirst.mockResolvedValue(fakeProgramme)
      mockPrisma.intake.findFirst.mockResolvedValue(fakeIntake)
      mockPrisma.applicant.findFirst.mockResolvedValue(null)

      const res = await fetch(`${url}/admissions/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test Applicant',
          icPassport: '1234567890',
          dateOfBirth: '2000-01-01',
          gender: 'male',
          nationality: 'Brunei Darussalam',
          email: 'test@example.com',
          mobile: '+67312345678',
          homeAddress: 'Test Address',
          highestQualification: 'diploma',
          previousInstitution: 'Test Institution',
          yearOfCompletion: 2020,
          cgpa: 5.0,
          intakeId: 'intake1',
          programmeId: 'prog1',
          modeOfStudy: 'full_time',
          scholarshipApplied: false,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/cgpa/i)
    })

    it('应该拒绝已关闭的入学批次申请', async () => {
      mockPrisma.programme.findFirst.mockResolvedValue(fakeProgramme)
      mockPrisma.intake.findFirst.mockResolvedValue({ ...fakeIntake, isOpen: false })

      const res = await fetch(`${url}/admissions/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test Applicant',
          icPassport: '1234567890',
          dateOfBirth: '2000-01-01',
          gender: 'male',
          nationality: 'Brunei Darussalam',
          email: 'test@example.com',
          mobile: '+67312345678',
          homeAddress: 'Test Address',
          highestQualification: 'diploma',
          previousInstitution: 'Test Institution',
          yearOfCompletion: 2020,
          cgpa: 3.5,
          intakeId: 'intake1',
          programmeId: 'prog1',
          modeOfStudy: 'full_time',
          scholarshipApplied: false,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/closed/i)
    })

    it('应该拒绝缺少必填字段的申请', async () => {
      const res = await fetch(`${url}/admissions/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test Applicant',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
    })
  })

  describe('GET /admissions/my-application - 查询我的申请', () => {
    it('应该成功返回用户的申请信息', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(fakeApplicant)

      const res = await fetch(`${url}/admissions/my-application?userId=user1`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.fullName).toBe('Test Applicant')
    })

    it('应该返回 404 当用户没有申请记录时', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(null)

      const res = await fetch(`${url}/admissions/my-application?userId=user1`)
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/no application found/i)
    })
  })

  describe('PATCH /admissions/:id/status - 更新申请状态', () => {
    it('应该成功更新申请状态为已录取', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(fakeApplicant)
      mockPrisma.applicant.update.mockResolvedValue({ ...fakeApplicant, status: 'accepted' })

      const res = await fetch(`${url}/admissions/app1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('accepted')
    })

    it('应该拒绝无效的状态值', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(fakeApplicant)

      const res = await fetch(`${url}/admissions/app1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid_status' }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
    })

    it('应该拒绝更新不存在的申请', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(null)

      const res = await fetch(`${url}/admissions/nonexistent/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
    })
  })

  describe('GET /admissions - 查询申请列表', () => {
    it('应该成功返回申请列表', async () => {
      mockPrisma.applicant.findMany.mockResolvedValue([fakeApplicant])

      const res = await fetch(`${url}/admissions`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
    })

    it('应该支持按状态筛选', async () => {
      mockPrisma.applicant.findMany.mockResolvedValue([fakeApplicant])

      const res = await fetch(`${url}/admissions?status=draft`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockPrisma.applicant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'draft' }),
        })
      )
    })

    it('应该支持分页查询', async () => {
      mockPrisma.applicant.findMany.mockResolvedValue([fakeApplicant])

      const res = await fetch(`${url}/admissions?page=1&limit=10`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })
})
