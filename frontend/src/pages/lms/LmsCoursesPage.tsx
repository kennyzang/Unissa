import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, MapPin, User, ChevronRight, AlertTriangle, LayoutGrid, CalendarDays } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import Badge from '@/components/ui/Badge'
import styles from './LmsCoursesPage.module.scss'

interface Enrolment {
  id: string
  status: string
  finalGrade?: string
  offering: {
    id: string
    dayOfWeek: string
    startTime: string
    endTime: string
    room: string
    seatsTaken: number
    course: { name: string; code: string; creditHours: number }
    lecturer: { user: { displayName: string } }
    assignments: Assignment[]
  }
}

interface Assignment {
  id: string
  title: string
  maxMarks: number
  dueDate?: string
  assignmentType: string
}

const GRADE_COLORS: Record<string, 'green' | 'blue' | 'orange' | 'red'> = {
  A_plus: 'green', A: 'green', B_plus: 'blue', B: 'blue',
  C_plus: 'orange', C: 'orange', D: 'orange', F: 'red',
}

const GRADE_LABELS: Record<string, string> = {
  A_plus: 'A+', A: 'A', B_plus: 'B+', B: 'B', C_plus: 'C+', C: 'C', D: 'D', F: 'F',
}

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const COURSE_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
  { bg: '#fdf4ff', border: '#a855f7', text: '#7e22ce' },
  { bg: '#fff7ed', border: '#f97316', text: '#c2410c' },
  { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c' },
  { bg: '#f0f9ff', border: '#0ea5e9', text: '#0369a1' },
]

type ViewMode = 'card' | 'calendar'

