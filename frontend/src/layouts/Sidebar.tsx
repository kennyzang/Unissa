import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
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
    key: 'dashboard', labelKey: 'nav.commandCenter', icon: '🖥️',
    path: '/dashboard', roles: ['admin', 'manager', 'finance'],
  },
  {
    key: 'g-student', labelKey: 'nav.studentAffairs', icon: '🎓',
    roles: ['student', 'admissions', 'admin'],
    children: [
      { key: 'apply',       labelKey: 'nav.apply',           path: '/admission/apply',   icon: '📝', roles: ['student', 'admin'] },
      { key: 'admission',   labelKey: 'nav.applications',    path: '/admission/review',  icon: '🎓', roles: ['admissions', 'admin'] },
      { key: 'profile',     labelKey: 'nav.myProfile',       path: '/student/profile',   icon: '👤', roles: ['student'] },
      { key: 'courses-reg', labelKey: 'nav.courseReg',       path: '/student/courses',   icon: '📋', roles: ['student', 'admin'] },
      { key: 'statement',   labelKey: 'nav.feeStatement',    path: '/finance/statement', icon: '💳', roles: ['student', 'finance', 'admin'] },
      { key: 'campus',      labelKey: 'nav.campusServices',  path: '/campus/services',   icon: '🏛️', roles: ['student', 'admin'] },
    ],
  },
  {
    key: 'g-lms', labelKey: 'nav.learning', icon: '📚',
    roles: ['student', 'lecturer', 'admin'],
    children: [
      { key: 'lms',        labelKey: 'nav.myCourses', path: '/lms/courses',    icon: '📚', roles: ['student', 'lecturer', 'admin'] },
      { key: 'attendance', labelKey: 'nav.attendance', path: '/lms/attendance', icon: '📸', roles: ['student', 'lecturer', 'admin'] },
    ],
  },
  {
    key: 'g-finance', labelKey: 'nav.finance', icon: '💰',
    roles: ['finance', 'admin'],
    children: [
      { key: 'finance', labelKey: 'nav.financeDashboard', path: '/finance/dashboard', icon: '💰', roles: ['finance', 'admin'] },
    ],
  },
  {
    key: 'g-procurement', labelKey: 'nav.procurement', icon: '🛒',
    roles: ['manager', 'finance', 'admin'],
    children: [
      { key: 'pr',        labelKey: 'nav.purchaseRequests', path: '/procurement/requests',  icon: '🛒', roles: ['manager', 'finance', 'admin'] },
      { key: 'approvals', labelKey: 'nav.approvals',        path: '/procurement/approvals', icon: '✅', roles: ['manager', 'finance', 'admin'] },
      { key: 'anomalies', labelKey: 'nav.anomalyDetect',    path: '/procurement/anomalies', icon: '🚨', roles: ['finance', 'admin'] },
    ],
  },
  {
    key: 'g-hr', labelKey: 'nav.humanResources', icon: '👥',
    roles: ['lecturer', 'manager', 'admin', 'finance', 'hradmin'],
    children: [
      { key: 'hr',       labelKey: 'nav.hrStaff',         path: '/hr/staff',  icon: '👥', roles: ['manager', 'admin', 'hradmin'] },
      { key: 'hr-leave', labelKey: 'nav.leaveManagement', path: '/hr/leave',  icon: '🏖️', roles: ['lecturer', 'manager', 'admin', 'finance', 'hradmin'] },
    ],
  },
  {
    key: 'g-research', labelKey: 'nav.research', icon: '🔬',
    roles: ['lecturer', 'manager', 'admin'],
    children: [
      { key: 'research', labelKey: 'nav.researchGrants', path: '/research/grants', icon: '🔬', roles: ['lecturer', 'manager', 'admin'] },
    ],
  },
  {
    key: 'g-ai', labelKey: 'nav.aiAnalytics', icon: '📊',
    roles: ['lecturer', 'finance', 'admin'],
    children: [
      { key: 'risk', labelKey: 'nav.riskAnalytics', path: '/ai/risk', icon: '📊', roles: ['lecturer', 'admin'] },
    ],
  },
  {
    key: 'g-admin', labelKey: 'nav.administration', icon: '🛠️',
    roles: ['admin'],
    children: [
      { key: 'admin-courses',  labelKey: 'nav.courseManagement', path: '/admin/courses',  icon: '📖', roles: ['admin'] },
      { key: 'admin-settings', labelKey: 'nav.settings',         path: '/admin/settings', icon: '⚙️', roles: ['admin'] },
    ],
  },
]

const Sidebar = () => {
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, closeMobileSidebar } = useUIStore()
  const { t } = useTranslation()
  const location = useLocation()

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

  const visibleGroups = NAV_STRUCTURE
    .filter(g => g.roles.includes(user.role))
    .map(g => ({
      ...g,
      children: g.children?.filter(c => c.roles.includes(user.role)),
    }))
    .filter(g => g.path || (g.children && g.children.length > 0))

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
