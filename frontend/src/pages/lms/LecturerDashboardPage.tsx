import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  BookOpen, Users, ClipboardList, Clock, CheckCircle,
  ChevronDown, ChevronRight, AlertTriangle, User, Award,
} from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import styles from './LecturerDashboardPage.module.scss'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LecturerDashboard {
  staff: {
    id: string
    staffId: string
    fullName: string
    designation: string | null
    department: string | null
    email: string | null
  }
  offerings: OfferingSnapshot[]
}

interface OfferingSnapshot {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  course: { code: string; name: string; creditHours: number }
  semester: { id: string; name: string; isActive: boolean }
  enrolledCount: number
  students: StudentRow[]
  assignments: AssignmentRow[]
  recentAttendanceSessions: AttendanceSessionRow[]
}

interface StudentRow {
  name: string
  studentId: string
  cgpa: number
}

interface AssignmentRow {
  id: string
  title: string
  dueDate: string | null
  maxMarks: number
  weightPct: number
  submissionCount: number
  enrolledCount: number
}

interface AttendanceSessionRow {
  id: string
  name: string | null
  startedAt: string
  endedAt: string | null
  presentCount: number
  totalEnrolled: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type TabKey = 'students' | 'assignments' | 'attendance'

const CGPA_COLOR = (cgpa: number): 'green' | 'blue' | 'orange' | 'red' =>
  cgpa >= 3.5 ? 'green' : cgpa >= 3.0 ? 'blue' : cgpa >= 2.0 ? 'orange' : 'red'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const isPast = (d: string | null) => !!d && new Date(d) < new Date()

// ─── Offering Card ────────────────────────────────────────────────────────────
const OfferingCard: React.FC<{ offering: OfferingSnapshot }> = ({ offering }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab]           = useState<TabKey>('students')

  const pendingAssignments = offering.assignments.filter(
    a => !isPast(a.dueDate) || a.submissionCount < a.enrolledCount,
  )

