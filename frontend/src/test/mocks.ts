import { vi } from 'vitest'

export const mockUser = {
  id: 'u1',
  username: 'noor',
  displayName: 'Noor Aisyah',
  email: 'noor@unissa.edu.bn',
  role: 'student' as const,
  isActive: true,
}

export const mockAdminUser = {
  id: 'u2',
  username: 'admin',
  displayName: 'Admin User',
  email: 'admin@unissa.edu.bn',
  role: 'admin' as const,
  isActive: true,
}

export const mockLecturerUser = {
  id: 'u3',
  username: 'siti',
  displayName: 'Dr. Siti Aminah',
  email: 'siti@unissa.edu.bn',
  role: 'lecturer' as const,
  isActive: true,
}

export const mockStudent = {
  id: 's1',
  studentId: '2026001',
  userId: 'u1',
  programmeId: 'prog1',
  intakeId: 'intake1',
  displayName: 'Noor Aisyah',
  email: 'noor@unissa.edu.bn',
  currentCgpa: 3.5,
  studentType: 'standard',
  scholarshipPct: 0,
  nationality: 'Brunei Darussalam',
  campusCardNo: 'CC-2026001',
  libraryAccountActive: true,
  emailAccountActive: true,
  status: 'active' as const,
  enrolledAt: new Date('2026-09-01'),
  user: mockUser,
  programme: {
    id: 'prog1',
    code: 'CS',
    name: 'Computer Science',
    level: 'degree',
    department: {
      name: 'Faculty of Science',
    },
  },
  intake: {
    semester: {
      name: 'September 2026',
    },
  },
}

export const mockCourse = {
  id: 'c1',
  code: 'IFN101',
  name: 'Introduction to Programming',
  creditHours: 3,
  level: 1,
  departmentId: 'd1',
  prerequisites: [],
}

export const mockOffering = {
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
  maxSeats: 30,
  course: mockCourse,
  lecturer: {
    user: mockLecturerUser,
  },
  semester: {
    id: 'sem1',
    name: 'September 2026',
  },
  assignments: [
    {
      id: 'a1',
      title: 'Assignment 1: Variables',
      description: 'Write a program to demonstrate variables',
      maxMarks: 100,
      weightPct: 20,
      dueDate: new Date('2026-10-15'),
      assignmentType: 'individual',
    },
  ],
}

export const mockEnrolment = {
  id: 'e1',
  studentId: 's1',
  offeringId: 'off1',
  status: 'registered' as const,
  registeredAt: new Date('2026-09-01'),
  finalGrade: null,
  gradePoints: null,
  offering: mockOffering,
}

export const mockAssignment = {
  id: 'a1',
  offeringId: 'off1',
  title: 'Assignment 1: Variables',
  description: 'Write a program to demonstrate variables',
  maxMarks: 100,
  weightPct: 20,
  dueDate: new Date('2026-10-15'),
  assignmentType: 'individual',
  offering: mockOffering,
}

export const mockSubmission = {
  id: 'sub1',
  assignmentId: 'a1',
  studentId: 's1',
  assetId: 'asset1',
  aiRubricScores: JSON.stringify([
    { criterion: 'Clarity', ai_score: 8, ai_comment: 'Well-structured' },
    { criterion: 'References', ai_score: 6, ai_comment: 'Needs more citations' },
    { criterion: 'Originality', ai_score: 7, ai_comment: 'Good original ideas' },
  ]),
  aiGeneratedAt: new Date('2026-10-10'),
  finalMarks: null,
  gradedAt: null,
  gradedById: null,
  student: mockStudent,
  assignment: mockAssignment,
}

export const mockGradedSubmission = {
  ...mockSubmission,
  finalMarks: 85,
  gradedAt: new Date('2026-10-12'),
  gradedById: 'u3',
}

export const mockApplicant = {
  id: 'app1',
  applicationRef: 'APP-2026-0001',
  fullName: 'Test Applicant',
  icPassport: '1234567890',
  dateOfBirth: new Date('2000-01-01'),
  gender: 'male' as const,
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
  modeOfStudy: 'full_time' as const,
  scholarshipApplied: false,
  status: 'submitted' as const,
  createdAt: new Date('2026-09-01'),
}

export const mockFeeInvoice = {
  id: 'inv1',
  invoiceNo: 'INV-2026-0001',
  studentId: 's1',
  semesterId: 'sem1',
  tuitionFee: 4800,
  libraryFee: 100,
  hostelDeposit: 0,
  scholarshipDeduction: 0,
  totalAmount: 4900,
  status: 'unpaid' as const,
  dueDate: new Date('2026-10-01'),
  createdAt: new Date('2026-09-01'),
}

export const mockNotification = {
  id: 'n1',
  userId: 'u1',
  type: 'grade_updated',
  title: 'Grade Updated',
  message: 'Your assignment has been graded',
  isRead: false,
  createdAt: new Date('2026-10-12'),
}

export const mockGpaRecord = {
  id: 'gpa1',
  studentId: 's1',
  semesterId: 'sem1',
  semesterGpa: 3.83,
  cumulativeGpa: 3.83,
  totalChPassed: 6,
  semester: {
    id: 'sem1',
    name: 'September 2026',
  },
}

export const mockCourseMaterial = {
  id: 'm1',
  offeringId: 'off1',
  title: 'Introduction Video',
  description: 'Course introduction and overview',
  materialType: 'video',
  externalUrl: 'https://example.com/video1',
  duration: 1800,
  orderIndex: 0,
  isPublished: true,
  uploadedById: 'u3',
  uploadedBy: { displayName: 'Dr. Siti Aminah' },
}

export const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

export const resetMocks = () => {
  mockApi.get.mockReset()
  mockApi.post.mockReset()
  mockApi.put.mockReset()
  mockApi.patch.mockReset()
  mockApi.delete.mockReset()
}

export const mockApiResponse = (data: any) => ({
  data: {
    success: true,
    data,
  },
})

export const mockApiErrorResponse = (message: string, status = 400) => ({
  response: {
    status,
    data: {
      success: false,
      message,
    },
  },
})
