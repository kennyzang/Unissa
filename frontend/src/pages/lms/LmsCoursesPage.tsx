import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, MapPin, User, ChevronRight, AlertTriangle, LayoutGrid, CalendarDays, Users } from 'lucide-react'
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

interface LecturerOffering {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  course: { name: string; code: string; creditHours: number }
  _count: { enrolments: number; attendanceSessions: number }
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

// ─── Lecturer View ────────────────────────────────────────────────────────────
const LecturerCoursesView: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [mobileDay, setMobileDay] = useState<string>('')

  const { data: offerings = [], isLoading } = useQuery<LecturerOffering[]>({
    queryKey: ['lms', 'lecturer-offerings', user?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/offerings/lecturer/${user!.id}`)
      return data.data
    },
    enabled: !!user,
  })

  if (isLoading) return <div className={styles.loading}>{t('lmsCourses.loading')}</div>

  if (offerings.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>{t('lmsCourses.title')}</h1>
        </div>
        <div className={styles.emptyState}>
          <BookOpen size={40} />
          <h3>{t('lmsCourses.noCoursesLecturer', { defaultValue: 'No courses assigned' })}</h3>
          <p>{t('lmsCourses.noCoursesLecturerNote', { defaultValue: 'You have no course offerings assigned for this semester.' })}</p>
        </div>
      </div>
    )
  }

  const totalCH = offerings.reduce((s, o) => s + (o.course?.creditHours ?? 0), 0)
  const totalStudents = offerings.reduce((s, o) => s + (o._count?.enrolments ?? 0), 0)

  const colorMap: Record<string, typeof COURSE_COLORS[0]> = {}
  offerings.forEach((o, i) => { colorMap[o.id] = COURSE_COLORS[i % COURSE_COLORS.length] })

  const renderCardView = () => (
    <div className={styles.courseGrid}>
      {offerings.map(offering => {
        const color = colorMap[offering.id]
        return (
          <div
            key={offering.id}
            className={styles.courseCard}
            onClick={() => navigate(`/lms/attendance`)}
            style={{ borderLeft: `3px solid ${color.border}` }}
          >
            <div className={styles.cardHeader}>
              <div className={styles.courseIcon}>
                <BookOpen size={20} />
              </div>
              <div className={styles.courseInfo}>
                <div className={styles.courseCode}>{offering.course?.code}</div>
                <div className={styles.courseName}>{offering.course?.name}</div>
              </div>
              <Badge color="blue">{offering.course?.creditHours} CH</Badge>
            </div>

            <div className={styles.cardMeta}>
              <div className={styles.metaItem}>
                <Clock size={12} />
                <span>{offering.dayOfWeek} {offering.startTime}–{offering.endTime}</span>
              </div>
              <div className={styles.metaItem}>
                <MapPin size={12} />
                <span>{offering.room}</span>
              </div>
              <div className={styles.metaItem}>
                <Users size={12} />
                <span>{offering._count?.enrolments ?? 0} {t('lmsCourses.students', { defaultValue: 'students' })}</span>
              </div>
            </div>

            <div className={styles.cardFooter}>
              <div className={styles.footerLeft}>
                <Badge color="green" size="sm">
                  {offering._count?.attendanceSessions ?? 0} {t('lmsCourses.sessions', { defaultValue: 'sessions' })}
                </Badge>
              </div>
              <ChevronRight size={16} className={styles.arrowIcon} />
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderCalendarView = () => {
    const byDay: Record<string, LecturerOffering[]> = {}
    WEEK_DAYS.forEach(d => { byDay[d] = [] })
    offerings.forEach(o => {
      if (o.dayOfWeek && byDay[o.dayOfWeek] !== undefined) byDay[o.dayOfWeek].push(o)
    })

    const activeDays = WEEK_DAYS.filter(d => byDay[d].length > 0)
    const displayDays = activeDays.length > 0 ? activeDays : WEEK_DAYS.slice(0, 5)
    const currentMobileDay = mobileDay && displayDays.includes(mobileDay) ? mobileDay : displayDays[0]

    const renderSlots = (day: string) =>
      byDay[day].map(offering => {
        const color = colorMap[offering.id]
        return (
          <div
            key={offering.id}
            className={styles.calendarSlot}
            style={{ background: color.bg, borderColor: color.border }}
            onClick={() => navigate(`/lms/attendance`)}
          >
            <div className={styles.slotCode} style={{ color: color.text }}>{offering.course?.code}</div>
            <div className={styles.slotName}>{offering.course?.name}</div>
            <div className={styles.slotMeta}><Clock size={11} /><span>{offering.startTime}–{offering.endTime}</span></div>
            <div className={styles.slotMeta}><MapPin size={11} /><span>{offering.room}</span></div>
            <div className={styles.slotFooter}>
              <Badge color="blue" size="sm">{offering.course?.creditHours} CH</Badge>
              <Badge color="green" size="sm">
                <Users size={9} /> {offering._count?.enrolments ?? 0}
              </Badge>
            </div>
          </div>
        )
      })

    return (
      <div className={styles.calendarView}>
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
          <p className={styles.pageSub}>
            {t('lmsCourses.semesterLabel')} {offerings.length} {t('lmsCourses.courses')} · {totalStudents} {t('lmsCourses.students', { defaultValue: 'students' })} · {totalCH} {t('lmsCourses.creditHours')}
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.headerStats}>
            <div className={styles.headerStat}>
              <span>{offerings.length}</span>
              <label>{t('lmsCourses.courses')}</label>
            </div>
            <div className={styles.headerStat}>
              <span>{totalStudents}</span>
              <label>{t('lmsCourses.students', { defaultValue: 'Students' })}</label>
            </div>
            <div className={styles.headerStat}>
              <span>{totalCH}</span>
              <label>{t('lmsCourses.creditHours')}</label>
            </div>
          </div>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'card' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'calendar' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('calendar')}
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

// ─── Student View ─────────────────────────────────────────────────────────────
const StudentCoursesView: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [mobileDay, setMobileDay] = useState<string>('')

  const { data: studentProfile } = useQuery({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
    enabled: !!user,
  })

  const { data: enrolments = [], isLoading: enrolmentsLoading } = useQuery<Enrolment[]>({
    queryKey: ['lms', 'courses', studentProfile?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/courses/${studentProfile!.id}`)
      return data.data
    },
    enabled: !!studentProfile?.id,
  })

  const { data: availableOfferings = [], isLoading: offeringsLoading } = useQuery({
    queryKey: ['offerings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/offerings')
      return (data.data ?? []).length > 0 ? data.data : []
    },
    enabled: !!user,
  })

  const totalCH = enrolments.reduce((s, e) => s + (e.offering?.course?.creditHours ?? 0), 0)
  const totalAssignments = enrolments.reduce((s, e) => s + (e.offering?.assignments?.length ?? 0), 0)

  const isLoading = enrolmentsLoading || offeringsLoading

  if (isLoading) return <div className={styles.loading}>{t('lmsCourses.loading')}</div>

  if (enrolments.length === 0 && availableOfferings.length === 0) {
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

  const colorMap: Record<string, typeof COURSE_COLORS[0]> = {}
  enrolments.forEach((e, i) => { colorMap[e.offering?.id] = COURSE_COLORS[i % COURSE_COLORS.length] })

  // Generate all possible time slots
  const generateTimeSlots = () => {
    const timeSlots = []
    const startHour = 8
    const endHour = 18
    const slotDuration = 60 // minutes

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        const endHourCalc = hour + Math.floor((minute + slotDuration) / 60)
        const endMinute = (minute + slotDuration) % 60
        const endTime = `${endHourCalc.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
        timeSlots.push({ startTime, endTime })
      }
    }
    return timeSlots
  }

  const timeSlots = generateTimeSlots()

  // Categorize time slots
  const categorizeTimeSlots = (day: string) => {
    const enrolledSlots = enrolments
      .filter(e => e.offering?.dayOfWeek === day)
      .map(e => e.offering!)
    
    const availableSlots = availableOfferings
      .filter(o => o.dayOfWeek === day)
      .filter(o => !enrolledSlots.some(es => es.startTime === o.startTime && es.endTime === o.endTime))
    
    const categorizedSlots = timeSlots.map(slot => {
      const enrolledSlot = enrolledSlots.find(es => es.startTime === slot.startTime && es.endTime === slot.endTime)
      const availableSlot = availableSlots.find(as => as.startTime === slot.startTime && as.endTime === slot.endTime)
      
      if (enrolledSlot) {
        return { ...slot, type: 'enrolled' as const, data: enrolledSlot }
      } else if (availableSlot) {
        return { ...slot, type: 'available' as const, data: availableSlot }
      } else {
        return { ...slot, type: 'blocked' as const, data: null }
      }
    })
    
    return categorizedSlots
  }

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
    const displayDays = WEEK_DAYS
    const currentMobileDay = mobileDay && displayDays.includes(mobileDay) ? mobileDay : displayDays[0]

    const renderSlots = (day: string) => {
      const slots = categorizeTimeSlots(day)
      
      return slots.map((slot, index) => {
        if (slot.type === 'enrolled') {
          const off = slot.data
          const color = colorMap[off.id]
          const pendingCount = off.assignments?.filter(a => a.dueDate && new Date(a.dueDate) > new Date()).length ?? 0
          const enrolment = enrolments.find(e => e.offering?.id === off.id)
          
          return (
            <div
              key={`${day}-${slot.startTime}-${index}`}
              className={styles.calendarSlot}
              style={{ background: color.bg, borderColor: color.border }}
              onClick={() => navigate(`/lms/courses/${off.id}`)}
            >
              <div className={styles.slotCode} style={{ color: color.text }}>{off.course?.code}</div>
              <div className={styles.slotName}>{off.course?.name}</div>
              <div className={styles.slotMeta}><Clock size={11} /><span>{slot.startTime}–{slot.endTime}</span></div>
              <div className={styles.slotMeta}><MapPin size={11} /><span>{off.room}</span></div>
              <div className={styles.slotFooter}>
                <Badge color="blue" size="sm">{off.course?.creditHours} CH</Badge>
                {pendingCount > 0 && <Badge color="orange" size="sm"><AlertTriangle size={9} /> {pendingCount}</Badge>}
                {enrolment?.finalGrade && (
                  <Badge color={GRADE_COLORS[enrolment.finalGrade] ?? 'gray'} size="sm">
                    {GRADE_LABELS[enrolment.finalGrade]}
                  </Badge>
                )}
              </div>
            </div>
          )
        } else if (slot.type === 'available') {
          const off = slot.data
          return (
            <div
              key={`${day}-${slot.startTime}-${index}`}
              className={`${styles.calendarSlot} ${styles.availableSlot}`}
              onClick={() => navigate('/student/courses')}
            >
              <div className={styles.slotCode} style={{ color: '#10b981' }}>{off.course?.code}</div>
              <div className={styles.slotName}>{off.course?.name}</div>
              <div className={styles.slotMeta}><Clock size={11} /><span>{slot.startTime}–{slot.endTime}</span></div>
              <div className={styles.slotMeta}><MapPin size={11} /><span>{off.room}</span></div>
              <div className={styles.slotFooter}>
                <Badge color="green" size="sm">{off.course?.creditHours} CH</Badge>
                <Badge color="green" size="sm">Available</Badge>
              </div>
            </div>
          )
        } else {
          return (
            <div
              key={`${day}-${slot.startTime}-${index}`}
              className={`${styles.calendarSlot} ${styles.blockedSlot}`}
            >
              <div className={styles.slotTime}>{slot.startTime}–{slot.endTime}</div>
              <div className={styles.slotStatus}>Unavailable</div>
            </div>
          )
        }
      })
    }

    return (
      <div className={styles.calendarView}>
        <div className={styles.mobileDayTabs}>
          {displayDays.map(day => (
            <button
              key={day}
              className={`${styles.mobileDayTab} ${currentMobileDay === day ? styles.mobileDayTabActive : ''}`}
              onClick={() => setMobileDay(day)}
            >
              <span className={styles.mobileDayTabName}>{t(`lmsCourses.days.${day.toLowerCase()}`, { defaultValue: day.slice(0, 3) })}</span>
            </button>
          ))}
        </div>
        <div className={styles.mobileDayContent}>
          {renderSlots(currentMobileDay)}
        </div>
        <div className={styles.calendarGrid} style={{ gridTemplateColumns: `repeat(${displayDays.length}, 1fr)` }}>
          {displayDays.map(day => (
            <div key={day} className={styles.calendarColumn}>
              <div className={styles.calendarDayHeader}>
                <span className={styles.calendarDayName}>{t(`lmsCourses.days.${day.toLowerCase()}`, { defaultValue: day.slice(0, 3) })}</span>
              </div>
              <div className={styles.calendarSlots}>
                {renderSlots(day)}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.calendarLegend}>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: '#eff6ff', borderColor: '#3b82f6' }}></div>
            <span>Enrolled</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: '#f0fdf4', borderColor: '#22c55e' }}></div>
            <span>Available</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: '#f3f4f6', borderColor: '#d1d5db' }}></div>
            <span>Unavailable</span>
          </div>
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

// ─── Root: role-based dispatch ────────────────────────────────────────────────
const LmsCoursesPage: React.FC = () => {
  const user = useAuthStore(s => s.user)
  if (!user) return null
  return user.role === 'lecturer' ? <LecturerCoursesView /> : <StudentCoursesView />
}

export default LmsCoursesPage
