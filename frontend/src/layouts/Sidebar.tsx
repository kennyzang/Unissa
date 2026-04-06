import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { apiClient } from '@/lib/apiClient'
import type { UserRole } from '@/types'
import styles from './Sidebar.module.scss'

interface NavItem {
  key: string
  labelKey: string
  path: string
  icon: string
  roles: UserRole[]
}

interface NavGroup {
  key: string
  labelKey: string
  icon: string
  roles: UserRole[]
  path?: string
  children?: NavItem[]
}

const NAV_STRUCTURE: NavGroup[] = [
  {
    key: 'g-admissions', labelKey: 'nav.admissions', icon: '🎓',
    roles: ['admissions', 'admin'],
    children: [
      { key: 'apply',     labelKey: 'nav.apply',        path: '/admission/apply',  icon: '📝', roles: ['admissions', 'admin'] },
      { key: 'admission', labelKey: 'nav.applications', path: '/admission/review', icon: '🎓', roles: ['admissions', 'admin'] },
    ],
  },
  {
    key: 'g-campus', labelKey: 'nav.myCampus', icon: '🏫',
    roles: ['student'],
    children: [
      { key: 'dashboard',   labelKey: 'nav.myDashboard',   path: '/student/dashboard', icon: '🏠', roles: ['student'] },
      { key: 'profile',     labelKey: 'nav.myInfo',        path: '/student/profile',   icon: '📝', roles: ['student'] },
      { key: 'courses-reg', labelKey: 'nav.courseSelection', path: '/student/courses', icon: '📚', roles: ['student'] },
      { key: 'transcript',  labelKey: 'nav.myGrades',      path: '/student/transcript',icon: '📊', roles: ['student'] },
      { key: 'statement',   labelKey: 'nav.myPayment',     path: '/finance/statement', icon: '💰', roles: ['student'] },
      { key: 'campus-card', labelKey: 'nav.campusCard',    path: '/student/campus-card', icon: '💳', roles: ['student'] },
      { key: 'campus',      labelKey: 'nav.campusServices', path: '/campus/services',  icon: '🏡', roles: ['student'] },
    ],
  },
  {
    key: 'g-learning-student', labelKey: 'nav.myLearning', icon: '📚',
    roles: ['student'],
    children: [
      { key: 'lms',        labelKey: 'nav.myCourses',      path: '/lms/courses',    icon: '📖', roles: ['student'] },
      { key: 'attendance', labelKey: 'nav.myAttendance',   path: '/lms/attendance', icon: '🕒', roles: ['student'] },
    ],
  },
  {
    key: 'g-teaching', labelKey: 'nav.teachingManagement', icon: '🎓',
    roles: ['lecturer'],
    children: [
      { key: 'staff-portal',       labelKey: 'nav.staffPortal',        path: '/staff/portal',    icon: '🏠', roles: ['lecturer'] },
      { key: 'lecturer-dashboard', labelKey: 'nav.lecturerDashboard',  path: '/lms/lecturer',    icon: '📋', roles: ['lecturer'] },
      { key: 'lms',                labelKey: 'nav.courseManagement',   path: '/lms/courses',     icon: '📖', roles: ['lecturer'] },
      { key: 'grading',       labelKey: 'nav.gradeManagement',  path: '/lms/grading',    icon: '📊', roles: ['lecturer'] },
      { key: 'attendance',    labelKey: 'nav.attendanceMgmt',   path: '/lms/attendance', icon: '🕒', roles: ['lecturer'] },
      { key: 'hr-leave',      labelKey: 'nav.leaveApproval',    path: '/hr/leave',       icon: '✅', roles: ['lecturer'] },
      { key: 'risk',          labelKey: 'nav.learningAnalysis', path: '/ai/risk',        icon: '📈', roles: ['lecturer'] },
    ],
  },
  {
    key: 'g-research', labelKey: 'nav.researchManagement', icon: '🔬',
    roles: ['lecturer'],
    children: [
      { key: 'research', labelKey: 'nav.researchFund', path: '/research/grants', icon: '💰', roles: ['lecturer'] },
    ],
  },
  {
    key: 'g-hr', labelKey: 'nav.humanResources', icon: '👥',
    roles: ['hradmin'],
    children: [
      { key: 'hr',            labelKey: 'nav.staffInfo',       path: '/hr/staff',       icon: '📝', roles: ['hradmin'] },
      { key: 'hr-onboarding', labelKey: 'nav.hrOnboarding',    path: '/hr/onboarding',  icon: '🆕', roles: ['hradmin'] },
      { key: 'hr-leave',      labelKey: 'nav.leaveApproval',   path: '/hr/leave',       icon: '✅', roles: ['hradmin'] },
      { key: 'hr-attend',     labelKey: 'nav.attendanceStats', path: '/lms/attendance', icon: '🕒', roles: ['hradmin'] },
    ],
  },
  {
    key: 'g-finance', labelKey: 'nav.financeControlCenter', icon: '💹',
    roles: ['finance'],
    children: [
      { key: 'finance',  labelKey: 'nav.financeOverview', path: '/finance/dashboard', icon: '📊', roles: ['finance'] },
      { key: 'payroll',  labelKey: 'nav.payrollMgmt',    path: '/finance/payroll',   icon: '💵', roles: ['finance'] },
    ],
  },
  {
    key: 'g-procurement', labelKey: 'nav.procurementManagement', icon: '🛒',
    roles: ['finance'],
    children: [
      { key: 'pr',        labelKey: 'nav.procurementApplication', path: '/procurement/requests',  icon: '📝', roles: ['finance'] },
      { key: 'approvals', labelKey: 'nav.procurementApproval',    path: '/procurement/approvals', icon: '✅', roles: ['finance'] },
      { key: 'products',  labelKey: 'nav.productCatalog',         path: '/procurement/products',  icon: '📦', roles: ['finance'] },
      { key: 'anomalies', labelKey: 'nav.procurementAnomaly',     path: '/procurement/anomalies', icon: '⚠️', roles: ['finance'] },
    ],
  },
  {
    key: 'g-manager', labelKey: 'nav.commandCenter', icon: '🖥️',
    roles: ['manager'],
    path: '/dashboard',
  },
  {
    key: 'g-manager-procurement', labelKey: 'nav.procurement', icon: '🛒',
    roles: ['manager'],
    children: [
      { key: 'pr',        labelKey: 'nav.procurementApplication', path: '/procurement/requests',  icon: '📝', roles: ['manager'] },
      { key: 'approvals', labelKey: 'nav.procurementApproval',    path: '/procurement/approvals', icon: '✅', roles: ['manager'] },
      { key: 'products',  labelKey: 'nav.productCatalog',         path: '/procurement/products',  icon: '📦', roles: ['manager'] },
    ],
  },
  {
    key: 'g-manager-hr', labelKey: 'nav.humanResources', icon: '👥',
    roles: ['manager'],
    children: [
      { key: 'staff-portal',  labelKey: 'nav.staffPortal',    path: '/staff/portal',  icon: '🏠', roles: ['manager'] },
      { key: 'hr',            labelKey: 'nav.staffInfo',      path: '/hr/staff',      icon: '📝', roles: ['manager'] },
      { key: 'hr-onboarding', labelKey: 'nav.hrOnboarding',   path: '/hr/onboarding', icon: '🆕', roles: ['manager'] },
      { key: 'hr-leave',      labelKey: 'nav.leaveApproval',  path: '/hr/leave',      icon: '✅', roles: ['manager'] },
    ],
  },
  {
    key: 'g-manager-research', labelKey: 'nav.researchFund', icon: '🔬',
    roles: ['manager'],
    children: [
      { key: 'research', labelKey: 'nav.researchFund', path: '/research/grants', icon: '💰', roles: ['manager'] },
    ],
  },
  {
    key: 'g-manager-campus', labelKey: 'nav.campusFacilities', icon: '🏛️',
    roles: ['manager'],
    children: [
      { key: 'campus-facilities', labelKey: 'nav.campusFacilities', path: '/campus/facilities', icon: '🏛️', roles: ['manager'] },
    ],
  },
  {
    key: 'g-admin', labelKey: 'nav.globalControlCenter', icon: '🌐',
    path: '/dashboard', roles: ['admin'],
  },
  {
    key: 'g-admin-finance', labelKey: 'nav.globalOverview', icon: '📊',
    roles: ['admin'],
    children: [
      { key: 'finance',  labelKey: 'nav.globalFinanceDashboard', path: '/finance/dashboard', icon: '💹', roles: ['admin'] },
      { key: 'payroll',  labelKey: 'nav.payrollMgmt',            path: '/finance/payroll',   icon: '💵', roles: ['admin'] },
      { key: 'risk',     labelKey: 'nav.globalRiskAnalysis',     path: '/ai/risk',           icon: '⚠️', roles: ['admin'] },
    ],
  },
  {
    key: 'g-admin-teaching', labelKey: 'nav.teachingManagement', icon: '🎓',
    roles: ['admin'],
    children: [
      { key: 'admin-attendance', labelKey: 'nav.globalAttendanceControl', path: '/lms/attendance', icon: '🕒', roles: ['admin'] },
      { key: 'admin-courses',    labelKey: 'nav.globalCourseManagement',  path: '/admin/courses',  icon: '📖', roles: ['admin'] },
    ],
  },
  {
    key: 'g-admin-procurement', labelKey: 'nav.procurementManagement', icon: '🛒',
    roles: ['admin'],
    children: [
      { key: 'approvals', labelKey: 'nav.procurementApprovalCenter', path: '/procurement/approvals', icon: '✅', roles: ['admin'] },
      { key: 'products',  labelKey: 'nav.productCatalog',            path: '/procurement/products',  icon: '📦', roles: ['admin'] },
      { key: 'anomalies', labelKey: 'nav.procurementAnomalyControl', path: '/procurement/anomalies', icon: '⚠️', roles: ['admin'] },
    ],
  },
  {
    key: 'g-admin-hr', labelKey: 'nav.hrManagement', icon: '👥',
    roles: ['admin'],
    children: [
      { key: 'hr',            labelKey: 'nav.globalHrManagement',  path: '/hr/staff',      icon: '📝', roles: ['admin'] },
      { key: 'hr-onboarding', labelKey: 'nav.hrOnboarding',        path: '/hr/onboarding', icon: '🆕', roles: ['admin'] },
      { key: 'hr-leave',      labelKey: 'nav.leaveApprovalCenter', path: '/hr/leave',      icon: '✅', roles: ['admin'] },
    ],
  },
  {
    key: 'g-admin-research', labelKey: 'nav.researchManagement', icon: '🔬',
    roles: ['admin'],
    children: [
      { key: 'research', labelKey: 'nav.researchFundControl', path: '/research/grants', icon: '💰', roles: ['admin'] },
    ],
  },
  {
    key: 'g-admin-campus', labelKey: 'nav.campusFacilities', icon: '🏛️',
    roles: ['admin'],
    children: [
      { key: 'campus-facilities', labelKey: 'nav.campusFacilities', path: '/campus/facilities', icon: '🏛️', roles: ['admin'] },
    ],
  },
  {
    key: 'g-admin-ops', labelKey: 'nav.systemOperation', icon: '⚙️',
    roles: ['admin'],
    path: '/admin/settings',
  },
]

