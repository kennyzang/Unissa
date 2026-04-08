import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, MapPin, User, ChevronRight, AlertTriangle, LayoutGrid, CalendarDays, Users, Plus } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { Select } from 'antd'
import CourseCalendar, { type CalendarEntry } from './CourseCalendar'
import styles from './LmsCoursesPage.module.scss'

const { Option } = Select

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
  const navigate    = useNavigate()
  const user        = useAuthStore(s => s.user)
  const { t }       = useTranslation()
  const queryClient = useQueryClient()
  const addToast    = useUIStore(s => s.addToast)
  const [viewMode, setViewMode]         = useState<ViewMode>('card')
  const [proposeModal, setProposeModal] = useState(false)
  const [proposeForm, setProposeForm]   = useState({ code: '', name: '', departmentId: '', creditHours: '3' })
  const [proposeError, setProposeError] = useState('')

  // GET /admin/departments for the department field in propose modal
  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin', 'departments'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/departments')
      return data.data
    },
  })

  const proposeMutation = useMutation({
    mutationFn: () => apiClient.post('/lms/courses/propose', {
      code:         proposeForm.code.toUpperCase(),
      name:         proposeForm.name,
      departmentId: proposeForm.departmentId,
      creditHours:  Number(proposeForm.creditHours),
    }),
    onSuccess: (res) => {
      const courseName = res.data?.data?.name ?? proposeForm.name
      addToast({ type: 'success', message: `Course proposal "${courseName}" submitted — pending admin approval.` })
      setProposeModal(false)
      setProposeForm({ code: '', name: '', departmentId: '', creditHours: '3' })
      setProposeError('')
    },
    onError: (e: any) => {
      setProposeError(e.response?.data?.message ?? t('lmsCourses.proposeFailed', { defaultValue: 'Failed to submit proposal. Please try again.' }))
    },
  })

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
          <Button icon={<Plus size={14} />} onClick={() => setProposeModal(true)} style={{ marginTop: 16 }}>
            {t('lmsCourses.proposeCourse', { defaultValue: 'Propose New Course' })}
          </Button>
        </div>

        {/* Propose Course Modal — also needed from empty state */}
        <Modal
          open={proposeModal}
          title={t('lmsCourses.proposeCourseTitle', { defaultValue: 'Propose a New Course' })}
          onClose={() => { setProposeModal(false); setProposeError('') }}
          footer={null}
        >
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            {t('lmsCourses.proposeCourseNote', { defaultValue: 'Your proposal will be submitted to the admin for review. Once approved, the course will appear in the course catalogue.' })}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label={t('courseManagement.fieldCode')}
              required
              value={proposeForm.code}
              onChange={e => setProposeForm(f => ({ ...f, code: (e.target as HTMLInputElement).value.toUpperCase() }))}
              hint="Uppercase letters, digits and hyphens only (e.g. IFN401)"
            />
            <Input
              label={t('courseManagement.fieldName')}
              required
              value={proposeForm.name}
              onChange={e => setProposeForm(f => ({ ...f, name: (e.target as HTMLInputElement).value }))}
            />
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{t('courseManagement.fieldDepartment')} *</label>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                value={proposeForm.departmentId}
                onChange={value => setProposeForm(f => ({ ...f, departmentId: value }))}
              >
                <Option value="">{t('courseManagement.selectDepartment')}</Option>
                {departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
              </Select>
            </div>
            <Input
              label={t('courseManagement.fieldCredits')}
              type="number"
              value={proposeForm.creditHours}
              onChange={e => setProposeForm(f => ({ ...f, creditHours: (e.target as HTMLInputElement).value }))}
            />
            {proposeError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{proposeError}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" type="button" onClick={() => { setProposeModal(false); setProposeError('') }}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                loading={proposeMutation.isPending}
                onClick={() => {
                  if (!proposeForm.code || !proposeForm.name || !proposeForm.departmentId) {
                    setProposeError('Code, name and department are required')
                    return
                  }
                  proposeMutation.mutate()
                }}
              >
                {t('lmsCourses.submitProposal', { defaultValue: 'Submit Proposal' })}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  const totalCH       = offerings.reduce((s, o) => s + (o.course?.creditHours ?? 0), 0)
  const totalStudents = offerings.reduce((s, o) => s + (o._count?.enrolments ?? 0), 0)

  const colorMap: Record<string, typeof COURSE_COLORS[0]> = {}
  offerings.forEach((o, i) => { colorMap[o.id] = COURSE_COLORS[i % COURSE_COLORS.length] })

  // Normalize for CalendarView
  const calendarEntries: CalendarEntry[] = offerings.map(o => {
    const color = colorMap[o.id]
    return {
      id:           o.id,
      courseCode:   o.course?.code ?? '',
      courseName:   o.course?.name ?? '',
      creditHours:  o.course?.creditHours ?? 0,
      dayOfWeek:    o.dayOfWeek,
      startTime:    o.startTime,
      endTime:      o.endTime,
      room:         o.room,
      color,
      href:         `/lms/courses/${o.id}`,
      badges: [
        { label: `${o.course?.creditHours} CH`,                color: 'blue'  as const },
        { label: `${o._count?.enrolments ?? 0} students`,      color: 'green' as const },
        { label: `${o._count?.attendanceSessions ?? 0} sessions`, color: 'gray' as const },
      ],
    }
  })

  const renderCardView = () => (
    <div className={styles.courseGrid}>
      {offerings.map(offering => {
        const color = colorMap[offering.id]
        return (
          <div
            key={offering.id}
            className={styles.courseCard}
            onClick={() => navigate(`/lms/courses/${offering.id}`)}
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

      {viewMode === 'card'
        ? renderCardView()
        : (
          <CourseCalendar
            entries={calendarEntries}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['lms', 'lecturer-offerings'] })}
          />
        )
      }

      {/* ── Propose Course Button ── */}
      <div style={{ marginTop: 8 }}>
        <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setProposeModal(true)}>
          {t('lmsCourses.proposeCourse', { defaultValue: 'Propose New Course' })}
        </Button>
      </div>

      {/* ── Propose Course Modal ── */}
      <Modal
        open={proposeModal}
        title={t('lmsCourses.proposeCourseTitle', { defaultValue: 'Propose a New Course' })}
        onClose={() => { setProposeModal(false); setProposeError('') }}
        footer={null}
      >
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          {t('lmsCourses.proposeCourseNote', { defaultValue: 'Your proposal will be submitted to the admin for review. Once approved, the course will appear in the course catalogue.' })}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label={t('courseManagement.fieldCode')}
            required
            value={proposeForm.code}
            onChange={e => setProposeForm(f => ({ ...f, code: (e.target as HTMLInputElement).value.toUpperCase() }))}
            hint="Uppercase letters, digits and hyphens only (e.g. IFN401)"
          />
          <Input
            label={t('courseManagement.fieldName')}
            required
            value={proposeForm.name}
            onChange={e => setProposeForm(f => ({ ...f, name: (e.target as HTMLInputElement).value }))}
          />
          <div>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{t('courseManagement.fieldDepartment')} *</label>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              value={proposeForm.departmentId}
              onChange={value => setProposeForm(f => ({ ...f, departmentId: value }))}
            >
              <Option value="">{t('courseManagement.selectDepartment')}</Option>
              {departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
            </Select>
          </div>
          <Input
            label={t('courseManagement.fieldCredits')}
            type="number"
            value={proposeForm.creditHours}
            onChange={e => setProposeForm(f => ({ ...f, creditHours: (e.target as HTMLInputElement).value }))}
          />
          {proposeError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{proposeError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" type="button" onClick={() => { setProposeModal(false); setProposeError('') }}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              loading={proposeMutation.isPending}
              onClick={() => {
                if (!proposeForm.code || !proposeForm.name || !proposeForm.departmentId) {
                  setProposeError('Code, name and department are required')
                  return
                }
                proposeMutation.mutate()
              }}
            >
              {t('lmsCourses.submitProposal', { defaultValue: 'Submit Proposal' })}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Student View ─────────────────────────────────────────────────────────────
const StudentCoursesView: React.FC = () => {
  const navigate    = useNavigate()
  const user        = useAuthStore(s => s.user)
  const { t }       = useTranslation()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('card')

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

  const totalCH          = enrolments.reduce((s, e) => s + (e.offering?.course?.creditHours ?? 0), 0)
  const totalAssignments = enrolments.reduce((s, e) => s + (e.offering?.assignments?.length ?? 0), 0)
  const isLoading        = enrolmentsLoading || offeringsLoading

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

  // Normalize enrolled courses for CalendarView
  const calendarEntries: CalendarEntry[] = enrolments
    .filter(enr => !!enr.offering)
    .map(enr => {
      const off    = enr.offering
      const color  = colorMap[off.id]
      const pending = off.assignments?.filter(a => a.dueDate && new Date(a.dueDate) > new Date()) ?? []

      const badges: CalendarEntry['badges'] = [
        { label: `${off.course?.creditHours} CH`, color: 'blue' as const },
      ]
      if (pending.length > 0) badges.push({ label: `${pending.length} due`, color: 'orange' as const })
      if (enr.finalGrade) {
        badges.push({
          label: GRADE_LABELS[enr.finalGrade] ?? enr.finalGrade,
          color: (GRADE_COLORS[enr.finalGrade] ?? 'gray') as CalendarEntry['badges'][0]['color'],
        })
      }

      return {
        id:              off.id,
        courseCode:      off.course?.code ?? '',
        courseName:      off.course?.name ?? '',
        creditHours:     off.course?.creditHours ?? 0,
        dayOfWeek:       off.dayOfWeek,
        startTime:       off.startTime,
        endTime:         off.endTime,
        room:            off.room,
        instructorName:  off.lecturer?.user?.displayName,
        color,
        href:            `/lms/courses/${off.id}`,
        badges,
        availability:    'enrolled' as const,
      }
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

      {viewMode === 'card'
        ? renderCardView()
        : (
          <CourseCalendar
            entries={calendarEntries}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['lms', 'courses'] })
              queryClient.invalidateQueries({ queryKey: ['offerings'] })
            }}
          />
        )
      }
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
