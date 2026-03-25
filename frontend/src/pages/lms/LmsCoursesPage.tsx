import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, MapPin, User, ChevronRight, AlertTriangle } from 'lucide-react'
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

const LmsCoursesPage: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data: enrolments = [], isLoading } = useQuery<Enrolment[]>({
    queryKey: ['lms', 'courses', '2026001'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lms/courses/2026001')
      return data.data
    },
  })

  const totalCH = enrolments.reduce((s, e) => s + (e.offering?.course?.creditHours ?? 0), 0)
  const totalAssignments = enrolments.reduce((s, e) => s + (e.offering?.assignments?.length ?? 0), 0)

  if (isLoading) return <div className={styles.loading}>Loading courses…</div>

  if (enrolments.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>My Courses</h1>
        </div>
        <div className={styles.emptyState}>
          <BookOpen size={40} />
          <h3>No courses registered yet</h3>
          <p>Register for courses to see them here.</p>
          <button className={styles.emptyBtn} onClick={() => navigate('/student/courses')}>
            Register Courses
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>My Courses</h1>
          <p className={styles.pageSub}>Sep 2026 · {enrolments.length} courses · {totalCH} credit hours</p>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.headerStat}>
            <span>{totalCH}</span>
            <label>Credit Hours</label>
          </div>
          <div className={styles.headerStat}>
            <span>{totalAssignments}</span>
            <label>Assignments</label>
          </div>
          <div className={styles.headerStat}>
            <span>{enrolments.length}</span>
            <label>Courses</label>
          </div>
        </div>
      </div>

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
    </div>
  )
}

export default LmsCoursesPage