const LmsCoursesPage: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { t } = useTranslation()
  const [viewMode, setViewMode]   = useState<ViewMode>('card')
  const [mobileDay, setMobileDay] = useState<string>('')

  const { data: enrolments = [], isLoading } = useQuery<Enrolment[]>({
    queryKey: ['lms', 'courses', '2026001'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lms/courses/2026001')
      return data.data
    },
  })

  const totalCH = enrolments.reduce((s, e) => s + (e.offering?.course?.creditHours ?? 0), 0)
  const totalAssignments = enrolments.reduce((s, e) => s + (e.offering?.assignments?.length ?? 0), 0)

  if (isLoading) return <div className={styles.loading}>{t('lmsCourses.loading')}</div>

  if (enrolments.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>{t('lmsCourses.title')}</h1>
        </div>
        <div className={styles.emptyState}>
          <BookOpen size={40} />
          <h3>{t('lmsCourses.noCourses')}</h3>
          <p>{t('lmsCourses.noCoursesNote')}</p>
          <button className={styles.emptyBtn} onClick={() => navigate('/student/courses')}>
            {t('lmsCourses.registerCourses')}
          </button>
        </div>
      </div>
    )
  }

  // Build a color map per offering id
  const colorMap: Record<string, typeof COURSE_COLORS[0]> = {}
  enrolments.forEach((e, i) => {
    colorMap[e.offering?.id] = COURSE_COLORS[i % COURSE_COLORS.length]
  })

  const renderCardView = () => (
    <div className={styles.courseGrid}>
      {enrolments.map(enrolment => {
        const off = enrolment.offering
        if (!off) return null
        const pendingAssignments = off.assignments?.filter(a => a.dueDate && new Date(a.dueDate) > new Date()) ?? []

        return (
          <div
            key={enrolment.id}
            className={styles.courseCard}
            onClick={() => navigate(`/lms/courses/${off.id}`)}
          >
            <div className={styles.cardHeader}>
              <div className={styles.courseIcon}>
                <BookOpen size={20} />
              </div>
              <div className={styles.courseInfo}>
                <div className={styles.courseCode}>{off.course?.code}</div>
                <div className={styles.courseName}>{off.course?.name}</div>
              </div>
              {enrolment.finalGrade && (
                <Badge color={GRADE_COLORS[enrolment.finalGrade] ?? 'gray'}>
                  {GRADE_LABELS[enrolment.finalGrade] ?? enrolment.finalGrade}
                </Badge>
              )}
            </div>

            <div className={styles.cardMeta}>
              <div className={styles.metaItem}>
                <User size={12} />
                <span>{off.lecturer?.user?.displayName ?? 'TBA'}</span>
              </div>
              <div className={styles.metaItem}>
                <Clock size={12} />
                <span>{off.dayOfWeek} {off.startTime}–{off.endTime}</span>
              </div>
              <div className={styles.metaItem}>
                <MapPin size={12} />
                <span>{off.room}</span>
              </div>
            </div>

            <div className={styles.cardFooter}>
              <div className={styles.footerLeft}>
                <Badge color="blue" size="sm">{off.course?.creditHours} CH</Badge>
                {pendingAssignments.length > 0 && (
                  <Badge color="orange" size="sm">
                    <AlertTriangle size={10} /> {pendingAssignments.length} due
                  </Badge>
                )}
              </div>
              <ChevronRight size={16} className={styles.arrowIcon} />
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderCalendarView = () => {
    // Group enrolments by day
    const byDay: Record<string, Enrolment[]> = {}
    WEEK_DAYS.forEach(d => { byDay[d] = [] })
    enrolments.forEach(e => {
      const day = e.offering?.dayOfWeek
      if (day && byDay[day] !== undefined) byDay[day].push(e)
    })

    const activeDays = WEEK_DAYS.filter(d => byDay[d].length > 0)
    const displayDays = activeDays.length > 0 ? activeDays : WEEK_DAYS.slice(0, 5)

    // Mobile: current selected day (default first active day)
    const currentMobileDay = mobileDay && displayDays.includes(mobileDay) ? mobileDay : displayDays[0]

    const renderSlots = (day: string) =>
      byDay[day].map(enrolment => {
        const off = enrolment.offering
        const color = colorMap[off.id]
        const pendingCount = off.assignments?.filter(a => a.dueDate && new Date(a.dueDate) > new Date()).length ?? 0
        return (
          <div
            key={enrolment.id}
            className={styles.calendarSlot}
            style={{ background: color.bg, borderColor: color.border }}
            onClick={() => navigate(`/lms/courses/${off.id}`)}
          >
            <div className={styles.slotCode} style={{ color: color.text }}>{off.course?.code}</div>
            <div className={styles.slotName}>{off.course?.name}</div>
            <div className={styles.slotMeta}><Clock size={11} /><span>{off.startTime}–{off.endTime}</span></div>
            <div className={styles.slotMeta}><MapPin size={11} /><span>{off.room}</span></div>
            <div className={styles.slotFooter}>
              <Badge color="blue" size="sm">{off.course?.creditHours} CH</Badge>
              {pendingCount > 0 && <Badge color="orange" size="sm"><AlertTriangle size={9} /> {pendingCount}</Badge>}
              {enrolment.finalGrade && (
                <Badge color={GRADE_COLORS[enrolment.finalGrade] ?? 'gray'} size="sm">
                  {GRADE_LABELS[enrolment.finalGrade]}
                </Badge>
              )}
            </div>
          </div>
        )
      })

    return (
      <div className={styles.calendarView}>
        {/* ── Mobile: day tabs + single-day content ── */}
        <div className={styles.mobileDayTabs}>
          {displayDays.map(day => (
            <button
              key={day}
              className={`${styles.mobileDayTab} ${currentMobileDay === day ? styles.mobileDayTabActive : ''}`}
              onClick={() => setMobileDay(day)}
            >
              <span className={styles.mobileDayTabName}>{t(`lmsCourses.days.${day.toLowerCase()}`, { defaultValue: day.slice(0, 3) })}</span>
              {byDay[day].length > 0 && <span className={styles.mobileDayTabDot} />}
            </button>
          ))}
        </div>
        <div className={styles.mobileDayContent}>
          {byDay[currentMobileDay].length === 0
            ? <div className={styles.calendarEmpty}>—</div>
            : renderSlots(currentMobileDay)
          }
        </div>

        {/* ── Desktop: full week grid ── */}
        <div className={styles.calendarGrid} style={{ gridTemplateColumns: `repeat(${displayDays.length}, 1fr)` }}>
          {displayDays.map(day => (
            <div key={day} className={styles.calendarColumn}>
              <div className={`${styles.calendarDayHeader} ${byDay[day].length > 0 ? styles.calendarDayHeaderActive : ''}`}>
                <span className={styles.calendarDayName}>{t(`lmsCourses.days.${day.toLowerCase()}`, { defaultValue: day.slice(0, 3) })}</span>
                {byDay[day].length > 0 && <span className={styles.calendarDayCount}>{byDay[day].length}</span>}
              </div>
              <div className={styles.calendarSlots}>
                {byDay[day].length === 0
                  ? <div className={styles.calendarEmpty}>—</div>
                  : renderSlots(day)
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('lmsCourses.title')}</h1>
          <p className={styles.pageSub}>{t('lmsCourses.semesterLabel')} {enrolments.length} {t('lmsCourses.courses')} {totalCH} {t('lmsCourses.creditHours')}</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.headerStats}>
            <div className={styles.headerStat}>
              <span>{totalCH}</span>
              <label>{t('lmsCourses.creditHours')}</label>
            </div>
            <div className={styles.headerStat}>
              <span>{totalAssignments}</span>
              <label>{t('lmsCourses.assignments')}</label>
            </div>
            <div className={styles.headerStat}>
              <span>{enrolments.length}</span>
              <label>{t('nav.myCourses')}</label>
            </div>
          </div>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'card' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('card')}
              title={t('lmsCourses.cardView', { defaultValue: 'Card View' })}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'calendar' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('calendar')}
              title={t('lmsCourses.calendarView', { defaultValue: 'Calendar View' })}
            >
              <CalendarDays size={16} />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'card' ? renderCardView() : renderCalendarView()}
    </div>
  )
}

export default LmsCoursesPage
