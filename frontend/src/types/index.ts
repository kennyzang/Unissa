// ============================================================
// UNISSA – Shared TypeScript Types
// ============================================================

// ---- Auth & Users ----
export type UserRole = 'student' | 'lecturer' | 'manager' | 'finance' | 'admissions' | 'admin' | 'hradmin'

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  email: string
  isActive: boolean
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// ---- API Response Wrapper ----
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ---- Status Enums ----
export type ApplicantStatus =
  | 'draft' | 'submitted' | 'auto_check_failed'
  | 'under_review' | 'accepted' | 'rejected' | 'waitlisted'

export type StudentStatus = 'active' | 'suspended' | 'graduated' | 'withdrawn'
export type StudentType = 'standard' | 'international' | 'audit' | 'probation'

export type EnrolmentStatus = 'registered' | 'dropped' | 'completed' | 'failed'
export type FinalGrade = 'A_plus' | 'A' | 'B_plus' | 'B' | 'C_plus' | 'C' | 'D' | 'F'

export type InvoiceStatus = 'unpaid' | 'paid' | 'overdue' | 'partial'
export type PaymentMethod = 'card' | 'online_banking' | 'e_wallet'
export type PaymentStatus = 'success' | 'failed' | 'pending'

export type PRStatus =
  | 'draft' | 'submitted' | 'dept_approved' | 'finance_approved'
  | 'rector_approved' | 'converted_to_po' | 'rejected'
export type QuoteTrafficLight = 'red' | 'amber' | 'green'
export type POStatus = 'issued' | 'sent_to_vendor' | 'received' | 'paid'

export type LeaveStatus = 'pending' | 'l1_approved' | 'l2_approved' | 'rejected'
export type LeaveType = 'annual' | 'medical' | 'emergency' | 'unpaid' | 'maternity'

export type GrantStatus =
  | 'proposal_submitted' | 'l1_endorsed' | 'committee_review'
  | 'finance_approved' | 'active' | 'completed' | 'rejected'

export type RiskPrediction = 'pass' | 'fail' | 'at_risk'
export type AnomalyType = 'price_outlier' | 'split_billing' | 'frequent_vendor' | 'other'
export type AnomaliySeverity = 'low' | 'medium' | 'high'

// ---- Domain Models ----
export interface Department {
  id: string
  code: string
  name: string
  parentId?: string
  headStaffId?: string
}

export interface Programme {
  id: string
  code: string
  name: string
  departmentId: string
  department?: Department
  level: 'certificate' | 'diploma' | 'degree' | 'masters' | 'phd'
  durationYears: number
  feeLocalPerCh: number
  feeInternationalPerCh: number
  isActive: boolean
}

export interface Intake {
  id: string
  programmeId: string
  programme?: Programme
  semesterId: string
  semesterName: string
  intakeStart: string
  intakeEnd: string
  isOpen: boolean
  maxCapacity: number
}

export interface Student {
  id: string
  studentId: string
  userId: string
  programmeId: string
  programme?: Programme
  intakeId: string
  displayName: string
  email: string
  nationality: string
  studentType: StudentType
  currentCgpa: number
  scholarshipPct: number
  campusCardNo?: string
  libraryAccountActive: boolean
  emailAccountActive: boolean
  status: StudentStatus
  enrolledAt: string
}

export interface Course {
  id: string
  code: string
  name: string
  departmentId: string
  creditHours: number
  level: number
  isOpenToInternational: boolean
  maxSeats: number
}

export interface CourseOffering {
  id: string
  courseId: string
  course?: Course
  semesterId: string
  lecturerId: string
  lecturerName?: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  seatsTaken: number
  maxSeats: number
}

export interface Enrolment {
  id: string
  studentId: string
  offeringId: string
  offering?: CourseOffering
  semesterId: string
  status: EnrolmentStatus
  finalGrade?: FinalGrade
  gradePoints?: number
  registeredAt: string
}

export interface FeeInvoice {
  id: string
  invoiceNo: string
  studentId: string
  semesterId: string
  semesterName: string
  tuitionFee: number
  libraryFee: number
  hostelDeposit: number
  scholarshipDeduction: number
  totalAmount: number
  amountPaid: number
  outstandingBalance: number
  dueDate: string
  status: InvoiceStatus
  generatedAt: string
}

