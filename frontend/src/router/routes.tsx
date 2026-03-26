import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from '@/layouts/ProtectedRoute'
import PageLoader from '@/components/ui/PageLoader'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types'

// Maps each role to its first accessible page
const ROLE_HOME: Record<string, string> = {
  admin:      '/dashboard',
  manager:    '/dashboard',
  finance:    '/dashboard',
  admissions: '/admission/review',
  lecturer:   '/lms/courses',
  student:    '/admission/apply',
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
const CourseRegistrationPage   = lazy(() => import('@/pages/courses/CourseRegistrationPage'))
const FeeStatementPage         = lazy(() => import('@/pages/finance/FeeStatementPage'))
const FinanceDashboardPage     = lazy(() => import('@/pages/finance/FinanceDashboardPage'))
const LmsCoursesPage           = lazy(() => import('@/pages/lms/LmsCoursesPage'))
const LmsCourseDetailPage      = lazy(() => import('@/pages/lms/LmsCourseDetailPage'))
const AttendancePage           = lazy(() => import('@/pages/lms/AttendancePage'))
const ProcurementPRPage        = lazy(() => import('@/pages/procurement/ProcurementPRPage'))
const ApprovalInboxPage        = lazy(() => import('@/pages/procurement/ApprovalInboxPage'))
const ProcurementAnomaliesPage = lazy(() => import('@/pages/ai/ProcurementAnomaliesPage'))
const HrStaffPage              = lazy(() => import('@/pages/hr/HrStaffPage'))
const LeaveManagementPage      = lazy(() => import('@/pages/hr/LeaveManagementPage'))
const ResearchGrantsPage       = lazy(() => import('@/pages/research/ResearchGrantsPage'))
const RiskDashboardPage        = lazy(() => import('@/pages/ai/RiskDashboardPage'))
const CampusServicesPage       = lazy(() => import('@/pages/campus/CampusServicesPage'))
const SettingsPage             = lazy(() => import('@/pages/admin/SettingsPage'))
const CourseManagementPage     = lazy(() => import('@/pages/admin/CourseManagementPage'))

const wrap = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>

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
      { path: 'admission/apply',  element: r(['student','admin'], <AdmissionApplyPage />) },
      { path: 'admission/review', element: r(['admissions','admin'], <AdmissionReviewPage />) },

      // Student
      { path: 'student/profile',  element: r(['student'], <StudentProfilePage />) },
      { path: 'student/courses',  element: r(['student','admin'], <CourseRegistrationPage />) },

      // Finance
      { path: 'finance/statement',  element: r(['student','finance','admin'], <FeeStatementPage />) },
      { path: 'finance/dashboard',  element: r(['finance','admin'], <FinanceDashboardPage />) },

      // LMS
      { path: 'lms/courses',              element: r(['student','lecturer','admin'], <LmsCoursesPage />) },
      { path: 'lms/courses/:offeringId',  element: r(['student','lecturer','admin'], <LmsCourseDetailPage />) },
      { path: 'lms/attendance',           element: r(['student','lecturer','admin'], <AttendancePage />) },

      // Procurement
      { path: 'procurement/requests',   element: r(['manager','finance','admin'], <ProcurementPRPage />) },
      { path: 'procurement/approvals',  element: r(['manager','finance','admin'], <ApprovalInboxPage />) },
      { path: 'procurement/anomalies',  element: r(['finance','admin'], <ProcurementAnomaliesPage />) },

      // HR
      { path: 'hr/staff',  element: r(['manager','admin','hradmin'], <HrStaffPage />) },
      { path: 'hr/leave',  element: r(['lecturer','manager','admin','finance','hradmin'], <LeaveManagementPage />) },

      // Research
      { path: 'research/grants', element: r(['lecturer','manager','admin'], <ResearchGrantsPage />) },

      // AI Analytics
      { path: 'ai/risk', element: r(['lecturer','admin'], <RiskDashboardPage />) },

      // Campus
      { path: 'campus/services', element: r(['student','admin'], <CampusServicesPage />) },

      // Admin
      { path: 'admin/settings', element: r(['admin'], <SettingsPage />) },
      { path: 'admin/courses',  element: r(['admin'], <CourseManagementPage />) },

      // Legacy redirect
      { path: 'ai/chat', element: <Navigate to="/dashboard" replace /> },
    ],
  },
  { path: '*', element: <RoleRedirect /> },
])
