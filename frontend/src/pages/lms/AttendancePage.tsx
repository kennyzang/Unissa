import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, Users, CheckCircle, Clock, BookOpen, ChevronDown,
  ChevronUp, RefreshCw, X, UserCheck, AlertTriangle, Calendar,
  Copy, Check,
} from 'lucide-react'
import { QRCode } from 'antd'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import Badge from '@/components/ui/Badge'
import styles from './AttendancePage.module.scss'

// ─── Clipboard fallback (works on HTTP / non-secure contexts) ─────────────────
function fallbackCopy(text: string, onDone: () => void) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  try { document.execCommand('copy'); onDone() } catch {}
  document.body.removeChild(el)
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttendanceSession {
  id: string
  offeringId: string
  sessionToken: string
  qrExpiresAt: string
  startedAt: string
  endedAt: string | null
  qrData?: string
  records?: { id: string; status: string; scannedAt: string; studentId: string }[]
}

interface OfferingWithCount {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  course: { name: string; code: string }
  _count: { enrolments: number; attendanceSessions: number }
}

interface AttendanceSummaryRow {
  studentId: string
  name: string
  present: number
  total: number
  attendancePct: number
}

interface StudentCourseSummary {
  offeringId: string
  courseName: string
  courseCode: string
  present: number
  total: number
  attendancePct: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pctColor = (pct: number): 'green' | 'orange' | 'red' =>
  pct >= 80 ? 'green' : pct >= 60 ? 'orange' : 'red'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })

