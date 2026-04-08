import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bell, Settings, LogOut, Check, Scan } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useLanguageStore } from '@/stores/languageStore'
import { LANGUAGES } from '@/lib/i18n'
import { apiClient } from '@/lib/apiClient'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import styles from './Navbar.module.scss'

interface Notification {
  id: string
  subject: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
  triggeredByEvent?: string
}

const Navbar = () => {
  const { user, clearAuth }     = useAuthStore()
  const { addToast }            = useUIStore()
  const { t }                   = useTranslation()
  const navigate                = useNavigate()
  const location                = useLocation()
  const qc                      = useQueryClient()
  const [notifOpen, setNotifOpen]   = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const { language, setLanguage }   = useLanguageStore()

  // Breadcrumb map using translated labels (aligned with sidebar nav.* keys)
  const BREADCRUMBS: Record<string, string[]> = {
    '/dashboard':              [t('nav.commandCenter')],
    '/admission/apply':        [t('nav.admissions'), t('nav.apply')],
    '/admission/review':       [t('nav.admissions'), t('nav.applications')],
    '/student/profile':        [t('nav.myCampus'), t('nav.myInfo')],
    '/student/courses':        [t('nav.myCampus'), t('nav.courseSelection')],
    '/student/transcript':     [t('nav.myCampus'), t('nav.myGrades')],
    '/finance/statement':      [t('nav.myCampus'), t('nav.myPayment')],
    '/finance/dashboard':      [t('nav.financeControlCenter'), t('nav.financeOverview')],
    '/lms/courses':            [t('nav.myLearning'), t('nav.myCourses')],
    '/lms/attendance':         [t('nav.myLearning'), t('nav.myAttendance')],
    '/procurement/requests':   [t('nav.procurementManagement'), t('nav.procurementApplication')],
    '/procurement/approvals':  [t('nav.procurementManagement'), t('nav.procurementApproval')],
    '/procurement/anomalies':  [t('nav.procurementManagement'), t('nav.procurementAnomaly')],
    '/hr/staff':               [t('nav.humanResources'), t('nav.staffInfo')],
    '/hr/leave':               [t('nav.humanResources'), t('nav.leaveApproval')],
    '/research/grants':        [t('nav.researchManagement'), t('nav.researchFund')],
    '/ai/risk':                [t('nav.learningAnalysis')],
    '/campus/services':        [t('nav.myCampus'), t('nav.campusServices')],
    '/admin/settings':         [t('nav.systemOperation')],
  }

  const crumbs = BREADCRUMBS[location.pathname] ?? ['UNISSA']

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
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleLogout = () => {
    clearAuth()
    qc.clear()
    // Hard reload to /login resets all in-memory JS state (React Query cache,
    // Zustand slices, axios instances, etc.) so no data leaks to the next user.
    window.location.replace('/login')
  }

  const handleNotificationClick = async (notification: Notification) => {
    setNotifOpen(false)
    
    if (!notification.isRead) {
      try {
        await apiClient.patch(`/notifications/${notification.id}/read`)
        qc.invalidateQueries({ queryKey: ['notifications'] })
      } catch (e) {
        console.error('Failed to mark notification as read:', e)
      }
    }

    if (notification.type === 'grade_updated') {
      navigate('/student/transcript')
    } else if (notification.type === 'assignment_submission') {
      navigate('/lms/grading')
    }
  }

  return (
    <header className={styles.navbar}>
      {/* Mobile: brand logo */}
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
        {/* Language switcher – hidden on mobile (moved to BottomTab More sheet) */}
        <div className={styles.languageWrap}>
          <LanguageSwitcher variant="select" />
        </div>

        {/* Notifications Bell */}
        <div className={styles.notifWrap}>
          <button
            className={styles.iconBtn}
            title={t('navbar.notifications')}
            onClick={() => setNotifOpen(o => !o)}
          >
            <Bell size={16} />
            {unreadCount > 0 && <span className={styles.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {notifOpen && (
            <div className={styles.notifDropdown}>
              <div className={styles.notifHeader}>
                <span>{t('navbar.notifications')}</span>
                {unreadCount > 0 && <span className={styles.unreadLabel}>{t('navbar.unread', { count: unreadCount })}</span>}
              </div>
              <div className={styles.notifList}>
                {notifications.length === 0 ? (
                  <div className={styles.notifEmpty}>{t('navbar.noNotifications')}</div>
                ) : (
                  notifications.slice(0, 8).map(n => (
                    <div 
                      key={n.id} 
                      className={`${styles.notifItem} ${!n.isRead ? styles.notifUnread : ''}`}
                      onClick={() => handleNotificationClick(n)}
                      style={{ cursor: 'pointer' }}
                    >
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

        {/* QR Code Scan for Attendance (Student only) */}
        {user?.role === 'student' && (
          <Link to="/lms/attendance/scan" className={`${styles.iconBtn} ${styles.qrScanBtn}`} title={t('navbar.qrScan')}>
            <Scan size={16} />
          </Link>
        )}

        {/* Settings link (admin only) */}
        {user?.role === 'admin' && (
          <Link to="/admin/settings" className={styles.iconBtn} title={t('navbar.breadcrumbs.settingsLabel')}>
            <Settings size={16} />
          </Link>
        )}

        {user && (
          <div className={styles.userMenu}>
            {/* Avatar – clickable on mobile to open panel */}
            <div
              className={styles.avatar}
              onClick={() => setAvatarOpen(o => !o)}
              style={{ cursor: 'pointer' }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.displayName}</span>
              <span className={styles.userRole}>{user.role}</span>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout} title={t('navbar.signOut')}>
              <LogOut size={14} />
            </button>

            {/* Mobile avatar dropdown */}
            {avatarOpen && (
              <div className={styles.avatarDropdown}>
                {/* User info */}
                <div className={styles.avatarDropdownUser}>
                  <div className={styles.avatarDropdownAvatar}>{user.displayName.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className={styles.avatarDropdownName}>{user.displayName}</div>
                    <div className={styles.avatarDropdownRole}>{user.role.toUpperCase()}</div>
                  </div>
                </div>
                {/* Language list */}
                <div className={styles.avatarDropdownLangSection}>
                  <div className={styles.avatarDropdownLangLabel}>Language</div>
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      className={`${styles.avatarDropdownLangRow} ${language === l.code ? styles.avatarDropdownLangRowActive : ''}`}
                      onClick={() => { setLanguage(l.code); setAvatarOpen(false) }}
                    >
                      <span className={styles.avatarDropdownLangName}>{l.nativeLabel}</span>
                      <span className={styles.avatarDropdownLangSub}>{l.label}</span>
                      {language === l.code && <Check size={14} className={styles.avatarDropdownLangCheck} />}
                    </button>
                  ))}
                </div>
                {/* Sign out */}
                <button className={styles.avatarDropdownLogout} onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>{t('navbar.signOut')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close panels on outside click */}
      {(notifOpen || avatarOpen) && (
        <div className={styles.overlay} onClick={() => { setNotifOpen(false); setAvatarOpen(false) }} />
      )}
    </header>
  )
}

export default Navbar
