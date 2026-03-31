import { useTranslation } from 'react-i18next'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen, TrendingUp, Calendar, FileText, Download } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import styles from './TranscriptPage.module.scss'

interface Student {
  id: string
  studentId: string
  currentCgpa: number
  user: {
    displayName: string
    email: string
  }
  programme: {
    code: string
    name: string
    department: {
      name: string
    }
  }
  intake: {
    semester: {
      name: string
    }
  }
}

interface Enrolment {
  id: string
  status: string
  finalGrade: string
  gradePoints: number
  registeredAt: string
  offering: {
    id: string
    course: {
      code: string
      name: string
      creditHours: number
    }
    semester: {
      id: string
      name: string
    }
  }
}

interface GpaRecord {
  id: string
  semesterId: string
  semesterGpa: number
  cumulativeGpa: number
  totalChPassed: number
  semester: {
    id: string
    name: string
  }
}

const GRADE_COLORS: Record<string, string> = {
  A_plus: 'green',
  A: 'green',
  B_plus: 'blue',
  B: 'blue',
  C_plus: 'cyan',
  C: 'cyan',
  D: 'orange',
  F: 'red',
}

const GRADE_LABELS: Record<string, string> = {
  A_plus: 'A+',
  A: 'A',
  B_plus: 'B+',
  B: 'B',
  C_plus: 'C+',
  C: 'C',
  D: 'D',
  F: 'F',
}