const Sidebar = () => {
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, closeMobileSidebar } = useUIStore()
  const { t } = useTranslation()
  const location = useLocation()

  const { data: studentProfile, isLoading: studentLoading } = useQuery<any>({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/students/me')
        return data.data ?? null
      } catch (e: any) {
        if (e?.response?.status === 404) return null
        throw e
      }
    },
    retry: false,
    enabled: user?.role === 'student',
  })

  const isStudentEnrolled = user?.role === 'student' && !!studentProfile
  const isStudentUnenrolled = user?.role === 'student' && !studentLoading && studentProfile === null

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(NAV_STRUCTURE.filter(g => g.children).map(g => g.key))
  )

  const toggleGroup = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (!user) return null

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  let visibleGroups = NAV_STRUCTURE
    .filter(g => g.roles.includes(user.role))
    .map(g => ({
      ...g,
      children: g.children?.filter(c => c.roles.includes(user.role)),
    }))
    .filter(g => g.path || (g.children && g.children.length > 0))

  // For unenrolled students, only show dashboard + apply in myCampus group
  if (isStudentUnenrolled) {
    visibleGroups = visibleGroups.map(g => {
      if (g.key === 'g-campus') {
        return {
          ...g,
          children: g.children?.filter(c => ['dashboard', 'profile'].includes(c.key)),
        }
      }
      return g
    }).filter(g => g.path || (g.children && g.children.length > 0))
  }

  return (
    <aside className={clsx(styles.sidebar, { [styles.collapsed]: sidebarCollapsed })}>
      {/* Header */}
      <div className={styles.header}>
        {!sidebarCollapsed && (
          <div className={styles.brand}>
            <div className={styles.brandMark}>U</div>
            <div className={styles.brandText}>
              <div className={styles.brandName}>UNISSA</div>
              <div className={styles.brandSub}>{t('nav.smartPlatform')}</div>
            </div>
          </div>
        )}
        {sidebarCollapsed && <div className={styles.brandMarkOnly}>U</div>}
        <button className={styles.collapseBtn} onClick={toggleSidebar} title="Toggle Sidebar">
          {sidebarCollapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {visibleGroups.map(group => {
          if (group.path) {
            return (
              <NavLink
                key={group.key}
                to={group.path}
                onClick={closeMobileSidebar}
                className={({ isActive: a }) =>
                  clsx(styles.navItem, { [styles.active]: a || isActive(group.path!) })
                }
                title={sidebarCollapsed ? t(group.labelKey) : undefined}
              >
                <span className={styles.navIcon}>{group.icon}</span>
                {!sidebarCollapsed && <span className={styles.navLabel}>{t(group.labelKey)}</span>}
              </NavLink>
            )
          }

          const children = group.children ?? []
          const isOpen = expanded.has(group.key)
          const hasActiveChild = children.some(c => isActive(c.path))

          // Single child: render flat without group header
          if (children.length === 1) {
            const item = children[0]
            return (
              <NavLink
                key={item.key}
                to={item.path}
                onClick={closeMobileSidebar}
                className={({ isActive: a }) =>
                  clsx(styles.navItem, { [styles.active]: a || isActive(item.path) })
                }
                title={sidebarCollapsed ? t(item.labelKey) : undefined}
              >
                <span className={styles.navIcon}>{group.icon}</span>
                {!sidebarCollapsed && <span className={styles.navLabel}>{t(item.labelKey)}</span>}
              </NavLink>
            )
          }

          return (
            <div key={group.key}>
              {!sidebarCollapsed && (
                <div
                  className={clsx(styles.groupHeader, {
                    [styles.active]: hasActiveChild && !isOpen,
                    [styles.groupOpen]: isOpen,
                  })}
                  onClick={() => toggleGroup(group.key)}
                  title={t(group.labelKey)}
                >
                  <span className={styles.groupIcon}>{group.icon}</span>
                  <span className={styles.groupLabel}>{t(group.labelKey)}</span>
                  <span className={clsx(styles.groupChevron, { [styles.open]: isOpen })}>▾</span>
                </div>
              )}

              {(isOpen || sidebarCollapsed) && children.map(item => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={closeMobileSidebar}
                  className={({ isActive: a }) =>
                    clsx(styles.navItem, {
                      [styles.active]: a || isActive(item.path),
                      [styles.subItem]: !sidebarCollapsed,
                    })
                  }
                  title={sidebarCollapsed ? t(item.labelKey) : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!sidebarCollapsed && <span className={styles.navLabel}>{t(item.labelKey)}</span>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* User info */}
      {!sidebarCollapsed && (
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{user.displayName.charAt(0).toUpperCase()}</div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{user.displayName}</div>
            <div className={styles.userRole}>{user.role.toUpperCase()}</div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
