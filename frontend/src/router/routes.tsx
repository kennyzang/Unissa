import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from '@/layouts/ProtectedRoute'
import PageLoader from '@/components/ui/PageLoader'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types'

// Maps each role to its first accessible page
const ROLE_HOME: Record<string, string> = {
  admin:      '/dashboard',
  manager:    '/dashboard',
  finance:    '/finance/dashboard',
  admissions: '/admission/review',
  lecturer:   '/lms/courses',
  student:    '/student/dashboard',
  hradmin:    '/hr/staff',
}

const RoleRedirect = () => {
  const { user } = useAuthStore()
  const to = (user && ROLE_HOME[user.role]) ?? '/dashboard'
  return <Navigate to={to} replace />
}

// Role-based route guard: redirects to role home if not authorised
interface RoleRouteProps { roles: UserRole[]; children: React.ReactNode }
const RoleRoute: React.FC<RoleRouteProps> = ({ roles, children }) => {
  const { user } = useAuthStore()
  if (!user || !roles.includes(user.role)) {
    const to = (user && ROLE_HOME[user.role]) ?? '/login'
    return <Navigate to={to} replace />
  }
  return <>{children}</>
}
const r = (roles: UserRole[], el: React.ReactNode) =>
  wrap(<RoleRoute roles={roles}>{el}</RoleRoute>)

// Lazy pages
const LoginPage                = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage            = lazy(() => import('@/pages/dashboard/DashboardPage'))
const AdmissionApplyPage       = lazy(() => import('@/pages/admission/AdmissionApplyPage'))
const AdmissionReviewPage      = lazy(() => import('@/pages/admission/AdmissionReviewPage'))
const StudentProfilePage       = lazy(() => import('@/pages/student/StudentProfilePage'))
const TranscriptPage           = lazy(() => import('@/pages/student/TranscriptPage'))
const CampusCardPage           = lazy(() => import('@/pages/student/CampusCardPage'))
const StudentDashboardPage     = lazy(() => import('@/pages/student/StudentDashboardPage'))
const CourseRegistrationPage   = lazy(() => import('@/pages/courses/CourseRegistrationPage'))
const FeeStatementPage         = lazy(() => import('@/pages/finance/FeeStatementPage'))
const FinanceDashboardPage     = lazy(() => import('@/pages/finance/FinanceDashboardPage'))
const PayrollManagementPage    = lazy(() => import('@/pages/finance/PayrollManagementPage'))
const LmsCoursesPage           = lazy(() => import('@/pages/lms/LmsCoursesPage'))
const LmsCourseDetailPage      = lazy(() => import('@/pages/lms/LmsCourseDetailPage'))
const LmsGradingPage           = lazy(() => import('@/pages/lms/LmsGradingPage'))
const LecturerDashboardPage    = lazy(() => import('@/pages/lms/LecturerDashboardPage'))
const AttendancePage           = lazy(() => import('@/pages/lms/AttendancePage'))
const QRCodeScanPage           = lazy(() => import('@/pages/lms/QRCodeScanPage'))
const CameraScanPage           = lazy(() => import('@/pages/lms/CameraScanPage'))
const ProcurementPRPage        = lazy(() => import('@/pages/procurement/ProcurementPRPage'))
const ApprovalInboxPage        = lazy(() => import('@/pages/procurement/ApprovalInboxPage'))
const ProductsPage             = lazy(() => import('@/pages/procurement/ProductsPage'))
const ProcurementAnomaliesPage  = lazy(() => import('@/pages/ai/ProcurementAnomaliesPage'))
const ChatbotPage               = lazy(() => import('@/pages/ai/ChatbotPage'))
const ExecutiveInsightsPage     = lazy(() => import('@/pages/ai/ExecutiveInsightsPage'))
const HrStaffPage              = lazy(() => import('@/pages/hr/HrStaffPage'))
const LeaveManagementPage      = lazy(() => import('@/pages/hr/LeaveManagementPage'))
const HrOnboardingPage         = lazy(() => import('@/pages/hr/HrOnboardingPage'))
const StaffPortalPage          = lazy(() => import('@/pages/hr/StaffPortalPage'))
const ResearchGrantsPage       = lazy(() => import('@/pages/research/ResearchGrantsPage'))
const RiskDashboardPage        = lazy(() => import('@/pages/ai/RiskDashboardPage'))
const CampusServicesPage       = lazy(() => import('@/pages/campus/CampusServicesPage'))
const CampusFacilitiesPage     = lazy(() => import('@/pages/campus/CampusFacilitiesPage'))
const AdmissionsPage           = lazy(() => import('@/pages/admissions/AdmissionsPage'))
const SettingsPage             = lazy(() => import('@/pages/admin/SettingsPage'))
const CourseManagementPage     = lazy(() => import('@/pages/admin/CourseManagementPage'))

