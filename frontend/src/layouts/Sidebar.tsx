import { useState } from 'react'
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
}

interface NavGroup {
  key: string
  label: string
  icon: string
  roles: UserRole[]   // union of children roles – who might see this group
  path?: string       // direct link (no children)
  children?: NavItem[]
}

// ── Navigation structure ──────────────────────────────────────────
const NAV_STRUCTURE: NavGroup[] = [
  // Direct items (no group wrapper)
  {
    key: 'dashboard', label: 'Command Center', icon: '🖥️',
    path: '/dashboard', roles: ['admin', 'manager', 'finance'],
  },

  // Student Affairs
  {
    key: 'g-student', label: 'Student Affairs', icon: '🎓',
    roles: ['student', 'admissions', 'admin'],
    children: [
      { key: 'apply',       label: 'Apply',           path: '/admission/apply',   icon: '📝', roles: ['student', 'admin'] },
      { key: 'admission',   label: 'Applications',    path: '/admission/review',  icon: '🎓', roles: ['admissions', 'admin'] },
      { key: 'profile',     label: 'My Profile',      path: '/student/profile',   icon: '👤', roles: ['student'] },
      { key: 'courses-reg', label: 'Course Reg.',     path: '/student/courses',   icon: '📋', roles: ['student', 'admin'] },
      { key: 'statement',   label: 'Fee Statement',   path: '/finance/statement', icon: '💳', roles: ['student', 'finance', 'admin'] },
      { key: 'campus',      label: 'Campus Services', path: '/campus/services',   icon: '🏛️', roles: ['student', 'admin'] },
    ],
  },

  // Learning (LMS)
  {
    key: 'g-lms', label: 'Learning', icon: '📚',
    roles: ['student', 'lecturer', 'admin'],
    children: [
      { key: 'lms',        label: 'My Courses', path: '/lms/courses',    icon: '📚', roles: ['student', 'lecturer', 'admin'] },
      { key: 'attendance', label: 'Attendance', path: '/lms/attendance', icon: '📸', roles: ['student', 'lecturer', 'admin'] },
    ],
  },

  // Finance
  {
    key: 'g-finance', label: 'Finance', icon: '💰',
    roles: ['finance', 'admin'],
    children: [
      { key: 'finance', label: 'Finance Dashboard', path: '/finance/dashboard', icon: '💰', roles: ['finance', 'admin'] },
    ],
  },

  // Procurement
  {
    key: 'g-procurement', label: 'Procurement', icon: '🛒',
    roles: ['manager', 'finance', 'admin'],
    children: [
      { key: 'pr',        label: 'Purchase Requests', path: '/procurement/requests',  icon: '🛒', roles: ['manager', 'finance', 'admin'] },
      { key: 'approvals', label: 'Approvals',         path: '/procurement/approvals', icon: '✅', roles: ['manager', 'finance', 'admin'] },
      { key: 'anomalies', label: 'Anomaly Detect.',   path: '/procurement/anomalies', icon: '🚨', roles: ['finance', 'admin'] },
    ],
  },

  // Human Resources
  {
    key: 'g-hr', label: 'Human Resources', icon: '👥',
    roles: ['lecturer', 'manager', 'admin', 'finance', 'hradmin'],
    children: [
      { key: 'hr',       label: 'HR & Staff',       path: '/hr/staff',  icon: '👥', roles: ['manager', 'admin', 'hradmin'] },
      { key: 'hr-leave', label: 'Leave Management', path: '/hr/leave',  icon: '🏖️', roles: ['lecturer', 'manager', 'admin', 'finance', 'hradmin'] },
    ],
  },

  // Research
  {
    key: 'g-research', label: 'Research', icon: '🔬',
    roles: ['lecturer', 'manager', 'admin'],
    children: [
      { key: 'research', label: 'Research Grants', path: '/research/grants', icon: '🔬', roles: ['lecturer', 'manager', 'admin'] },
    ],
  },

  // AI & Analytics
  {
    key: 'g-ai', label: 'AI & Analytics', icon: '📊',
    roles: ['lecturer', 'finance', 'admin'],
    children: [
      { key: 'risk', label: 'Risk Analytics', path: '/ai/risk', icon: '📊', roles: ['lecturer', 'admin'] },
    ],
  },

  // System (Admin only)
  {
    key: 'settings', label: 'Settings', icon: '⚙️',
    path: '/admin/settings', roles: ['admin'],
  },
]

// ── Component ─────────────────────────────────────────────────────
const Sidebar = () => {
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, closeMobileSidebar } = useUIStore()
  const location = useLocation()

  // All groups start expanded
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

  // Filter groups/items visible to this user's role
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
        {visibleGroups.map(group => {
          // Direct link (no children)
          if (group.path) {
            return (
              <NavLink
                key={group.key}
                to={group.path}
                onClick={closeMobileSidebar}
                className={({ isActive: a }) =>
                  clsx(styles.navItem, { [styles.active]: a || isActive(group.path!) })
                }
                title={sidebarCollapsed ? group.label : undefined}
              >
                <span className={styles.navIcon}>{group.icon}</span>
                {!sidebarCollapsed && <span className={styles.navLabel}>{group.label}</span>}
              </NavLink>
            )
          }

          // Group with children
          const children = group.children ?? []
          const isOpen = expanded.has(group.key)
          const hasActiveChild = children.some(c => isActive(c.path))

          return (
            <div key={group.key}>
              {/* Group header – only shown when sidebar is not collapsed */}
              {!sidebarCollapsed && (
                <div
                  className={clsx(styles.groupHeader, { [styles.active]: hasActiveChild && !isOpen })}
                  onClick={() => toggleGroup(group.key)}
                  title={group.label}
                >
                  <span className={styles.groupIcon}>{group.icon}</span>
                  <span className={styles.groupLabel}>{group.label}</span>
                  <span className={clsx(styles.groupChevron, { [styles.open]: isOpen })}>▶</span>
                </div>
              )}

              {/* Children (or show all as flat items when sidebar is icon-only) */}
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
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!sidebarCollapsed && <span className={styles.navLabel}>{item.label}</span>}
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