// ─── QR Session Panel (Lecturer) ──────────────────────────────────────────────
const ActiveSessionPanel: React.FC<{
  session: AttendanceSession
  onClose: () => void
}> = ({ session, onClose }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [liveCount, setLiveCount] = useState(session.records?.length ?? 0)
  const [copied, setCopied] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expired = new Date(session.qrExpiresAt) < new Date()
  const token = session.qrData ?? session.sessionToken

  const closeMutation = useMutation({
    mutationFn: () => apiClient.patch(`/lms/attendance/sessions/${session.id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions'] })
      onClose()
    },
  })

  useEffect(() => {
    if (expired || session.endedAt) return
    const fetch = async () => {
      try {
        const { data } = await apiClient.get(`/lms/attendance/live-count/${session.id}`)
        setLiveCount(data.data.count)
      } catch {}
    }
    fetch()
    intervalRef.current = setInterval(fetch, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [session.id, expired, session.endedAt])

  const handleCopy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2500) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(done).catch(() => fallbackCopy(token, done))
    } else {
      fallbackCopy(token, done)
    }
  }

  return (
    <div className={styles.activePanel}>
      <div className={styles.activePanelHeader}>
        <div>
          <h3 className={styles.activePanelTitle}>{t('attendance.activeSession')}</h3>
          <span className={styles.activePanelSub}>
            {t('attendance.started')}: {fmtTime(session.startedAt)} &nbsp;·&nbsp;
            {expired
              ? <span className={styles.expiredText}>{t('attendance.expired')}</span>
              : <span className={styles.activeText}>{t('attendance.expiresAt')} {fmtTime(session.qrExpiresAt)}</span>
            }
          </span>
        </div>
        <button
          className={styles.closeSessionBtn}
          onClick={() => closeMutation.mutate()}
          disabled={closeMutation.isPending}
        >
          <X size={14} /> {t('attendance.closeSession')}
        </button>
      </div>

      <div className={styles.activePanelBody}>
        <div className={styles.qrWrapper}>
          {expired
            ? <div className={styles.qrExpired}><Clock size={32} /><span>{t('attendance.qrExpired')}</span></div>
            : <QRCode value={token} size={180} />
          }
          <p className={styles.qrHint}>{t('attendance.qrHint')}</p>
        </div>

        <div className={styles.tokenSection}>
          <div className={styles.tokenLabel}>
            <QrCode size={14} />
            {t('attendance.sessionToken')}
          </div>
          <div className={styles.tokenBox}>
            <span className={styles.tokenText}>{token}</span>
            <button
              className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
              onClick={handleCopy}
              title={t('attendance.copyToken')}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('attendance.copied') : t('attendance.copyToken')}
            </button>
          </div>
          <p className={styles.tokenNote}>{t('attendance.tokenNote')}</p>
        </div>

        <div className={styles.liveStats}>
          <div className={styles.liveCount}>
            <UserCheck size={28} />
            <span className={styles.liveCountNum}>{liveCount}</span>
            <span className={styles.liveCountLabel}>{t('attendance.present')}</span>
          </div>
          {!expired && !session.endedAt && (
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              {t('attendance.liveUpdating')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Lecturer View ────────────────────────────────────────────────────────────
const LecturerView: React.FC<{ lecturerId: string }> = ({ lecturerId }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)
  const [expandedOffering, setExpandedOffering] = useState<string | null>(null)

  const { data: offerings = [], isLoading: loadingOfferings } = useQuery<OfferingWithCount[]>({
    queryKey: ['attendance', 'offerings', lecturerId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/offerings/lecturer/${lecturerId}`)
      return data.data
    },
  })

  const startSessionMutation = useMutation({
    mutationFn: (offeringId: string) =>
      apiClient.post('/lms/attendance/sessions', { offeringId }),
    onSuccess: (res) => {
      setActiveSession(res.data.data)
      queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions'] })
    },
  })

  const { data: sessionData } = useQuery<AttendanceSession[]>({
    queryKey: ['attendance', 'sessions', expandedOffering],
    queryFn: async () => {
      if (!expandedOffering) return []
      const { data } = await apiClient.get(`/lms/attendance/sessions/offering/${expandedOffering}`)
      return data.data
    },
    enabled: !!expandedOffering,
  })

  if (loadingOfferings) return <div className={styles.loading}>{t('attendance.loading')}</div>

  if (offerings.length === 0) {
    return (
      <div className={styles.emptyState}>
        <BookOpen size={36} />
        <p>{t('attendance.noOfferings')}</p>
      </div>
    )
  }

  return (
    <div className={styles.lecturerView}>
      {activeSession && (
        <ActiveSessionPanel
          session={activeSession}
          onClose={() => setActiveSession(null)}
        />
      )}

      <div className={styles.offeringList}>
        {offerings.map(off => {
          const isExpanded = expandedOffering === off.id
          return (
            <div key={off.id} className={styles.offeringCard}>
              <div className={styles.offeringCardHeader}>
                <div className={styles.offeringInfo}>
                  <span className={styles.offeringCode}>{off.course.code}</span>
                  <span className={styles.offeringName}>{off.course.name}</span>
                  <span className={styles.offeringMeta}>
                    {off.dayOfWeek} · {off.startTime}–{off.endTime} · {off.room}
                  </span>
                </div>
                <div className={styles.offeringActions}>
                  <div className={styles.offeringStats}>
                    <Badge color="blue" size="sm">
                      <Users size={11} /> {off._count.enrolments} {t('attendance.enrolled')}
                    </Badge>
                    <Badge color="gray" size="sm">
                      <Calendar size={11} /> {off._count.attendanceSessions} {t('attendance.sessions')}
                    </Badge>
                  </div>
                  <button
                    className={styles.startBtn}
                    onClick={() => startSessionMutation.mutate(off.id)}
                    disabled={startSessionMutation.isPending}
                  >
                    <QrCode size={14} />
                    {startSessionMutation.isPending ? t('attendance.starting') : t('attendance.startSession')}
                  </button>
                  <button
                    className={styles.expandBtn}
                    onClick={() => setExpandedOffering(isExpanded ? null : off.id)}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.sessionHistory}>
                  <h4 className={styles.historyTitle}>{t('attendance.sessionHistory')}</h4>
                  {!sessionData || sessionData.length === 0
                    ? <p className={styles.noHistory}>{t('attendance.noSessions')}</p>
                    : sessionData.map(sess => {
                        const count = sess.records?.filter(r => r.status === 'present').length ?? 0
                        const isExpired = new Date(sess.qrExpiresAt) < new Date()
                        return (
                          <div key={sess.id} className={styles.sessionRow}>
                            <div className={styles.sessionRowLeft}>
                              <span className={styles.sessionDate}>{fmtDate(sess.startedAt)}</span>
                              <span className={styles.sessionTime}>
                                {fmtTime(sess.startedAt)}
                                {sess.endedAt ? ` – ${fmtTime(sess.endedAt)}` : ''}
                              </span>
                            </div>
                            <div className={styles.sessionRowRight}>
                              <Badge color="green" size="sm">
                                <CheckCircle size={10} /> {count} {t('attendance.present')}
                              </Badge>
                              <Badge color={isExpired || sess.endedAt ? 'gray' : 'orange'} size="sm">
                                {sess.endedAt ? t('attendance.closed') : isExpired ? t('attendance.expired') : t('attendance.open')}
                              </Badge>
                            </div>
                          </div>
                        )
                      })
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Student View ─────────────────────────────────────────────────────────────
const StudentView: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { t } = useTranslation()
  const [token, setToken] = useState('')
  const [checkinMsg, setCheckinMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<{
    summary: StudentCourseSummary[]
    records: any[]
  }>({
    queryKey: ['attendance', 'student', studentId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/records/student/${studentId}`)
      return data.data
    },
  })

  const checkinMutation = useMutation({
    mutationFn: () => apiClient.post('/lms/attendance/check-in', { token, studentId }),
    onSuccess: (res) => {
      setCheckinMsg({ ok: true, text: res.data.message ?? t('attendance.checkinSuccess') })
      setToken('')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'student', studentId] })
      setTimeout(() => setCheckinMsg(null), 4000)
    },
    onError: (err: any) => {
      setCheckinMsg({ ok: false, text: err.response?.data?.message ?? t('attendance.checkinError') })
      setTimeout(() => setCheckinMsg(null), 4000)
    },
  })

  if (isLoading) return <div className={styles.loading}>{t('attendance.loading')}</div>

  const summary = data?.summary ?? []

  return (
    <div className={styles.studentView}>
      {/* Manual token check-in */}
      <div className={styles.checkinCard}>
        <h3 className={styles.checkinTitle}>
          <QrCode size={18} /> {t('attendance.manualCheckin')}
        </h3>
        <p className={styles.checkinHint}>{t('attendance.manualCheckinHint')}</p>
        <div className={styles.checkinRow}>
          <input
            className={styles.tokenInput}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={t('attendance.tokenPlaceholder')}
          />
          <button
            className={styles.checkinBtn}
            onClick={() => checkinMutation.mutate()}
            disabled={!token.trim() || checkinMutation.isPending}
          >
            <CheckCircle size={14} />
            {checkinMutation.isPending ? t('attendance.checking') : t('attendance.checkIn')}
          </button>
        </div>
        {checkinMsg && (
          <div className={`${styles.checkinMsg} ${checkinMsg.ok ? styles.checkinMsgOk : styles.checkinMsgErr}`}>
            {checkinMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {checkinMsg.text}
          </div>
        )}
      </div>

      {/* Per-course summary */}
      <div className={styles.summaryGrid}>
        {summary.length === 0
          ? (
            <div className={styles.emptyState}>
              <Calendar size={36} />
              <p>{t('attendance.noRecords')}</p>
            </div>
          )
          : summary.map(s => (
            <div key={s.offeringId} className={styles.summaryCard}>
              <div className={styles.summaryCardTop}>
                <span className={styles.summaryCode}>{s.courseCode}</span>
                <Badge color={pctColor(s.attendancePct)}>
                  {s.attendancePct}%
                </Badge>
              </div>
              <div className={styles.summaryCourseName}>{s.courseName}</div>
              <div className={styles.summaryBar}>
                <div
                  className={styles.summaryBarFill}
                  style={{
                    width: `${s.attendancePct}%`,
                    background: s.attendancePct >= 80 ? 'var(--color-success)' : s.attendancePct >= 60 ? '#f59e0b' : 'var(--color-danger)',
                  }}
                />
              </div>
              <div className={styles.summaryMeta}>
                <span><CheckCircle size={12} /> {s.present} / {s.total} {t('attendance.sessions')}</span>
                {s.attendancePct < 80 && (
                  <span className={styles.warningText}>
                    <AlertTriangle size={12} /> {t('attendance.belowThreshold')}
                  </span>
                )}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── Admin View ───────────────────────────────────────────────────────────────
const AdminView: React.FC = () => {
  const { t } = useTranslation()
  const [selectedOffering, setSelectedOffering] = useState<string | null>(null)

  const { data: offerings = [], isLoading: loadingOfferings } = useQuery<OfferingWithCount[]>({
    queryKey: ['attendance', 'all-offerings'],
    queryFn: async () => {
      // Admin sees all offerings — reuse lecturer endpoint with a sentinel
      const { data } = await apiClient.get('/lms/attendance/offerings/lecturer/all')
      return data.data
    },
  })

  const { data: report } = useQuery<{ summary: AttendanceSummaryRow[]; sessions: AttendanceSession[] }>({
    queryKey: ['attendance', 'report', selectedOffering],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/records/offering/${selectedOffering}`)
      return data.data
    },
    enabled: !!selectedOffering,
  })

  if (loadingOfferings) return <div className={styles.loading}>{t('attendance.loading')}</div>

  return (
    <div className={styles.adminView}>
      <div className={styles.adminOfferingSelect}>
        <label className={styles.selectLabel}>{t('attendance.selectCourse')}</label>
        <select
          className={styles.courseSelect}
          value={selectedOffering ?? ''}
          onChange={e => setSelectedOffering(e.target.value || null)}
        >
          <option value="">{t('attendance.chooseCourse')}</option>
          {offerings.map(o => (
            <option key={o.id} value={o.id}>
              {o.course.code} – {o.course.name}
            </option>
          ))}
        </select>
      </div>

      {selectedOffering && report && (
        <div className={styles.reportSection}>
          <div className={styles.reportStats}>
            <div className={styles.reportStat}>
              <span>{report.sessions.length}</span>
              <label>{t('attendance.totalSessions')}</label>
            </div>
            <div className={styles.reportStat}>
              <span>{report.summary.length}</span>
              <label>{t('attendance.studentsTracked')}</label>
            </div>
            <div className={styles.reportStat}>
              <span>
                {report.summary.length > 0
                  ? Math.round(report.summary.reduce((s, r) => s + r.attendancePct, 0) / report.summary.length)
                  : 0}%
              </span>
              <label>{t('attendance.avgAttendance')}</label>
            </div>
          </div>

          <div className={styles.reportTable}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('attendance.student')}</th>
                  <th className={styles.centerCol}>{t('attendance.present')}</th>
                  <th className={styles.centerCol}>{t('attendance.totalSessions')}</th>
                  <th className={styles.centerCol}>{t('attendance.rate')}</th>
                  <th className={styles.centerCol}>{t('attendance.status')}</th>
                </tr>
              </thead>
              <tbody>
                {report.summary.map(row => (
                  <tr key={row.studentId}>
                    <td>{row.name}</td>
                    <td className={styles.centerCol}>{row.present}</td>
                    <td className={styles.centerCol}>{row.total}</td>
                    <td className={styles.centerCol}>
                      <div className={styles.tableBarWrap}>
                        <div className={styles.tableBar}>
                          <div
                            className={styles.tableBarFill}
                            style={{
                              width: `${row.attendancePct}%`,
                              background: row.attendancePct >= 80 ? 'var(--color-success)' : row.attendancePct >= 60 ? '#f59e0b' : 'var(--color-danger)',
                            }}
                          />
                        </div>
                        <span>{row.attendancePct}%</span>
                      </div>
                    </td>
                    <td className={styles.centerCol}>
                      <Badge color={pctColor(row.attendancePct)} size="sm">
                        {row.attendancePct >= 80
                          ? t('attendance.good')
                          : row.attendancePct >= 60
                          ? t('attendance.warning')
                          : t('attendance.critical')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedOffering && !report && (
        <div className={styles.loading}><RefreshCw size={16} /> {t('attendance.loading')}</div>
      )}

      {!selectedOffering && (
        <div className={styles.emptyState}>
          <BookOpen size={36} />
          <p>{t('attendance.selectToView')}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const AttendancePage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const hasRole = useAuthStore(s => s.hasRole)

  const { data: studentProfile } = useQuery({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
    enabled: !!user && hasRole('student'),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('attendance.title')}</h1>
          <p className={styles.pageSub}>
            {hasRole('lecturer')
              ? t('attendance.subLecturer')
              : hasRole('student')
              ? t('attendance.subStudent')
              : t('attendance.subAdmin')}
          </p>
        </div>
      </div>

      {hasRole('lecturer') && user?.id && (
        <LecturerView lecturerId={user.id} />
      )}
      {hasRole('student') && studentProfile?.id && (
        <StudentView studentId={studentProfile.id} />
      )}
      {hasRole('admin') && (
        <AdminView />
      )}
    </div>
  )
}

export default AttendancePage
