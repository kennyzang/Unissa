/**
 * 选课注册场景测试用例
 * 测试范围：
 * 1. 选课注册流程
 * 2. 先修课程验证
 * 3. 时间冲突检测
 * 4. 学分限制验证
 * 5. 跨系统联动（LMS、图书馆、校园卡、财务）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import { createServer, type Server } from 'node:http'

vi.mock('../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}))

const mockPrisma = {
  student: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  courseOffering: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  enrolment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  course: {
    findFirst: vi.fn(),
  },
  semester: {
    findFirst: vi.fn(),
  },
  feeInvoice: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
  },
  libraryAccount: {
    upsert: vi.fn(),
  },
  campusCard: {
    create: vi.fn(),
  },
}

vi.mock('../lib/prisma', () => ({ default: mockPrisma }))

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

const fakeStudent = {
  id: 's1',
  studentId: '2026001',
  userId: 'u1',
  programmeId: 'prog1',
  intakeId: 'intake1',
  currentCgpa: 3.5,
  studentType: 'standard',
  scholarshipPct: 0,
  nationality: 'Brunei Darussalam',
  campusCardNo: null,
  programme: { feeLocalPerCh: 800, feeInternationalPerCh: 1200 },
}

const fakeSemester = {
  id: 'sem1',
  name: 'September 2026',
  academicYearId: 'ay1',
  semesterNumber: 1,
  startDate: new Date('2026-09-01'),
  endDate: new Date('2027-01-31'),
  addDropEnd: new Date('2026-09-15'),
  isActive: true,
}

const fakeOffering1 = {
  id: 'off1',
  courseId: 'c1',
  semesterId: 'sem1',
  lecturerId: 'l1',
  departmentId: 'd1',
  dayOfWeek: 'Monday',
  startTime: '09:00',
  endTime: '11:00',
  room: 'Room 101',
  seatsTaken: 10,
  course: {
    id: 'c1',
    code: 'IFN101',
    name: 'Introduction to Programming',
    creditHours: 3,
    prerequisites: [],
  },
}

const fakeOffering2 = {
  id: 'off2',
  courseId: 'c2',
  semesterId: 'sem1',
  lecturerId: 'l2',
  departmentId: 'd1',
  dayOfWeek: 'Wednesday',
  startTime: '09:00',
  endTime: '11:00',
  room: 'Room 102',
  seatsTaken: 15,
  course: {
    id: 'c2',
    code: 'IFN102',
    name: 'Data Structures',
    creditHours: 3,
    prerequisites: [{ courseId: 'c1', minGrade: 'C' }],
  },
}

const fakeOffering3 = {
  id: 'off3',
  courseId: 'c3',
  semesterId: 'sem1',
  lecturerId: 'l1',
  departmentId: 'd1',
  dayOfWeek: 'Monday',
  startTime: '10:00',
  endTime: '12:00',
  room: 'Room 103',
  seatsTaken: 5,
  course: {
    id: 'c3',
    code: 'IFN201',
    name: 'Database Systems',
    creditHours: 3,
    prerequisites: [],
  },
}

describe('选课注册场景测试', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  describe('POST /students/:id/register-courses - 选课注册', () => {
    it('应该成功注册符合条件的课程', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue([fakeOffering1, fakeOffering2])
      mockPrisma.enrolment.findMany
        .mockResolvedValueOnce([]) // 先修课程检查
        .mockResolvedValueOnce([]) // 现有注册课程
      mockPrisma.enrolment.upsert.mockResolvedValue({ id: 'e1', studentId: 's1', offeringId: 'off1', status: 'registered' })
      mockPrisma.feeInvoice.upsert.mockResolvedValue({ id: 'inv1', invoiceNo: 'INV-2026-0001' })
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, campusCardNo: 'CC-2026001' })
      mockPrisma.libraryAccount.upsert.mockResolvedValue({ id: 'lib1' })

      const res = await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off1', 'off2'],
          semesterId: 'sem1',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.enrolments).toHaveLength(2)
      expect(body.data.totalCH).toBe(6)
    })

    it('应该拒绝时间冲突的课程', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue([fakeOffering1, fakeOffering3]) // off1 和 off3 时间冲突

      const res = await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off1', 'off3'],
          semesterId: 'sem1',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/conflict/i)
    })

    it('应该拒绝未满足先修课程要求的课程', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue([fakeOffering2]) // IFN102 需要 IFN101 先修
      mockPrisma.enrolment.findMany.mockResolvedValue([]) // 没有完成 IFN101

      const res = await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off2'],
          semesterId: 'sem1',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/prerequisite/i)
    })

    it('应该拒绝学分不足的选课', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue([fakeOffering1])
      mockPrisma.enrolment.findMany
        .mockResolvedValueOnce([]) // 先修课程检查
        .mockResolvedValueOnce([]) // 现有注册课程

      const res = await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off1'],
          semesterId: 'sem1',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/credit hours/i)
    })

    it('应该拒绝学分超限的选课', async () => {
      const highCgpaStudent = { ...fakeStudent, currentCgpa: 3.8 }
      const manyOfferings = Array(7).fill(null).map((_, i) => ({
        ...fakeOffering1,
        id: `off${i}`,
        courseId: `c${i}`,
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i],
      }))

      mockPrisma.student.findFirst.mockResolvedValue(highCgpaStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue(manyOfferings)
      mockPrisma.enrolment.findMany
        .mockResolvedValueOnce([]) // 先修课程检查
        .mockResolvedValueOnce([]) // 现有注册课程

      const res = await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: manyOfferings.map(o => o.id),
          semesterId: 'sem1',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/credit hours/i)
    })

    it('应该自动激活图书馆账号', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue([fakeOffering1, fakeOffering2])
      mockPrisma.enrolment.findMany
        .mockResolvedValueOnce([]) // 先修课程检查
        .mockResolvedValueOnce([]) // 现有注册课程
      mockPrisma.enrolment.upsert.mockResolvedValue({ id: 'e1', studentId: 's1', offeringId: 'off1', status: 'registered' })
      mockPrisma.feeInvoice.upsert.mockResolvedValue({ id: 'inv1', invoiceNo: 'INV-2026-0001' })
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, campusCardNo: 'CC-2026001' })
      mockPrisma.libraryAccount.upsert.mockResolvedValue({ id: 'lib1', accountNo: 'LIB-2026001', isActive: true })

      await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off1', 'off2'],
          semesterId: 'sem1',
        }),
      })

      expect(mockPrisma.libraryAccount.upsert).toHaveBeenCalled()
    })

    it('应该自动生成校园卡', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue([fakeOffering1, fakeOffering2])
      mockPrisma.enrolment.findMany
        .mockResolvedValueOnce([]) // 先修课程检查
        .mockResolvedValueOnce([]) // 现有注册课程
      mockPrisma.enrolment.upsert.mockResolvedValue({ id: 'e1', studentId: 's1', offeringId: 'off1', status: 'registered' })
      mockPrisma.feeInvoice.upsert.mockResolvedValue({ id: 'inv1', invoiceNo: 'INV-2026-0001' })
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, campusCardNo: 'CC-2026001' })
      mockPrisma.libraryAccount.upsert.mockResolvedValue({ id: 'lib1' })

      await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off1', 'off2'],
          semesterId: 'sem1',
        }),
      })

      expect(mockPrisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            campusCardNo: expect.stringMatching(/^CC-\d{7}$/),
          }),
        })
      )
    })

    it('应该自动生成费用账单', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue([fakeOffering1, fakeOffering2])
      mockPrisma.enrolment.findMany
        .mockResolvedValueOnce([]) // 先修课程检查
        .mockResolvedValueOnce([]) // 现有注册课程
      mockPrisma.enrolment.upsert.mockResolvedValue({ id: 'e1', studentId: 's1', offeringId: 'off1', status: 'registered' })
      mockPrisma.feeInvoice.upsert.mockResolvedValue({ id: 'inv1', invoiceNo: 'INV-2026-0001' })
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, campusCardNo: 'CC-2026001' })
      mockPrisma.libraryAccount.upsert.mockResolvedValue({ id: 'lib1' })

      const res = await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off1', 'off2'],
          semesterId: 'sem1',
        }),
      })
      const body = await res.json() as any

      expect(mockPrisma.feeInvoice.upsert).toHaveBeenCalled()
      expect(body.data.invoice).toBeDefined()
    })

    it('应该正确计算奖学金减免', async () => {
      const scholarshipStudent = { ...fakeStudent, scholarshipPct: 50 }
      mockPrisma.student.findFirst.mockResolvedValue(scholarshipStudent)
      mockPrisma.semester.findFirst.mockResolvedValue(fakeSemester)
      mockPrisma.courseOffering.findMany.mockResolvedValue([fakeOffering1, fakeOffering2])
      mockPrisma.enrolment.findMany
        .mockResolvedValueOnce([]) // 先修课程检查
        .mockResolvedValueOnce([]) // 现有注册课程
      mockPrisma.enrolment.upsert.mockResolvedValue({ id: 'e1', studentId: 's1', offeringId: 'off1', status: 'registered' })
      mockPrisma.feeInvoice.upsert.mockResolvedValue({ id: 'inv1', invoiceNo: 'INV-2026-0001' })
      mockPrisma.student.update.mockResolvedValue({ ...scholarshipStudent, campusCardNo: 'CC-2026001' })
      mockPrisma.libraryAccount.upsert.mockResolvedValue({ id: 'lib1' })

      await fetch(`${url}/students/s1/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off1', 'off2'],
          semesterId: 'sem1',
        }),
      })

      expect(mockPrisma.feeInvoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            scholarshipDeduction: expect.any(Number),
          }),
        })
      )
    })

    it('应该返回 404 当学生不存在时', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null)

      const res = await fetch(`${url}/students/nonexistent/register-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringIds: ['off1'],
          semesterId: 'sem1',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
    })
  })

  describe('DELETE /students/:id/courses/:offeringId - 退课', () => {
    it('应该成功退课', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.enrolment.findFirst.mockResolvedValue({
        id: 'e1',
        studentId: 's1',
        offeringId: 'off1',
        status: 'registered',
      })
      mockPrisma.enrolment.delete.mockResolvedValue({ id: 'e1' })

      const res = await fetch(`${url}/students/s1/courses/off1`, {
        method: 'DELETE',
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('应该拒绝退选未注册的课程', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.enrolment.findFirst.mockResolvedValue(null)

      const res = await fetch(`${url}/students/s1/courses/off1`, {
        method: 'DELETE',
      })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
    })
  })
})
