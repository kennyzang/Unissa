import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import type { UserRole } from '@/types'
import styles from './Sidebar.module.scss'

interface NavItem {
  key: string
  label: string
  path: string
  icon: string
  roles: UserRole[]
  children?: NavItem[]
}

const NAV_ITEMS: NavItem[] = [
  // Dashboard
  { key: 'dashboard',    label: 'Command Center',   path: '/dashboard',              icon: '🖥️',  roles: ['admin','manager','finance'] },

  // Student lifecycle
  { key: 'apply',        label: 'Apply',             path: '/admission/apply',        icon: '📝',  roles: ['student','admin'] },
  { key: 'admission',    label: 'Applications',      path: '/admission/review',       icon: '🎓',  roles: ['admissions','admin'] },
  { key: 'profile',      label: 'My Profile',        path: '/student/profile',        icon: '👤',  roles: ['student'] },
  { key: 'courses-reg',  label: 'Course Reg.',       path: '/student/courses',        icon: '📋',  roles: ['student','admin'] },
  { key: 'statement',    label: 'Fee Statement',     path: '/finance/statement',      icon: '💳',  roles: ['student','finance','admin'] },

  // LMS
  { key: 'lms',          label: 'My Courses',        path: '/lms/courses',            icon: '📚',  roles: ['student','lecturer','admin'] },
  { key: 'attendance',   label: 'Attendance',        path: '/lms/attendance',         icon: '📸',  roles: ['student','lecturer','admin'] },

  // Finance
  { key: 'finance',      label: 'Finance',           path: '/finance/dashboard',      icon: '💰',  roles: ['finance','admin'] },

  // Procurement
  { key: 'pr',           label: 'Procurement',       path: '/procurement/requests',   icon: '🛒',  roles: ['manager','finance','admin'] },
  { key: 'approvals',    label: 'Approvals',         path: '/procurement/approvals',  icon: '✅',  roles: ['manager','finance','admin'] },

  // HR
  { key: 'hr',           label: 'HR & Staff',        path: '/hr/staff',               icon: '👥',  roles: ['manager','admin','hradmin'] },
  { key: 'hr-leave',     label: 'Leave Management',  path: '/hr/leave',               icon: '🏖️', roles: ['lecturer','manager','admin','finance','hradmin'] },

  // Research
  { key: 'research',     label: 'Research Grants',   path: '/research/grants',        icon: '🔬',  roles: ['lecturer','manager','admin'] },

  // AI
  { key: 'risk',         label: 'Risk Analytics',    path: '/ai/risk',                icon: '📊',  roles: ['lecturer','admin'] },
  { key: 'anomalies',    label: 'Anomaly Detect.',   path: '/procurement/anomalies',  icon: '🚨',  roles: ['finance','admin'] },

  // Campus
  { key: 'campus',       label: 'Campus Services',   path: '/campus/services',        icon: '🏛️', roles: ['student','admin'] },

  // Admin
  { key: 'settings',     label: 'Settings',          path: '/admin/settings',         icon: '⚙️', roles: ['admin'] },
]

const Sidebar = () => {
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, closeMobileSidebar } = useUIStore()
  const location = useLocation()

  const visible = NAV_ITEMS.filter(item =>
    user && item.roles.includes(user.role)
  )

  return (
    <>
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div className={styles.backdrop} onClick={closeMobileSidebar} />
      )}

      <aside className={clsx(styles.sidebar, {
        [styles.collapsed]:   sidebarCollapsed,
        [styles.mobileOpen]:  mobileSidebarOpen,
      })}>
        {/* Header */}
        <div className={styles.header}>
          {!sidebarCollapsed && (
            <div className={styles.brand}>
              <div className={styles.brandMark}>U</div>
              <div className={styles.brandText}>
                <div className={styles.brandName}>UNISSA</div>
                <div className={styles.brandSub}>Smart Platform</div>
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
          {visible.map(item => (
            <NavLink
              key={item.key}
              to={item.path}
              onClick={closeMobileSidebar}
              className={({ isActive }) =>
                clsx(styles.navItem, {
                  [styles.active]: isActive || location.pathname.startsWith(item.path + '/'),
                })
              }
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!sidebarCollapsed && <span className={styles.navLabel}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User info at bottom */}
        {user && !sidebarCollapsed && (
          <div className={styles.userInfo}>
            <div className={styles.avatar}>{user.displayName.charAt(0).toUpperCase()}</div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{user.displayName}</div>
              <div className={styles.userRole}>{user.role.toUpperCase()}</div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

export default Sidebar