  return (
    <div className={styles.offeringCard}>
      {/* ── Card Header ── */}
      <button
        className={styles.offeringHeader}
        onClick={() => setExpanded(v => !v)}
        type="button"
      >
        <div className={styles.offeringLeft}>
          <div className={styles.courseCode}>{offering.course.code}</div>
          <div className={styles.courseName}>{offering.course.name}</div>
          <div className={styles.offeringMeta}>
            <span className={styles.metaChip}>
              <Clock size={12} />{offering.dayOfWeek} {offering.startTime}–{offering.endTime}
            </span>
            <span className={styles.metaChip}>{offering.room}</span>
            {offering.semester.isActive && (
              <Badge color="green" size="sm">{t('lecturerDashboard.active', { defaultValue: 'Active' })}</Badge>
            )}
            <Badge color="gray" size="sm">{offering.semester.name}</Badge>
          </div>
        </div>

        <div className={styles.offeringStats}>
          <div className={styles.statPill}>
            <Users size={14} />
            <span>{offering.enrolledCount}</span>
            <label>{t('lecturerDashboard.students', { defaultValue: 'Students' })}</label>
          </div>
          <div className={styles.statPill}>
            <ClipboardList size={14} />
            <span>{offering.assignments.length}</span>
            <label>{t('lecturerDashboard.assignments', { defaultValue: 'Assignments' })}</label>
          </div>
          <div className={styles.statPill}>
            <Clock size={14} />
            <span>{offering.recentAttendanceSessions.length}</span>
            <label>{t('lecturerDashboard.sessions', { defaultValue: 'Sessions' })}</label>
          </div>
          {pendingAssignments.length > 0 && (
            <Badge color="orange" size="sm">
              <AlertTriangle size={10} /> {pendingAssignments.length} {t('lecturerDashboard.pending', { defaultValue: 'pending' })}
            </Badge>
          )}
          {expanded ? <ChevronDown size={18} className={styles.chevron} /> : <ChevronRight size={18} className={styles.chevron} />}
        </div>
      </button>

      {/* ── Expanded Detail ── */}
      {expanded && (
        <div className={styles.offeringDetail}>
          {/* Tab Bar */}
          <div className={styles.tabBar}>
            {(['students', 'assignments', 'attendance'] as TabKey[]).map(t => (
              <button
                key={t}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => setTab(t)}
                type="button"
              >
                {t === 'students'    && <Users size={14} />}
                {t === 'assignments' && <ClipboardList size={14} />}
                {t === 'attendance' && <Clock size={14} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'students'    && ` (${offering.students.length})`}
                {t === 'assignments' && ` (${offering.assignments.length})`}
                {t === 'attendance' && ` (${offering.recentAttendanceSessions.length})`}
              </button>
            ))}
          </div>

          {/* ── Students Tab ── */}
          {tab === 'students' && (
            offering.students.length === 0
              ? <p className={styles.empty}>{t('lecturerDashboard.noStudents', { defaultValue: 'No enrolled students.' })}</p>
              : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t('lecturerDashboard.name', { defaultValue: 'Name' })}</th>
                        <th>{t('lecturerDashboard.studentId', { defaultValue: 'Student ID' })}</th>
                        <th>{t('lecturerDashboard.cgpa', { defaultValue: 'CGPA' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offering.students.map((s, i) => (
                        <tr key={s.studentId}>
                          <td className={styles.tdNum}>{i + 1}</td>
                          <td>
                            <div className={styles.studentName}>
                              <User size={14} />
                              {s.name}
                            </div>
                          </td>
                          <td className={styles.tdMono}>{s.studentId}</td>
                          <td>
                            <Badge color={CGPA_COLOR(s.cgpa)} size="sm">
                              {s.cgpa.toFixed(2)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}

          {/* ── Assignments Tab ── */}
          {tab === 'assignments' && (
            offering.assignments.length === 0
              ? <p className={styles.empty}>{t('lecturerDashboard.noAssignments', { defaultValue: 'No assignments created.' })}</p>
              : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{t('lecturerDashboard.title', { defaultValue: 'Title' })}</th>
                        <th>{t('lecturerDashboard.dueDate', { defaultValue: 'Due Date' })}</th>
                        <th>{t('lecturerDashboard.submissions', { defaultValue: 'Submissions' })}</th>
                        <th>{t('lecturerDashboard.progress', { defaultValue: 'Progress' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offering.assignments.map(a => {
                        const pct = a.enrolledCount > 0
                          ? Math.round((a.submissionCount / a.enrolledCount) * 100)
                          : 0
                        const overdue = isPast(a.dueDate) && a.submissionCount < a.enrolledCount
                        return (
                          <tr key={a.id}>
                            <td>
                              <div className={styles.assignTitle}>
                                {overdue && <AlertTriangle size={13} className={styles.overdue} />}
                                {a.title}
                              </div>
                              <div className={styles.assignMeta}>{a.weightPct}% · {a.maxMarks} {t('lecturerDashboard.marks', { defaultValue: 'marks' })}</div>
                            </td>
                            <td>
                              <span className={overdue ? styles.overdue : ''}>
                                {fmtDate(a.dueDate)}
                              </span>
                            </td>
                            <td className={styles.tdCenter}>
                              {a.submissionCount} / {a.enrolledCount}
                            </td>
                            <td>
                              <div className={styles.progressWrap}>
                                <div
                                  className={styles.progressBar}
                                  style={{
                                    width: `${pct}%`,
                                    background: pct === 100 ? 'var(--color-success)' :
                                                overdue    ? 'var(--color-danger)'  : 'var(--color-brand)',
                                  }}
                                />
                                <span className={styles.progressLabel}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
          )}

          {/* ── Attendance Tab ── */}
          {tab === 'attendance' && (
            offering.recentAttendanceSessions.length === 0
              ? <p className={styles.empty}>{t('lecturerDashboard.noSessions', { defaultValue: 'No attendance sessions yet.' })}</p>
              : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{t('lecturerDashboard.session', { defaultValue: 'Session' })}</th>
                        <th>{t('lecturerDashboard.date', { defaultValue: 'Date' })}</th>
                        <th>{t('lecturerDashboard.present', { defaultValue: 'Present' })}</th>
                        <th>{t('lecturerDashboard.attendancePct', { defaultValue: 'Attendance %' })}</th>
                        <th>{t('lecturerDashboard.status', { defaultValue: 'Status' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offering.recentAttendanceSessions.map(s => {
                        const pct = s.totalEnrolled > 0
                          ? Math.round((s.presentCount / s.totalEnrolled) * 100)
                          : 0
                        return (
                          <tr key={s.id}>
                            <td>{s.name ?? 'Session'}</td>
                            <td>{fmtDate(s.startedAt)}</td>
                            <td className={styles.tdCenter}>{s.presentCount} / {s.totalEnrolled}</td>
                            <td>
                              <div className={styles.progressWrap}>
                                <div
                                  className={styles.progressBar}
                                  style={{
                                    width: `${pct}%`,
                                    background: pct >= 80 ? 'var(--color-success)' :
                                                pct >= 60 ? 'var(--color-warning)' : 'var(--color-danger)',
                                  }}
                                />
                                <span className={styles.progressLabel}>{pct}%</span>
                              </div>
                            </td>
                            <td>
                              {s.endedAt
                                ? <Badge color="gray"  size="sm"><CheckCircle size={11} /> {t('lecturerDashboard.closed', { defaultValue: 'Closed' })}</Badge>
                                : <Badge color="green" size="sm">{t('lecturerDashboard.live', { defaultValue: 'Live' })}</Badge>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const LecturerDashboardPage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)

  const { data, isLoading, isError } = useQuery<LecturerDashboard>({
    queryKey: ['lms', 'lecturer', 'dashboard'],
    queryFn:  async () => {
      const { data } = await apiClient.get('/lms/lecturer/dashboard')
      return data.data
    },
    enabled: !!user,
  })

  if (isLoading) return <div className={styles.loading}>{t('lecturerDashboard.loading', { defaultValue: 'Loading dashboard…' })}</div>
  if (isError || !data) return <div className={styles.loading}>{t('lecturerDashboard.loadingFailed', { defaultValue: 'Failed to load lecturer dashboard.' })}</div>

  const { staff, offerings } = data

  const totalStudents    = offerings.reduce((s, o) => s + o.enrolledCount, 0)
  const totalAssignments = offerings.reduce((s, o) => s + o.assignments.length, 0)
  const totalSessions    = offerings.reduce((s, o) => s + o.recentAttendanceSessions.length, 0)
  const activeSemesters  = new Set(offerings.filter(o => o.semester.isActive).map(o => o.semester.name))

  return (
    <div className={styles.page}>
      {/* ── Staff Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroAvatar}>
          <Award size={32} />
        </div>
        <div className={styles.heroInfo}>
          <h1 className={styles.heroName}>{staff.fullName}</h1>
          <div className={styles.heroMeta}>
            <span>{staff.staffId}</span>
            {staff.designation && <span>· {staff.designation}</span>}
            {staff.department  && <span>· {staff.department}</span>}
            {staff.email       && <span>· {staff.email}</span>}
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span>{offerings.length}</span>
            <label>Courses</label>
          </div>
          <div className={styles.heroStat}>
            <span>{totalStudents}</span>
            <label>Students</label>
          </div>
          <div className={styles.heroStat}>
            <span>{totalAssignments}</span>
            <label>Assignments</label>
          </div>
          <div className={styles.heroStat}>
            <span>{totalSessions}</span>
            <label>Sessions</label>
          </div>
        </div>
      </div>

      {/* ── Active Semester Tags ── */}
      {activeSemesters.size > 0 && (
        <div className={styles.semesterRow}>
          {[...activeSemesters].map(sem => (
            <Badge key={sem} color="blue">{sem}</Badge>
          ))}
        </div>
      )}

      {/* ── Offerings ── */}
      {offerings.length === 0
        ? (
          <Card>
            <div className={styles.empty}>
              <BookOpen size={40} />
              <p>{t('lecturerDashboard.noCourses', { defaultValue: 'No course offerings assigned.' })}</p>
            </div>
          </Card>
        )
        : offerings.map(o => <OfferingCard key={o.id} offering={o} />)
      }
    </div>
  )
}

export default LecturerDashboardPage
