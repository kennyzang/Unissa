import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { apiClient } from '@/lib/apiClient'
import styles from './Navbar.module.scss'

// Breadcrumb map
const BREADCRUMBS: Record<string, string[]> = {
  '/dashboard':              ['Command Center'],
  '/admission/apply':        ['Admission', 'Apply'],
  '/admission/review':       ['Admission', 'Applications'],
  '/student/profile':        ['Student', 'My Profile'],
  '/student/courses':        ['Student', 'Course Registration'],
  '/finance/statement':      ['Finance', 'Fee Statement'],
  '/finance/dashboard':      ['Finance', 'Dashboard'],
  '/lms/courses':            ['LMS', 'My Courses'],
  '/lms/attendance':         ['LMS', 'Attendance'],
  '/procurement/requests':   ['Procurement', 'Purchase Requests'],
  '/procurement/approvals':  ['Procurement', 'Approval Inbox'],
  '/procurement/anomalies':  ['Procurement', 'Anomaly Detection'],
  '/hr/staff':               ['HR', 'Staff Management'],
  '/hr/leave':               ['HR', 'Leave Management'],
  '/research/grants':        ['Research', 'Grants'],
  '/ai/risk':                ['AI', 'Risk Analytics'],
  '/campus/services':        ['Campus', 'Services'],
  '/admin/settings':         ['Admin', 'Settings'],
}

interface Notification {
  id: string
  subject: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
}

const Navbar = () => {
  const { user, clearAuth }     = useAuthStore()
  const { addToast }            = useUIStore()
  const navigate                              = useNavigate()
  const location            = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)

  const crumbs = BREADCRUMBS[location.pathname] ?? ['UNISSA']

  // Load unread notifications count
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/notifications')
        return data.data ?? []
      } catch {
        return []
      }
    },
    refetchInterval: 60000, // refresh every minute
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleLogout = () => {
    clearAuth()
    addToast({ type: 'info', message: 'You have been signed out.' })
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.navbar}>
      {/* Mobile: brand logo (replaces hamburger) */}
      <div className={styles.mobileBrand}>
        <div className={styles.mobileBrandMark}>U</div>
        <span className={styles.mobileBrandName}>UNISSA</span>
      </div>

      {/* Desktop: breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="breadcrumb">
        <span className={styles.crumbRoot}>UNISSA</span>
        {crumbs.map((c, i) => (
          <span key={i}>
            <span className={styles.separator}>/</span>
            <span className={i === crumbs.length - 1 ? styles.crumbActive : styles.crumb}>{c}</span>
          </span>
        ))}
      </nav>

      {/* Mobile: current page title */}
      <span className={styles.mobilePageTitle}>{crumbs[crumbs.length - 1]}</span>

      {/* Right: user actions */}
      <div className={styles.right}>
        {/* Notifications Bell */}
        <div className={styles.notifWrap}>
          <button
            className={styles.iconBtn}
            title="Notifications"
            onClick={() => setNotifOpen(o => !o)}
          >
            <Bell size={16} />
            {unreadCount > 0 && <span className={styles.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {notifOpen && (
            <div className={styles.notifDropdown}>
              <div className={styles.notifHeader}>
                <span>Notifications</span>
                {unreadCount > 0 && <span className={styles.unreadLabel}>{unreadCount} unread</span>}
              </div>
              <div className={styles.notifList}>
                {notifications.length === 0 ? (
                  <div className={styles.notifEmpty}>No notifications</div>
                ) : (
                  notifications.slice(0, 8).map(n => (
                    <div key={n.id} className={`${styles.notifItem} ${!n.isRead ? styles.notifUnread : ''}`}>
                      <div className={styles.notifSubject}>{n.subject}</div>
                      <div className={styles.notifBody}>{n.body}</div>
                      <div className={styles.notifTime}>{new Date(n.createdAt).toLocaleDateString('en-GB')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings link (admin only) */}
        {user?.role === 'admin' && (
          <Link to="/admin/settings" className={styles.iconBtn} title="Settings">
            <Settings size={16} />
          </Link>
        )}

        {user && (
          <div className={styles.userMenu}>
            <div className={styles.avatar}>{user.displayName.charAt(0).toUpperCase()}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.displayName}</span>
              <span className={styles.userRole}>{user.role}</span>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Sign Out">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Close notif panel on outside click */}
      {notifOpen && <div className={styles.overlay} onClick={() => setNotifOpen(false)} />}
    </header>
  )
}

export default Navbar
