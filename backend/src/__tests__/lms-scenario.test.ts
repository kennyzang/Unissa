/**
 * LMS 课程学习场景测试用例
 * 测试范围：
 * 1. 课程列表查询
 * 2. 课程资料展示
 * 3. 作业提交
 * 4. AI 评分生成
 * 5. 讲师评分
 * 6. 通知机制
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
  },
  enrolment: {
    findMany: vi.fn(),
  },
  courseMaterial: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  assignment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  submission: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  fileAsset: {
    create: vi.fn(),
  },
  notification: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  courseOffering: {
    findMany: vi.fn(),
  },
  staff: {
    findFirst: vi.fn(),
  },
  studentGpaRecord: {
    upsert: vi.fn(),
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

const fakeOffering = {
  id: 'off1',
  courseId: 'c1',
  semesterId: 'sem1',
  lecturerId: 'l1',
  dayOfWeek: 'Monday',
  startTime: '09:00',
  endTime: '11:00',
  room: 'Room 101',
  course: {
    id: 'c1',
    code: 'IFN101',
    name: 'Introduction to Programming',
    creditHours: 3,
  },
  lecturer: {
    user: { displayName: 'Dr. Siti Aminah' },
  },
  assignments: [
    {
      id: 'a1',
      title: 'Assignment 1: Variables',
      maxMarks: 100,
      weightPct: 20,
      dueDate: new Date('2026-10-15'),
    },
  ],
}

const fakeMaterial = {
  id: 'm1',
  offeringId: 'off1',
  title: 'Introduction Video',
  description: 'Course introduction and overview',
  materialType: 'video',
  externalUrl: 'https://example.com/video1',
  duration: 1800,
  orderIndex: 0,
  isPublished: true,
  uploadedBy: { displayName: 'Dr. Siti Aminah' },
}

const fakeAssignment = {
  id: 'a1',
  offeringId: 'off1',
  title: 'Assignment 1: Variables',
  description: 'Write a program to demonstrate variables',
  maxMarks: 100,
  weightPct: 20,
  dueDate: new Date('2026-10-15'),
  offering: {
    id: 'off1',
    course: { id: 'c1', code: 'IFN101', name: 'Introduction to Programming', creditHours: 3 },
    semester: { id: 'sem1', name: 'September 2026' },
    lecturer: { userId: 'u2' },
  },
}

const fakeSubmission = {
  id: 'sub1',
  assignmentId: 'a1',
  studentId: 's1',
  assetId: 'asset1',
  aiRubricScores: JSON.stringify([
    { criterion: 'Clarity', ai_score: 8, ai_comment: 'Well-structured' },
    { criterion: 'References', ai_score: 6, ai_comment: 'Needs more citations' },
  ]),
  student: { userId: 'u1', user: { displayName: 'Noor Aisyah' } },
}

describe('LMS 课程学习场景测试', () => {
  let url: string
  let server: Server

  beforeEach(async () => {
    vi.clearAllMocks()
    const app = await buildTestServer()
    ;({ server, url } = await startServer(app))
  })

  afterEach(() => server.close())

  describe('GET /lms/courses/:studentId - 查询学生课程列表', () => {
    it('应该成功返回学生的课程列表', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.enrolment.findMany.mockResolvedValue([
        { id: 'e1', offering: fakeOffering, status: 'registered' },
      ])

      const res = await fetch(`${url}/lms/courses/s1`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
    })

    it('应该返回 404 当学生不存在时', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null)

      const res = await fetch(`${url}/lms/courses/nonexistent`)
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
    })

    it('应该只返回已注册状态的课程', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(fakeStudent)
      mockPrisma.enrolment.findMany.mockResolvedValue([
        { id: 'e1', offering: fakeOffering, status: 'registered' },
        { id: 'e2', offering: fakeOffering, status: 'dropped' },
      ])

      const res = await fetch(`${url}/lms/courses/s1`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data.every((e: any) => e.status === 'registered')).toBe(true)
    })
  })

  describe('GET /lms/materials/:offeringId - 查询课程资料', () => {
    it('应该成功返回已发布的课程资料', async () => {
      mockPrisma.courseMaterial.findMany.mockResolvedValue([fakeMaterial])

      const res = await fetch(`${url}/lms/materials/off1`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].isPublished).toBe(true)
    })

    it('应该按顺序返回课程资料', async () => {
      const materials = [
        { ...fakeMaterial, id: 'm1', orderIndex: 1 },
        { ...fakeMaterial, id: 'm2', orderIndex: 0 },
      ]
      mockPrisma.courseMaterial.findMany.mockResolvedValue(materials)

      const res = await fetch(`${url}/lms/materials/off1`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.data[0].orderIndex).toBeLessThanOrEqual(body.data[1].orderIndex)
    })

    it('应该只返回已发布的资料', async () => {
      mockPrisma.courseMaterial.findMany.mockResolvedValue([fakeMaterial])

      await fetch(`${url}/lms/materials/off1`)

      expect(mockPrisma.courseMaterial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublished: true }),
        })
      )
    })
  })

  describe('POST /lms/submissions - 提交作业', () => {
    it('应该成功提交作业并生成 AI 评分', async () => {
      mockPrisma.fileAsset.create.mockResolvedValue({ id: 'asset1' })
      mockPrisma.submission.upsert.mockResolvedValue(fakeSubmission)
      mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment)
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: 'a1',
          studentId: 's1',
          content: 'My assignment submission',
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data.aiRubricScores).toBeDefined()
    })

    it('应该创建讲师通知', async () => {
      mockPrisma.fileAsset.create.mockResolvedValue({ id: 'asset1' })
      mockPrisma.submission.upsert.mockResolvedValue(fakeSubmission)
      mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment)
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      await fetch(`${url}/lms/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: 'a1',
          studentId: 's1',
          content: 'My assignment submission',
        }),
      })

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'assignment_submission',
          }),
        })
      )
    })

    it('应该生成多维度 AI 评分', async () => {
      mockPrisma.fileAsset.create.mockResolvedValue({ id: 'asset1' })
      mockPrisma.submission.upsert.mockResolvedValue(fakeSubmission)
      mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment)
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

      const res = await fetch(`${url}/lms/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: 'a1',
          studentId: 's1',
          content: 'My assignment submission',
        }),
      })
      const body = await res.json() as any

      const scores = JSON.parse(body.data.aiRubricScores)
      expect(Array.isArray(scores)).toBe(true)
      expect(scores.length).toBeGreaterThan(0)
      expect(scores[0]).toHaveProperty('criterion')
      expect(scores[0]).toHaveProperty('ai_score')
      expect(scores[0]).toHaveProperty('ai_comment')
    })
  })

  describe('GET /lms/submissions/pending/:lecturerId - 查询待评分作业', () => {
    it('应该成功返回讲师的待评分作业列表', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue({ id: 'l1', userId: 'u2' })
      mockPrisma.courseOffering.findMany.mockResolvedValue([
        {
          ...fakeOffering,
          assignments: [
            {
              ...fakeAssignment,
              submissions: [{ ...fakeSubmission, finalMarks: null }],
            },
          ],
        },
      ])

      const res = await fetch(`${url}/lms/submissions/pending/l1`)
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('应该只返回未评分的作业', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue({ id: 'l1', userId: 'u2' })
      mockPrisma.courseOffering.findMany.mockResolvedValue([
        {
          ...fakeOffering,
          assignments: [
            {
              ...fakeAssignment,
              submissions: [{ ...fakeSubmission, finalMarks: null }],
            },
          ],
        },
      ])

      await fetch(`${url}/lms/submissions/pending/l1`)

      expect(mockPrisma.courseOffering.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            assignments: expect.objectContaining({
              include: expect.objectContaining({
                submissions: expect.objectContaining({
                  where: { finalMarks: null },
                }),
              }),
            }),
          }),
        })
      )
    })

    it('应该返回 404 当讲师不存在时', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue(null)

      const res = await fetch(`${url}/lms/submissions/pending/nonexistent`)
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
    })
  })

  describe('PATCH /lms/submissions/:id/grade - 讲师评分', () => {
    it('应该成功评分并更新成绩', async () => {
      const gradedSubmission = {
        ...fakeSubmission,
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
          instructorScores: [
            { criterion: 'Clarity', score: 8 },
            { criterion: 'References', score: 7 },
          ],
          finalMarks: 85,
        }),
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.grade).toBe('A')
    })

    it('应该更新学生的 GPA', async () => {
      const gradedSubmission = {
        ...fakeSubmission,
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
          data: expect.objectContaining({
            currentCgpa: expect.any(Number),
          }),
        })
      )
    })

    it('应该创建学生通知', async () => {
      const gradedSubmission = {
        ...fakeSubmission,
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

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'grade_updated',
          }),
        })
      )
    })

    it('应该正确计算成绩等级', async () => {
      const testCases = [
        { marks: 95, expectedGrade: 'A_plus' },
        { marks: 85, expectedGrade: 'A' },
        { marks: 77, expectedGrade: 'B_plus' },
        { marks: 72, expectedGrade: 'B' },
        { marks: 67, expectedGrade: 'C_plus' },
        { marks: 62, expectedGrade: 'C' },
        { marks: 55, expectedGrade: 'D' },
        { marks: 45, expectedGrade: 'F' },
      ]

      for (const testCase of testCases) {
        const gradedSubmission = {
          ...fakeSubmission,
          finalMarks: testCase.marks,
          gradedAt: new Date(),
          gradedById: 'u2',
          assignment: fakeAssignment,
          student: { ...fakeStudent, userId: 'u1' },
        }

        mockPrisma.submission.update.mockResolvedValue(gradedSubmission)
        mockPrisma.enrolment.update.mockResolvedValue({ id: 'e1', finalGrade: testCase.expectedGrade })
        mockPrisma.enrolment.findMany.mockResolvedValue([])
        mockPrisma.student.update.mockResolvedValue(fakeStudent)
        mockPrisma.studentGpaRecord.upsert.mockResolvedValue({ id: 'gpa1' })
        mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })

        const res = await fetch(`${url}/lms/submissions/sub1/grade`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructorScores: [],
            finalMarks: testCase.marks,
          }),
        })
        const body = await res.json() as any

        expect(body.data.grade).toBe(testCase.expectedGrade)
      }
    })
  })
})
