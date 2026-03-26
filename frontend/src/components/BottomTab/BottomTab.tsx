import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { X, MoreHorizontal, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useLanguageStore } from '@/stores/languageStore'
import { LANGUAGES, type Language } from '@/lib/i18n'
import type { UserRole } from '@/types'
import styles from './BottomTab.module.scss'

interface TabItem {
  key: string
  label: string
  path: string
  icon: string
  roles: UserRole[]
}

const ALL_TABS: TabItem[] = [
  { key: 'dashboard',   label: 'Dashboard',    path: '/dashboard',              icon: '🖥️',  roles: ['admin','manager','finance'] },
  { key: 'apply',       label: 'Apply',        path: '/admission/apply',        icon: '📝',  roles: ['student','admin'] },
  { key: 'admission',   label: 'Applications', path: '/admission/review',       icon: '🎓',  roles: ['admissions','admin'] },
  { key: 'profile',     label: 'Profile',      path: '/student/profile',        icon: '👤',  roles: ['student'] },
  { key: 'courses-reg', label: 'Course Reg.',  path: '/student/courses',        icon: '📋',  roles: ['student','admin'] },
  { key: 'statement',   label: 'Fees',         path: '/finance/statement',      icon: '💳',  roles: ['student','finance','admin'] },
  { key: 'lms',         label: 'Courses',      path: '/lms/courses',            icon: '📚',  roles: ['student','lecturer','admin'] },
  { key: 'attendance',  label: 'Attendance',   path: '/lms/attendance',         icon: '📸',  roles: ['student','lecturer','admin'] },
  { key: 'finance',     label: 'Finance',      path: '/finance/dashboard',      icon: '💰',  roles: ['finance','admin'] },
  { key: 'pr',          label: 'Procurement',  path: '/procurement/requests',   icon: '🛒',  roles: ['manager','finance','admin'] },
  { key: 'approvals',   label: 'Approvals',    path: '/procurement/approvals',  icon: '✅',  roles: ['manager','finance','admin'] },
  { key: 'hr',          label: 'HR Staff',     path: '/hr/staff',               icon: '👥',  roles: ['manager','admin','hradmin'] },
  { key: 'hr-leave',    label: 'Leave',        path: '/hr/leave',               icon: '🏖️', roles: ['lecturer','manager','admin','finance','hradmin'] },
  { key: 'research',    label: 'Research',     path: '/research/grants',        icon: '🔬',  roles: ['lecturer','manager','admin'] },
  { key: 'risk',        label: 'Risk AI',      path: '/ai/risk',                icon: '📊',  roles: ['lecturer','admin'] },
  { key: 'anomalies',   label: 'Anomalies',    path: '/procurement/anomalies',  icon: '🚨',  roles: ['finance','admin'] },
  { key: 'campus',      label: 'Campus',       path: '/campus/services',        icon: '🏛️', roles: ['student','admin'] },
  { key: 'settings',    label: 'Settings',     path: '/admin/settings',         icon: '⚙️', roles: ['admin'] },
]

// Which tabs appear as primary (bottom bar) per role – max 4
const PRIMARY_KEYS: Record<string, string[]> = {
  student:    ['lms', 'apply', 'profile', 'statement'],
  admissions: ['admission'],
  lecturer:   ['lms', 'attendance', 'research', 'hr-leave'],
  manager:    ['dashboard', 'pr', 'hr', 'hr-leave'],
  finance:    ['dashboard', 'finance', 'pr', 'statement'],
  admin:      ['dashboard', 'hr', 'pr', 'settings'],
  hradmin:    ['hr', 'hr-leave'],
}

const BottomTab = () => {
  const [moreOpen, setMoreOpen]       = useState(false)
  const { user, clearAuth }           = useAuthStore()
  const { addToast }                  = useUIStore()
  const { language, setLanguage }     = useLanguageStore()
  const location                = useLocation()
  const navigate                = useNavigate()

  if (!user) return null

  const role        = user.role as string
  const allVisible  = ALL_TABS.filter(t => (t.roles as string[]).includes(role))
  const primaryKeys = PRIMARY_KEYS[role] ?? allVisible.slice(0, 4).map(t => t.key)
  const primaryTabs = primaryKeys
    .map(k => allVisible.find(t => t.key === k))
    .filter(Boolean) as TabItem[]
  const moreTabs    = allVisible.filter(t => !primaryKeys.includes(t.key))
  const showMore    = moreTabs.length > 0

  const handleLogout = () => {
    clearAuth()
    addToast({ type: 'info', message: 'You have been signed out.' })
    navigate('/login', { replace: true })
  }

  const isTabActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <>
      {/* ── Bottom Tab Bar ─────────────────────────────────── */}
      <nav className={styles.tabBar}>
        {primaryTabs.map(tab => (
          <NavLink
            key={tab.key}
            to={tab.path}
            className={`${styles.tab} ${isTabActive(tab.path) ? styles.active : ''}`}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </NavLink>
        ))}

        {showMore && (
          <button
            className={`${styles.tab} ${moreOpen ? styles.active : ''}`}
            onClick={() => setMoreOpen(true)}
          >
            <span className={styles.tabIcon}><MoreHorizontal size={20} /></span>
            <span className={styles.tabLabel}>More</span>
          </button>
        )}
      </nav>

      {/* ── More Sheet ─────────────────────────────────────── */}
      {moreOpen && (
        <>
          <div className={styles.sheetBackdrop} onClick={() => setMoreOpen(false)} />
          <div className={styles.sheet}>
            {/* Handle bar */}
            <div className={styles.sheetHandle} />

            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>More</span>
              <button className={styles.sheetClose} onClick={() => setMoreOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.sheetGrid}>
              {moreTabs.map(tab => (
                <NavLink
                  key={tab.key}
                  to={tab.path}
                  className={`${styles.sheetItem} ${isTabActive(tab.path) ? styles.sheetActive : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className={styles.sheetIcon}>{tab.icon}</span>
                  <span className={styles.sheetLabel}>{tab.label}</span>
                </NavLink>
              ))}
            </div>

            {/* Language switcher */}
            <div className={styles.sheetLang}>
              <span className={styles.sheetLangLabel}>Language</span>
              <div className={styles.sheetLangBtns}>
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    className={`${styles.sheetLangBtn} ${language === l.code ? styles.sheetLangActive : ''}`}
                    onClick={() => setLanguage(l.code as Language)}
                  >
                    {l.nativeLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* User section at bottom of sheet */}
            <div className={styles.sheetUser}>
              <div className={styles.sheetAvatar}>{user.displayName.charAt(0).toUpperCase()}</div>
              <div className={styles.sheetUserInfo}>
                <div className={styles.sheetUserName}>{user.displayName}</div>
                <div className={styles.sheetUserRole}>{role.toUpperCase()}</div>
              </div>
              <button className={styles.sheetLogout} onClick={handleLogout}>
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default BottomTab
