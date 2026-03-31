/**
 * 成绩同步与 GPA 更新场景测试用例
 * 测试范围：
 * 1. GPA 计算逻辑
 * 2. 成绩等级转换
 * 3. 学期 GPA 与累计 GPA
 * 4. 成绩同步至 UMS 成绩单
 * 5. 边界条件和异常情况
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
  enrolment: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  submission: {
    update: vi.fn(),
  },
  studentGpaRecord: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    findFirst: vi.fn(),
  },
  assignment: {
    findUnique: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
}

vi.mock('../lib/prisma', () => ({ default: mockPrisma }))

async function buildTestServer() {
  const { default: lmsRoutes } = await import('../routes/lms')
  const app = express()
  app.use(express.json())
  app.use('/lms', lmsRoutes)
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
  currentCgpa: 3.5,
  user: { displayName: 'Noor Aisyah' },
}

const fakeAssignment = {
  id: 'a1',
  offeringId: 'off1',
  title: 'Assignment 1',
  maxMarks: 100,
  offering: {
    id: 'off1',
    course: { id: 'c1', code: 'IFN101', name: 'Introduction to Programming', creditHours: 3 },
    semester: { id: 'sem1', name: 'September 2026' },
    lecturer: { userId: 'u2' },
  },
}

describe('成绩同步与 GPA 更新场景测试', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  describe('GPA 计算逻辑', () => {
    it('应该正确计算单门课程的 GPA', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 85,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A', gradePoints: 4.0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([
        { gradePoints: 4.0, offering: { course: { creditHours: 3 } } },
      ])
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, currentCgpa: 4.0 })
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 85,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.currentGpa).toBe(4.0)
    })

    it('应该正确计算多门课程的加权 GPA', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 85,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A', gradePoints: 4.0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([
        { gradePoints: 4.0, offering: { course: { creditHours: 3 } } },
        { gradePoints: 3.67, offering: { course: { creditHours: 3 } } },
        { gradePoints: 3.33, offering: { course: { creditHours: 4 } } },
      ])
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, currentCgpa: 3.63 })
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 85,
        }),
      })
      const body = await res.json() as any

      const expectedGpa = (4.0 * 3 + 3.67 * 3 + 3.33 * 4) / (3 + 3 + 4)
      expect(body.data.currentGpa).toBeCloseTo(expectedGpa, 2)
    })

    it('应该正确处理无成绩的情况', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 85,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A', gradePoints: 4.0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([])
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, currentCgpa: 0 })
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 85,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.currentGpa).toBe(0)
    })
  })

  describe('成绩等级转换', () => {
    it('应该正确转换 A+ 等级（90-100分）', async () => {
      const testCases = [90, 95, 100]
      
      for (const marks of testCases) {
        const gradedSubmission = {
          id: 'sub1',
          assignmentId: 'a1',
          studentId: 's1',
          finalMarks: marks,
          gradedAt: new Date(),
          gradedById: 'u2',
          assignment: fakeAssignment,
          student: { ...fakeStudent, userId: 'u1' },
        }

        mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
        mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A_plus', gradePoints: 4.0 })
        mockPrisma.enrolment.findMany.mockResolvedValue([])
        mockPrisma.student.update.mockResolvedValue(fakeStudent)
        mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
        mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

        const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructorScores: [],
            finalMarks: marks,
          }),
        })
        const body = await res.json() as any

        expect(body.data.grade).toBe('A_plus')
        expect(body.data.gradePoints).toBe(4.0)
      }
    })

    it('应该正确转换 A 等级（80-89分）', async () => {
      const testCases = [80, 85, 89]
      
      for (const marks of testCases) {
        const gradedSubmission = {
          id: 'sub1',
          assignmentId: 'a1',
          studentId: 's1',
          finalMarks: marks,
          gradedAt: new Date(),
          gradedById: 'u2',
          assignment: fakeAssignment,
          student: { ...fakeStudent, userId: 'u1' },
        }

        mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
        mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A', gradePoints: 4.0 })
        mockPrisma.enrolment.findMany.mockResolvedValue([])
        mockPrisma.student.update.mockResolvedValue(fakeStudent)
        mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
        mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

        const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructorScores: [],
            finalMarks: marks,
          }),
        })
        const body = await res.json() as any

        expect(body.data.grade).toBe('A')
        expect(body.data.gradePoints).toBe(4.0)
      }
    })

    it('应该正确转换 B+ 等级（75-79分）', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 77,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'B_plus', gradePoints: 3.67 })
      mockPrisma.enrolment.findMany.mockResolvedValue([])
      mockPrisma.student.update.mockResolvedValue(fakeStudent)
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 77,
        }),
      })
      const body = await res.json() as any

      expect(body.data.grade).toBe('B_plus')
      expect(body.data.gradePoints).toBe(3.67)
    })

    it('应该正确转换 F 等级（<50分）', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 45,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'F', gradePoints: 0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([])
      mockPrisma.student.update.mockResolvedValue(fakeStudent)
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 45,
        }),
      })
      const body = await res.json() as any

      expect(body.data.grade).toBe('F')
      expect(body.data.gradePoints).toBe(0)
    })
  })

  describe('学期 GPA 与累计 GPA', () => {
    it('应该正确创建学期 GPA 记录', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 85,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A', gradePoints: 4.0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([
        { gradePoints: 4.0, offering: { course: { creditHours: 3 } } },
      ])
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, currentCgpa: 4.0 })
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({
        id: 'gpa1',
        studentId: 's1',
        semesterId: 'sem1',
        semesterGpa: 4.0,
        cumulativeGpa: 4.0,
        totalChPassed: 3,
      })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 85,
        }),
      })

      expect(mockPrisma.studentGpaRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId_semesterId: {
              studentId: 's1',
              semesterId: 'sem1',
            },
          },
          create: expect.objectContaining({
            studentId: 's1',
            semesterId: 'sem1',
            semesterGpa: expect.any(Number),
            cumulativeGpa: expect.any(Number),
            totalChPassed: expect.any(Number),
          }),
        })
      )
    })

    it('应该更新现有学期 GPA 记录', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 85,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A', gradePoints: 4.0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([
        { gradePoints: 4.0, offering: { course: { creditHours: 3 } } },
        { gradePoints: 3.67, offering: { course: { creditHours: 3 } } },
      ])
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, currentCgpa: 3.83 })
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({
        id: 'gpa1',
        studentId: 's1',
        semesterId: 'sem1',
        semesterGpa: 3.83,
        cumulativeGpa: 3.83,
        totalChPassed: 6,
      })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 85,
        }),
      })

      expect(mockPrisma.studentGpaRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            semesterGpa: expect.any(Number),
            cumulativeGpa: expect.any(Number),
            totalChPassed: expect.any(Number),
          }),
        })
      )
    })
  })

  describe('成绩同步至 UMS 成绩单', () => {
    it('应该更新 enrolment 记录中的成绩', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 85,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({
        id: 'e1',
        studentId: 's1',
        offeringId: 'off1',
        finalGrade: 'A',
        gradePoints: 4.0,
      })
      mockPrisma.enrolment.findMany.mockResolvedValue([])
      mockPrisma.student.update.mockResolvedValue(fakeStudent)
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 85,
        }),
      })

      expect(mockPrisma.enrolment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId_offeringId: {
              studentId: 's1',
              offeringId: 'off1',
            },
          },
          data: {
            finalGrade: 'A',
            gradePoints: 4.0,
          },
        })
      )
    })

    it('应该更新学生的累计 GPA', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 85,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A', gradePoints: 4.0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([
        { gradePoints: 4.0, offering: { course: { creditHours: 3 } } },
      ])
      mockPrisma.student.update.mockResolvedValue({ ...fakeStudent, currentCgpa: 4.0 })
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 85,
        }),
      })

      expect(mockPrisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1' },
          data: { currentCgpa: expect.any(Number) },
        })
      )
    })
  })

  describe('边界条件和异常情况', () => {
    it('应该正确处理 0 分的情况', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 0,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'F', gradePoints: 0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([])
      mockPrisma.student.update.mockResolvedValue(fakeStudent)
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 0,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.grade).toBe('F')
      expect(body.data.gradePoints).toBe(0)
    })

    it('应该正确处理 100 分的情况', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 100,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A_plus', gradePoints: 4.0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([])
      mockPrisma.student.update.mockResolvedValue(fakeStudent)
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 100,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.grade).toBe('A_plus')
      expect(body.data.gradePoints).toBe(4.0)
    })

    it('应该正确处理小数分数', async () => {
      const gradedSubmission = {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        finalMarks: 85.5,
        gradedAt: new Date(),
        gradedById: 'u2',
        assignment: fakeAssignment,
        student: { ...fakeStudent, userId: 'u1' },
      }

      mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
      mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: 'A', gradePoints: 4.0 })
      mockPrisma.enrolment.findMany.mockResolvedValue([])
      mockPrisma.student.update.mockResolvedValue(fakeStudent)
      mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorScores: [],
          finalMarks: 85.5,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.grade).toBe('A')
    })
  })
})