const TranscriptPage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)

  const { data: student, isLoading: loadingStudent } = useQuery<Student>({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
    enabled: !!user,
  })

  const { data: transcriptData, isLoading: loadingTranscript } = useQuery<{
    student: Student
    enrolments: Enrolment[]
  }>({
    queryKey: ['transcript', student?.studentId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/students/${student!.studentId}/transcript`)
      return data.data
    },
    enabled: !!student?.studentId,
  })

  const { data: gpaRecords = [], isLoading: loadingGpa } = useQuery<GpaRecord[]>({
    queryKey: ['gpa-records', student?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/students/${student!.id}/gpa-records`)
      return data.data
    },
    enabled: !!student?.id,
  })

  const isLoading = loadingStudent || loadingTranscript || loadingGpa

  const enrolments = transcriptData?.enrolments ?? []
  const completedEnrolments = enrolments.filter(e => e.status === 'completed' || e.finalGrade)

  const groupBySemester = (items: Enrolment[]) => {
    const groups: Record<string, Enrolment[]> = {}
    for (const item of items) {
      const semId = item.offering?.semester?.id ?? 'unknown'
      if (!groups[semId]) groups[semId] = []
      groups[semId].push(item)
    }
    return groups
  }

  const semesterGroups = groupBySemester(completedEnrolments)

  const totalCreditHours = completedEnrolments.reduce(
    (sum, e) => sum + (e.offering?.course?.creditHours ?? 0),
    0
  )

  const totalGradePoints = completedEnrolments.reduce(
    (sum, e) => sum + (e.gradePoints ?? 0) * (e.offering?.course?.creditHours ?? 0),
    0
  )

  const calculatedGpa = totalCreditHours > 0 ? totalGradePoints / totalCreditHours : 0

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>
            <FileText size={24} /> {t('transcript.title', { defaultValue: 'Academic Transcript' })}
          </h1>
          <p className={styles.pageDesc}>
            {t('transcript.desc', { defaultValue: 'View your academic record and GPA history' })}
          </p>
        </div>
        <div className={styles.headerRight}>
          <Button variant="secondary" icon={<Download size={16} />}>
            {t('transcript.download', { defaultValue: 'Download PDF' })}
          </Button>
        </div>
      </div>

      {student && (
        <Card className={styles.studentCard}>
          <div className={styles.studentInfo}>
            <div className={styles.studentAvatar}>
              <Award size={32} />
            </div>
            <div className={styles.studentDetails}>
              <h2>{student.user.displayName}</h2>
              <div className={styles.studentMeta}>
                <span><strong>Student ID:</strong> {student.studentId}</span>
                <span><strong>Programme:</strong> {student.programme?.name}</span>
                <span><strong>Intake:</strong> {student.intake?.semester?.name}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <div className={styles.statIcon}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {student?.currentCgpa?.toFixed(2) ?? calculatedGpa.toFixed(2)}
            </div>
            <div className={styles.statLabel}>{t('transcript.currentGpa', { defaultValue: 'Current GPA' })}</div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statIcon}>
            <BookOpen size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{completedEnrolments.length}</div>
            <div className={styles.statLabel}>{t('transcript.coursesCompleted', { defaultValue: 'Courses Completed' })}</div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statIcon}>
            <Calendar size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{totalCreditHours}</div>
            <div className={styles.statLabel}>{t('transcript.creditHours', { defaultValue: 'Credit Hours Earned' })}</div>
          </div>
        </Card>
      </div>

      {gpaRecords.length > 0 && (
        <Card title={t('transcript.gpaHistory', { defaultValue: 'GPA History' })}>
          <div className={styles.gpaTable}>
            <div className={styles.gpaHeader}>
              <span>Semester</span>
              <span>Semester GPA</span>
              <span>Cumulative GPA</span>
              <span>Credit Hours</span>
            </div>
            {gpaRecords.map(record => (
              <div key={record.id} className={styles.gpaRow}>
                <span className={styles.semesterName}>{record.semester?.name ?? 'N/A'}</span>
                <span className={styles.gpaValue}>{record.semesterGpa.toFixed(2)}</span>
                <span className={styles.gpaValue}>{record.cumulativeGpa.toFixed(2)}</span>
                <span>{record.totalChPassed} CH</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={t('transcript.courseRecord', { defaultValue: 'Course Record' })}>
        {Object.keys(semesterGroups).length === 0 ? (
          <div className={styles.emptyState}>
            <BookOpen size={48} />
            <h3>{t('transcript.noRecords', { defaultValue: 'No completed courses yet' })}</h3>
            <p>{t('transcript.noRecordsDesc', { defaultValue: 'Your completed courses will appear here once graded.' })}</p>
          </div>
        ) : (
          <div className={styles.transcriptTable}>
            <div className={styles.transcriptHeader}>
              <span className={styles.colCode}>Code</span>
              <span className={styles.colCourse}>Course</span>
              <span className={styles.colCh}>CH</span>
              <span className={styles.colGrade}>Grade</span>
              <span className={styles.colPoints}>Points</span>
            </div>
            {Object.entries(semesterGroups).map(([semId, items]) => (
              <div key={semId} className={styles.semesterSection}>
                <div className={styles.semesterHeader}>
                  <Calendar size={14} />
                  {items[0]?.offering?.semester?.name ?? 'Unknown Semester'}
                </div>
                {items.map(enrolment => (
                  <div key={enrolment.id} className={styles.transcriptRow}>
                    <span className={styles.colCode}>{enrolment.offering?.course?.code}</span>
                    <span className={styles.colCourse}>{enrolment.offering?.course?.name}</span>
                    <span className={styles.colCh}>{enrolment.offering?.course?.creditHours}</span>
                    <span className={styles.colGrade}>
                      <Badge color={GRADE_COLORS[enrolment.finalGrade] || 'gray'} size="sm">
                        {GRADE_LABELS[enrolment.finalGrade] || enrolment.finalGrade}
                      </Badge>
                    </span>
                    <span className={styles.colPoints}>{enrolment.gradePoints?.toFixed(2) ?? '-'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('transcript.gradeScale', { defaultValue: 'Grade Scale' })}>
        <div className={styles.gradeScale}>
          <div className={styles.scaleItem}>
            <Badge color="green">A+</Badge>
            <span>90-100</span>
            <span>4.00</span>
          </div>
          <div className={styles.scaleItem}>
            <Badge color="green">A</Badge>
            <span>80-89</span>
            <span>4.00</span>
          </div>
          <div className={styles.scaleItem}>
            <Badge color="blue">B+</Badge>
            <span>75-79</span>
            <span>3.67</span>
          </div>
          <div className={styles.scaleItem}>
            <Badge color="blue">B</Badge>
            <span>70-74</span>
            <span>3.33</span>
          </div>
          <div className={styles.scaleItem}>
            <Badge color="cyan">C+</Badge>
            <span>65-69</span>
            <span>3.00</span>
          </div>
          <div className={styles.scaleItem}>
            <Badge color="cyan">C</Badge>
            <span>60-64</span>
            <span>2.67</span>
          </div>
          <div className={styles.scaleItem}>
            <Badge color="orange">D</Badge>
            <span>50-59</span>
            <span>2.00</span>
          </div>
          <div className={styles.scaleItem}>
            <Badge color="red">F</Badge>
            <span>&lt;50</span>
            <span>0.00</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default TranscriptPage
