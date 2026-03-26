import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bell, Settings, LogOut, Check } from 'lucide-react'
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
}

const Navbar = () => {
  const { user, clearAuth }     = useAuthStore()
  const { addToast }            = useUIStore()
  const { t }                   = useTranslation()
  const navigate                = useNavigate()
  const location                = useLocation()
  const [notifOpen, setNotifOpen]   = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const { language, setLanguage }   = useLanguageStore()

  // Breadcrumb map using translated labels
  const BREADCRUMBS: Record<string, string[]> = {
    '/dashboard':              [t('navbar.breadcrumbs.commandCenter')],
    '/admission/apply':        [t('navbar.breadcrumbs.admission'), t('navbar.breadcrumbs.applyLabel')],
    '/admission/review':       [t('navbar.breadcrumbs.admission'), t('navbar.breadcrumbs.applicationsLabel')],
    '/student/profile':        [t('navbar.breadcrumbs.student'), t('navbar.breadcrumbs.myProfile')],
    '/student/courses':        [t('navbar.breadcrumbs.student'), t('navbar.breadcrumbs.courseRegistration')],
    '/finance/statement':      [t('navbar.breadcrumbs.finance'), t('navbar.breadcrumbs.feeStatement')],
    '/finance/dashboard':      [t('navbar.breadcrumbs.finance'), t('navbar.breadcrumbs.dashboard')],
    '/lms/courses':            [t('navbar.breadcrumbs.lms'), t('navbar.breadcrumbs.myCourses')],
    '/lms/attendance':         [t('navbar.breadcrumbs.lms'), t('navbar.breadcrumbs.attendance')],
    '/procurement/requests':   [t('navbar.breadcrumbs.procurement'), t('navbar.breadcrumbs.purchaseRequests')],
    '/procurement/approvals':  [t('navbar.breadcrumbs.procurement'), t('navbar.breadcrumbs.approvalInbox')],
    '/procurement/anomalies':  [t('navbar.breadcrumbs.procurement'), t('navbar.breadcrumbs.anomalyDetection')],
    '/hr/staff':               [t('navbar.breadcrumbs.hr'), t('navbar.breadcrumbs.staffManagement')],
    '/hr/leave':               [t('navbar.breadcrumbs.hr'), t('navbar.breadcrumbs.leaveManagement')],
    '/research/grants':        [t('navbar.breadcrumbs.research'), t('navbar.breadcrumbs.grants')],
    '/ai/risk':                [t('navbar.breadcrumbs.ai'), t('navbar.breadcrumbs.riskAnalytics')],
    '/campus/services':        [t('navbar.breadcrumbs.campus'), t('navbar.breadcrumbs.services')],
    '/admin/settings':         [t('navbar.breadcrumbs.admin'), t('navbar.breadcrumbs.settingsLabel')],
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
    refetchInterval: 60000,
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleLogout = () => {
    clearAuth()
    addToast({ type: 'info', message: t('navbar.signedOut') })
    navigate('/login', { replace: true })
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