const wrap = (el: React.ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>{el}</Suspense>
  </ErrorBoundary>
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: wrap(<LoginPage />) }],
  },
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <RoleRedirect /> },

      { path: 'dashboard', element: r(['admin','manager','finance'], <DashboardPage />) },

      // Admission
      { path: 'admission/apply',  element: r(['student','admissions','admin'], <AdmissionApplyPage />) },
      { path: 'admission/review', element: r(['admissions','admin'], <AdmissionReviewPage />) },

      // Student
      { path: 'student/dashboard',  element: r(['student'], <StudentDashboardPage />) },
      { path: 'student/profile',    element: r(['student'], <StudentProfilePage />) },
      { path: 'student/courses',    element: r(['student'], <CourseRegistrationPage />) },
      { path: 'student/transcript', element: r(['student'], <TranscriptPage />) },
      { path: 'student/campus-card', element: r(['student'], <CampusCardPage />) },

      // Finance
      { path: 'finance/statement',  element: r(['student','finance','admin'], <FeeStatementPage />) },
      { path: 'finance/dashboard',  element: r(['finance','admin'], <FinanceDashboardPage />) },
      { path: 'finance/payroll',    element: r(['finance','admin'], <PayrollManagementPage />) },

      // LMS
      { path: 'lms/courses',              element: r(['student','lecturer','admin'], <LmsCoursesPage />) },
      { path: 'lms/courses/:offeringId',  element: r(['student','lecturer','admin'], <LmsCourseDetailPage />) },
      { path: 'lms/lecturer',             element: r(['lecturer','admin'], <LecturerDashboardPage />) },
      { path: 'lms/grading',              element: r(['lecturer'], <LmsGradingPage />) },
      { path: 'lms/attendance',           element: r(['student','lecturer','admin','hradmin'], <AttendancePage />) },
      { path: 'lms/attendance/scan',      element: r(['student'], <CameraScanPage />) },

      // Procurement
      { path: 'procurement/requests',   element: r(['manager','finance','admin'], <ProcurementPRPage />) },
      { path: 'procurement/approvals',  element: r(['manager','finance','admin'], <ApprovalInboxPage />) },
      { path: 'procurement/products',   element: r(['manager','finance','admin'], <ProductsPage />) },
      { path: 'procurement/anomalies',  element: r(['finance','admin'], <ProcurementAnomaliesPage />) },

      // HR
      { path: 'hr/staff',       element: r(['manager','admin','hradmin'], <HrStaffPage />) },
      { path: 'hr/leave',       element: r(['lecturer','manager','admin','finance','hradmin'], <LeaveManagementPage />) },
      { path: 'hr/onboarding',  element: r(['manager','admin','hradmin'], <HrOnboardingPage />) },
      { path: 'staff/portal',   element: r(['lecturer','manager','admin','hradmin'], <StaffPortalPage />) },

      // Research
      { path: 'research/grants', element: r(['lecturer','manager','admin','finance'], <ResearchGrantsPage />) },

      // AI Analytics
      { path: 'ai/risk',     element: r(['lecturer','admin'], <RiskDashboardPage />) },
      { path: 'ai/chat',     element: r(['lecturer','admin','manager','finance'], <ChatbotPage />) },
      { path: 'ai/insights', element: r(['admin','manager'], <ExecutiveInsightsPage />) },

      // Campus
      { path: 'campus/services',   element: r(['student'], <CampusServicesPage />) },
      { path: 'campus/facilities', element: r(['manager','admin'], <CampusFacilitiesPage />) },

      // Admissions pipeline
      { path: 'admissions', element: r(['admissions','manager','admin'], <AdmissionsPage />) },

      // Admin
      { path: 'admin/settings', element: r(['admin'], <SettingsPage />) },
      { path: 'admin/courses',  element: r(['admin'], <CourseManagementPage />) },

    ],
  },
  { path: '*', element: <RoleRedirect /> },
])