export interface GlCode {
  id: string
  code: string
  description: string
  departmentId: string
  totalBudget: number
  committedAmount: number
  spentAmount: number
  availableBalance: number
  fiscalYear: number
  isActive: boolean
}

export interface Vendor {
  id: string
  name: string
  registrationNo?: string
  contactEmail?: string
  isActive: boolean
  totalOrdersYtd: number
}

export interface PurchaseRequest {
  id: string
  prNumber: string
  requestorId: string
  requestorName?: string
  departmentId: string
  departmentName?: string
  itemDescription: string
  quantity: number
  estimatedUnitPrice: number
  totalAmount: number
  glCodeId: string
  glCode?: GlCode
  requiredByDate: string
  recommendedVendorId?: string
  quoteTrafficLight: QuoteTrafficLight
  status: PRStatus
  anomalyFlags?: AnomalyFlag[]
  submittedAt?: string
  createdAt: string
  quotes?: PRQuote[]
  approvals?: PRApproval[]
}

export interface PRQuote {
  id: string
  prId: string
  quoteNumber: number
  vendorName: string
  vendorId?: string
  quotedPrice: number
  fileUrl?: string
  uploadedAt: string
}

export interface PRApproval {
  id: string
  prId: string
  level: number
  approverId: string
  approverName?: string
  action: 'approved' | 'rejected' | 'escalated'
  remarks?: string
  actedAt: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  prId: string
  vendorId: string
  vendorName?: string
  totalAmount: number
  glCodeId: string
  status: POStatus
  issuedAt: string
  poPdfUrl?: string
}

export interface Staff {
  id: string
  staffId: string
  userId: string
  fullName: string
  department?: Department
  designation: string
  employmentType: 'permanent' | 'contract' | 'part_time'
  joinDate: string
  leaveBalanceAnnual: number
  leaveBalanceMedical: number
  lmsInstructorActive: boolean
  status: 'active' | 'on_leave' | 'resigned' | 'terminated'
}

export interface ResearchGrant {
  id: string
  referenceNo: string
  title: string
  principalInvestigatorId: string
  piName?: string
  departmentId: string
  abstract: string
  durationMonths: number
  totalBudget: number
  amountUtilised: number
  utilisationPct: number
  status: GrantStatus
  submittedAt: string
}

export interface StudentRiskScore {
  id: string
  studentId: string
  studentName?: string
  studentIdNo?: string
  offeringId: string
  courseName?: string
  attendancePct: number
  quizAvg: number
  submissionRate: number
  riskScore: number
  predictedOutcome: RiskPrediction
  confidence: number
  advisorNotifiedAt?: string
  computedAt: string
}

export interface AnomalyFlag {
  type: AnomalyType
  description: string
  severity: AnomaliySeverity
}

export interface ProcurementAnomaly {
  id: string
  prId: string
  prNumber?: string
  anomalyType: AnomalyType
  description: string
  severity: AnomaliySeverity
  zScore?: number
  comparisonData?: any
  status: 'open' | 'investigating' | 'resolved' | 'dismissed'
  detectedAt: string
}

// ---- Dashboard KPIs ----
export interface DashboardKPI {
  enrollment: {
    totalEnrolled: number
    newApplicationsToday: number
    acceptedToday: number
    trend7day: number[]
  }
  finance: {
    totalBudget: number
    committed: number
    remaining: number
    committedPct: number
    overdueInvoices: number
  }
  hr: {
    totalStaff: number
    onLeaveToday: number
    pendingApprovals: number
    newHiresMonth: number
  }
  research: {
    activeGrants: number
    totalValue: number
    utilisation: number
    pendingProposals: number
  }
  campus: {
    roomsBookedToday: number
    totalRooms: number
    maintenanceTickets: number
    vehiclesInUse: number
    totalVehicles: number
    activeAlert?: string
  }
  lms: {
    activeLearnersNow: number
    assignmentsDueToday: number
    avgCourseCompletion: number
    atRiskFlagged: number
  }
}

// ---- Notification ----
export interface Notification {
  id: string
  userId: string
  type: 'email' | 'push' | 'both'
  subject: string
  body: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  triggeredByEvent?: string
  createdAt: string
}

// ---- Form Types ----
export interface LoginFormValues {
  username: string
  password: string
}

export interface PaymentFormValues {
  method: PaymentMethod
  cardNumber?: string
  cardExpiry?: string
  cardCvv?: string
  cardHolder?: string
}
