import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Users, BookOpen, FileText, ClipboardList,
  Star, Clock, CheckCircle, Video, Link, Calendar, Upload, Trash2, Eye, Play, Download, Plus, Minus,
} from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, DatePicker, TimePicker } from 'antd'
import dayjs from 'dayjs'
import styles from './LmsCourseDetailLecturer.module.scss'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LecturerOffering {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  course: { id: string; name: string; code: string; creditHours: number; description?: string }
  lecturer: { user: { displayName: string; email: string } }
  assignments: Assignment[]
  materials: CourseMaterial[]
  attendanceSessions: AttendanceSessionSummary[]
  _count: { enrolments: number; attendanceSessions: number }
}

interface Assignment {
  id: string
  title: string
  description?: string
  maxMarks: number
  dueDate?: string
  assignmentType: string
  weight: number
  rubricCriteria?: string
}

type QuestionType = 'single-choice' | 'multiple-choice' | 'open-ended'
interface Question {
  type: QuestionType
  text: string
  options: string[]   // empty for open-ended
  marks: number
}

interface CourseMaterial {
  id: string
  title: string
  description?: string
  materialType: string
  externalUrl?: string
  duration?: number
  orderIndex: number
  isPublished: boolean
  asset?: { id: string; fileName: string; originalName?: string; fileUrl: string; mimeType?: string; fileSizeBytes: number }
}

interface AttendanceSessionSummary {
  id: string
  name?: string
  startedAt: string
  endedAt?: string
  _count: { records: number }
}

interface EnrolmentRow {
  id: string
  finalGrade?: string
  registeredAt: string
  student: {
    studentId: string
    user: { displayName: string; email: string }
  }
}

interface SubmissionForGrading {
  id: string
  submittedAt?: string
  finalMarks?: number
  aiRubricScores?: string
  content?: string
  asset?: { fileName: string; originalName?: string; fileUrl: string; mimeType?: string; fileSizeBytes: number }
  student: { user: { displayName: string } }
}

interface AssignmentWithSubmissions extends Assignment {
  submissions: SubmissionForGrading[]
}

interface AttendanceReport {
  sessions: any[]
  summary: { studentId: string; name: string; present: number; total: number; attendancePct: number }[]
}

type Tab = 'overview' | 'students' | 'grading' | 'materials' | 'attendance'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GRADE_COLORS: Record<string, 'green' | 'blue' | 'orange' | 'red' | 'gray'> = {
  A_plus: 'green', A: 'green', B_plus: 'blue', B: 'blue',
  C_plus: 'orange', C: 'orange', D: 'orange', F: 'red',
}
const GRADE_LABELS: Record<string, string> = {
  A_plus: 'A+', A: 'A', B_plus: 'B+', B: 'B', C_plus: 'C+', C: 'C', D: 'D', F: 'F',
}

// ─── Component ────────────────────────────────────────────────────────────────
const LmsCourseDetailLecturer: React.FC = () => {
  const { t }          = useTranslation()
  const { offeringId } = useParams<{ offeringId: string }>()
  const navigate       = useNavigate()
  const user           = useAuthStore(s => s.user)
  const addToast       = useUIStore(s => s.addToast)
  const qc             = useQueryClient()

  const [activeTab, setActiveTab]               = useState<Tab>('overview')
  const [gradingTarget, setGradingTarget]       = useState<{ sub: SubmissionForGrading; assignment: Assignment } | null>(null)
  const [gradingMarks, setGradingMarks]         = useState('')
  const [viewSubmission, setViewSubmission]     = useState<SubmissionForGrading | null>(null)
  const [viewAIRubric, setViewAIRubric]         = useState<SubmissionForGrading | null>(null)
  const [materialModal, setMaterialModal]       = useState(false)
  const [materialTitle, setMaterialTitle]       = useState('')
  const [materialDesc, setMaterialDesc]         = useState('')
  const [materialFile, setMaterialFile]         = useState<File | null>(null)
  const [materialPublished, setMaterialPublished] = useState(true)
  const [materialPreview, setMaterialPreview]   = useState<CourseMaterial | null>(null)
  const [pptPreviewMode, setPptPreviewMode]     = useState<'office' | 'download'>('office')

  // ── Create Assignment modal state ───────────────────────────────────────────
  const [assignmentModal, setAssignmentModal]   = useState(false)
  const [asnTitle, setAsnTitle]                 = useState('')
  const [asnDesc, setAsnDesc]                   = useState('')
  const [asnDueDate, setAsnDueDate]             = useState('')
  const [asnMaxMarks, setAsnMaxMarks]           = useState('100')
  const [asnWeight, setAsnWeight]               = useState('10')
  const [asnCriteria, setAsnCriteria]           = useState<{ criterion: string; max_marks: number }[]>([
    { criterion: 'Content', max_marks: 60 },
    { criterion: 'Presentation', max_marks: 40 },
  ])
  const [asnQuestions, setAsnQuestions]         = useState<Question[]>([])

  const resetAssignmentForm = () => {
    setAsnTitle(''); setAsnDesc(''); setAsnDueDate(''); setAsnMaxMarks('100'); setAsnWeight('10')
    setAsnCriteria([{ criterion: 'Content', max_marks: 60 }, { criterion: 'Presentation', max_marks: 40 }])
    setAsnQuestions([])
  }

  // ── Offering detail ─────────────────────────────────────────────────────────
  const { data: offering, isLoading } = useQuery<LecturerOffering>({
    queryKey: ['lms', 'offering', offeringId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/offerings/${offeringId}`)
      return data.data
    },
    enabled: !!offeringId,
  })

  // ── Student roster ──────────────────────────────────────────────────────────
  const { data: roster = [] } = useQuery<EnrolmentRow[]>({
    queryKey: ['lms', 'offering', offeringId, 'enrolments'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/offerings/${offeringId}/enrolments`)
      return data.data
    },
    enabled: !!offeringId && activeTab === 'students',
  })

  // ── Submissions for grading ─────────────────────────────────────────────────
  const { data: gradingAssignments = [] } = useQuery<AssignmentWithSubmissions[]>({
    queryKey: ['lms', 'submissions', 'offering', offeringId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/submissions/offering/${offeringId}`)
      return data.data
    },
    enabled: !!offeringId && activeTab === 'grading',
  })

  // ── Attendance report ───────────────────────────────────────────────────────
  const { data: attendanceReport } = useQuery<AttendanceReport>({
    queryKey: ['lms', 'attendance', 'report', offeringId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/records/offering/${offeringId}`)
      return data.data
    },
    enabled: !!offeringId && activeTab === 'attendance',
  })

  // ── Grade mutation ──────────────────────────────────────────────────────────
  const gradeMutation = useMutation({
    mutationFn: async ({ submissionId, marks }: { submissionId: string; marks: number }) => {
      const { data } = await apiClient.patch(`/lms/submissions/${submissionId}/grade`, {
        finalMarks: marks,
        instructorScores: [],
      })
      return data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: t('lmsCourseDetailLecturer.gradeSuccess', { defaultValue: 'Grade saved successfully' }) })
      qc.invalidateQueries({ queryKey: ['lms', 'submissions', 'offering', offeringId] })
      setGradingTarget(null)
      setGradingMarks('')
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Grading failed' })
    },
  })

  // ── Accept AI mutation ──────────────────────────────────────────────────────
  const acceptAIMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const { data } = await apiClient.patch(`/lms/submissions/${submissionId}/accept-ai`, {})
      return data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: t('lmsCourseDetailLecturer.aiAccepted', { defaultValue: 'AI scores accepted as final grade' }) })
      qc.invalidateQueries({ queryKey: ['lms', 'submissions', 'offering', offeringId] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Accept AI failed' })
    },
  })

  // ── Material upload mutation ────────────────────────────────────────────────
  const uploadMaterialMutation = useMutation({
    mutationFn: async () => {
      if (!materialTitle.trim()) throw new Error(t('lmsCourseDetailLecturer.titleRequired', { defaultValue: 'Title is required' }))
      if (!materialFile) throw new Error(t('lmsCourseDetailLecturer.fileRequired', { defaultValue: 'File is required' }))
      
      const fd = new FormData()
      fd.append('title', materialTitle.trim())
      fd.append('description', materialDesc.trim())
      fd.append('isPublished', String(materialPublished))
      fd.append('file', materialFile)
      
      const { data } = await apiClient.post(`/lms/materials/${offeringId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: t('lmsCourseDetailLecturer.materialUploaded', { defaultValue: 'Material uploaded successfully' }) })
      qc.invalidateQueries({ queryKey: ['lms', 'offering', offeringId] })
      setMaterialModal(false)
      setMaterialTitle('')
      setMaterialDesc('')
      setMaterialFile(null)
      setMaterialPublished(true)
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? e.message ?? 'Upload failed' })
    },
  })

  // ── Material delete mutation ────────────────────────────────────────────────
  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const { data } = await apiClient.delete(`/lms/materials/${materialId}`)
      return data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: t('lmsCourseDetailLecturer.materialDeleted', { defaultValue: 'Material deleted successfully' }) })
      qc.invalidateQueries({ queryKey: ['lms', 'offering', offeringId] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Delete failed' })
    },
  })

  // ── Create assignment mutation ──────────────────────────────────────────────
  const createAssignmentMutation = useMutation({
    mutationFn: async () => {
      const title = asnTitle.trim()
      if (!title) throw new Error(t('lmsCourseDetailLecturer.titleRequired', { defaultValue: 'Title is required' }))
      if (!asnDueDate) throw new Error('Due date is required')
      const rubricCriteria = {
        criteria: asnCriteria.filter(c => c.criterion.trim()),
        questions: asnQuestions,
      }
      const { data } = await apiClient.post('/lms/assignments', {
        offeringId,
        title,
        description: asnDesc.trim() || title,
        dueDate: asnDueDate,
        maxMarks: parseInt(asnMaxMarks) || 100,
        weightPct: parseFloat(asnWeight) || 10,
        rubricCriteria,
      })
      return data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: t('lmsCourseDetailLecturer.assignmentCreated', { defaultValue: 'Assignment created successfully' }) })
      qc.invalidateQueries({ queryKey: ['lms', 'offering', offeringId] })
      setAssignmentModal(false)
      resetAssignmentForm()
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? e.message ?? 'Failed to create assignment' })
    },
  })

  // ── Loading / not-found ─────────────────────────────────────────────────────
  if (isLoading) {
    return <div className={styles.page}><div className={styles.loading}>{t('lmsCourseDetail.loading', { defaultValue: 'Loading…' })}</div></div>
  }
  if (!offering) {
    return <div className={styles.page}><div className={styles.loading}>{t('lmsCourseDetailLecturer.notFound', { defaultValue: 'Course not found or access denied.' })}</div></div>
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const pendingCount = gradingAssignments.reduce(
    (n, a) => n + a.submissions.filter(s => s.finalMarks === null || s.finalMarks === undefined).length, 0,
  )

  // ── Render helpers ──────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className={styles.overviewGrid}>
      <Card title={t('lmsCourseDetailLecturer.courseInfo', { defaultValue: 'Course Information' })}>
        <div className={styles.infoRow}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('lmsCourseDetailLecturer.schedule', { defaultValue: 'Schedule' })}</span>
            <span className={styles.infoValue}>{offering.dayOfWeek} · {offering.startTime}–{offering.endTime}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('lmsCourseDetailLecturer.room', { defaultValue: 'Room' })}</span>
            <span className={styles.infoValue}>{offering.room}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('lmsCourseDetailLecturer.creditHours', { defaultValue: 'Credit Hours' })}</span>
            <span className={styles.infoValue}>{offering.course?.creditHours}</span>
          </div>
          {offering.course?.description && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('lmsCourseDetailLecturer.description', { defaultValue: 'Description' })}</span>
              <span className={styles.infoValue}>{offering.course.description}</span>
            </div>
          )}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('lmsCourseDetailLecturer.instructor', { defaultValue: 'Instructor' })}</span>
            <span className={styles.infoValue}>{offering.lecturer?.user?.displayName}</span>
          </div>
        </div>
      </Card>

      <Card title={t('lmsCourseDetailLecturer.assignments', { defaultValue: 'Assignments' })}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAssignmentModal(true)}>
            {t('lmsCourseDetailLecturer.createAssignment', { defaultValue: 'Create Assignment' })}
          </Button>
        </div>
        {offering.assignments.length === 0 ? (
          <div className={styles.emptyBlock}>{t('lmsCourseDetailLecturer.noAssignments', { defaultValue: 'No assignments yet.' })}</div>
        ) : (
          <div className={styles.assignmentSummaryList}>
            {offering.assignments.map(a => {
              const isDue = a.dueDate && new Date(a.dueDate) < new Date()
              return (
                <div key={a.id} className={styles.assignmentSummaryItem}>
                  <FileText size={14} color="var(--color-gray-5)" />
                  <span className={styles.assignmentSummaryName}>{a.title}</span>
                  <span className={styles.assignmentSummaryMeta}>{a.maxMarks} {t('lmsCourseDetail.marks', { defaultValue: 'pts' })}</span>
                  {a.dueDate && (
                    <Badge color={isDue ? 'red' : 'orange'} size="sm">
                      {new Date(a.dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )

  const renderStudents = () => (
    <Card title={`${t('lmsCourseDetailLecturer.enrolledStudents', { defaultValue: 'Enrolled Students' })} (${roster.length})`}>
      {roster.length === 0 ? (
        <div className={styles.emptyBlock}>{t('lmsCourseDetailLecturer.noStudents', { defaultValue: 'No enrolled students.' })}</div>
      ) : (
        <table className={styles.rosterTable}>
          <thead>
            <tr>
              <th className={styles.rosterTh}>{t('lmsCourseDetailLecturer.student', { defaultValue: 'Student' })}</th>
              <th className={styles.rosterTh}>{t('lmsCourseDetailLecturer.studentId', { defaultValue: 'Student ID' })}</th>
              <th className={styles.rosterTh}>{t('lmsCourseDetailLecturer.enrolled', { defaultValue: 'Enrolled' })}</th>
              <th className={styles.rosterTh}>{t('lmsCourseDetailLecturer.grade', { defaultValue: 'Grade' })}</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(e => (
              <tr key={e.id} className={styles.rosterTr}>
                <td className={styles.rosterTd}>
                  <div className={styles.studentMeta}>
                    <div className={styles.studentAvatar}>
                      {e.student.user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.studentName}>{e.student.user.displayName}</div>
                      <div className={styles.studentEmail}>{e.student.user.email}</div>
                    </div>
                  </div>
                </td>
                <td className={styles.rosterTd}>{e.student.studentId}</td>
                <td className={styles.rosterTd}>{new Date(e.registeredAt).toLocaleDateString()}</td>
                <td className={styles.rosterTd}>
                  {e.finalGrade ? (
                    <Badge color={GRADE_COLORS[e.finalGrade] ?? 'gray'}>
                      {GRADE_LABELS[e.finalGrade] ?? e.finalGrade}
                    </Badge>
                  ) : (
                    <Badge color="gray" size="sm">{t('lmsCourseDetailLecturer.pending', { defaultValue: 'Pending' })}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )

  const renderGrading = () => (
    <div className={styles.gradingSection}>
      {gradingAssignments.length === 0 ? (
        <Card><div className={styles.emptyBlock}>{t('lmsCourseDetailLecturer.noAssignments', { defaultValue: 'No assignments yet.' })}</div></Card>
      ) : (
        gradingAssignments.map(assignment => {
          const ungraded = assignment.submissions.filter(s => s.finalMarks === null || s.finalMarks === undefined)
          return (
            <div key={assignment.id} className={styles.assignmentBlock}>
              <div className={styles.assignmentBlockHeader}>
                <FileText size={16} color="var(--color-gray-6)" />
                <span className={styles.assignmentBlockTitle}>{assignment.title}</span>
                <span className={styles.assignmentBlockMeta}>{assignment.maxMarks} pts</span>
                {assignment.dueDate && (
                  <Badge color={new Date(assignment.dueDate) < new Date() ? 'red' : 'orange'} size="sm">
                    {t('lmsCourseDetail.due', { defaultValue: 'Due' })}: {new Date(assignment.dueDate).toLocaleDateString()}
                  </Badge>
                )}
                {ungraded.length > 0 && (
                  <Badge color="blue" size="sm">{ungraded.length} {t('lmsCourseDetailLecturer.pending', { defaultValue: 'pending' })}</Badge>
                )}
              </div>
              {assignment.submissions.length === 0 ? (
                <div className={styles.emptyBlock}>{t('lmsCourseDetailLecturer.noSubmissions', { defaultValue: 'No submissions yet.' })}</div>
              ) : (
                <div className={styles.submissionList}>
                  {assignment.submissions.map(sub => (
                    <div key={sub.id} className={styles.submissionRow}>
                      <div className={styles.submissionStudentInfo}>
                        <div className={styles.submissionStudentName}>{sub.student?.user?.displayName}</div>
                        {sub.submittedAt && (
                          <div className={styles.submissionDate}>{new Date(sub.submittedAt).toLocaleString()}</div>
                        )}
                        {sub.content && (
                          <div className={styles.submissionPreview}>{sub.content}</div>
                        )}
                      </div>
                      <div className={styles.submissionActions}>
                        {sub.finalMarks !== undefined && sub.finalMarks !== null ? (
                          <div className={styles.gradeChip}>
                            <Star size={12} />
                            {sub.finalMarks}/{assignment.maxMarks}
                          </div>
                        ) : (
                          <Badge color="blue" size="sm">
                            <Clock size={11} /> {t('lmsCourseDetail.pendingGrading', { defaultValue: 'Pending' })}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewSubmission(sub)}
                        >
                          {t('lmsCourseDetail.viewSubmission', { defaultValue: 'View' })}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setGradingTarget({ sub, assignment })
                            setGradingMarks(sub.finalMarks !== undefined && sub.finalMarks !== null ? String(sub.finalMarks) : '')
                          }}
                        >
                          {sub.finalMarks !== undefined && sub.finalMarks !== null
                            ? t('lmsCourseDetailLecturer.regrade', { defaultValue: 'Re-grade' })
                            : t('lmsCourseDetailLecturer.grade', { defaultValue: 'Grade' })}
                        </Button>
                        {sub.aiRubricScores && (
                          <Button size="sm" variant="ghost" onClick={() => setViewAIRubric(sub)}>
                            AI
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )

  const renderMaterials = () => (
    <Card 
      title={t('lmsCourseDetail.courseMaterials', { defaultValue: 'Course Materials' })}
      extra={
        <Button size="sm" icon={<Upload size={14} />} onClick={() => setMaterialModal(true)}>
          {t('lmsCourseDetailLecturer.uploadMaterial', { defaultValue: 'Upload Material' })}
        </Button>
      }
    >
      {offering.materials.length === 0 ? (
        <div className={styles.emptyBlock}>{t('lmsCourseDetail.noMaterials', { defaultValue: 'No materials uploaded yet.' })}</div>
      ) : (
        <div className={styles.materialsList}>
          {offering.materials.map(m => {
            const isVideo = m.materialType === 'video'
            const isLink  = m.materialType === 'link'
            const isPPT = m.materialType === 'presentation' || (m.asset?.mimeType?.includes('presentation') || m.asset?.originalName?.match(/\.pptx?$/i))
            const iconClass = isVideo ? 'video' : isLink ? 'link' : 'doc'
            const href = isLink ? m.externalUrl : m.asset?.fileUrl
            const canPreview = isVideo || isPPT
            return (
              <div key={m.id} className={styles.materialItem}>
                <div className={`${styles.materialIcon} ${styles[iconClass]}`}>
                  {isVideo ? <Video size={20} /> : isLink ? <Link size={20} /> : <FileText size={20} />}
                </div>
                <div className={styles.materialInfo}>
                  <div className={styles.materialTitle}>
                    {m.title}
                    {!m.isPublished && <Badge color="orange" size="sm" style={{ marginLeft: 8 }}>{t('lmsCourseDetailLecturer.draft', { defaultValue: 'Draft' })}</Badge>}
                  </div>
                  {m.description && <div className={styles.materialMeta}>{m.description}</div>}
                  {m.asset && (
                    <div className={styles.materialMeta}>
                      {m.asset.originalName ?? m.asset.fileName} · {(m.asset.fileSizeBytes / 1024).toFixed(0)} KB
                    </div>
                  )}
                  {isVideo && m.duration && (
                    <div className={styles.materialMeta}>
                      {t('lmsCourseDetail.duration', { defaultValue: 'Duration' })}: {Math.floor(m.duration / 60)}:{String(m.duration % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>
                <div className={styles.materialActions}>
                  {canPreview && href && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={isVideo ? <Play size={14} /> : <Eye size={14} />}
                      onClick={() => setMaterialPreview(m)}
                    >
                      {isVideo ? t('lmsCourseDetail.play', { defaultValue: 'Play' }) : t('lmsCourseDetail.preview', { defaultValue: 'Preview' })}
                    </Button>
                  )}
                  {href && (
                    <a href={href} target="_blank" rel="noreferrer" className={styles.slideAction} download>
                      <Download size={14} />
                      {t('lmsCourseDetail.download', { defaultValue: 'Download' })}
                    </a>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      if (window.confirm(t('lmsCourseDetailLecturer.confirmDelete', { defaultValue: 'Are you sure you want to delete this material?' }))) {
                        deleteMaterialMutation.mutate(m.id)
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )

  const renderAttendance = () => (
    <div>
      <div className={styles.attendanceHeader}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-gray-8)' }}>
          {t('lmsCourseDetailLecturer.sessions', { defaultValue: 'Attendance Sessions' })} ({offering.attendanceSessions.length})
        </h3>
      </div>

      {/* Sessions list */}
      {offering.attendanceSessions.length === 0 ? (
        <Card><div className={styles.emptyBlock}>{t('lmsCourseDetailLecturer.noSessions', { defaultValue: 'No sessions yet. Start one from the Attendance page.' })}</div></Card>
      ) : (
        <div className={styles.sessionsList}>
          {offering.attendanceSessions.map((sess, idx) => (
            <div key={sess.id} className={styles.sessionCard}>
              <div className={styles.sessionCardHeader}>
                <Calendar size={14} color="var(--color-gray-5)" />
                <span className={styles.sessionCardTitle}>
                  {sess.name ?? `${t('lmsCourseDetailLecturer.session', { defaultValue: 'Session' })} ${idx + 1}`}
                </span>
                <span className={styles.sessionCardDate}>{new Date(sess.startedAt).toLocaleDateString()}</span>
                <Badge color={sess.endedAt ? 'green' : 'orange'} size="sm">
                  {sess.endedAt
                    ? t('lmsCourseDetailLecturer.closed', { defaultValue: 'Closed' })
                    : t('lmsCourseDetailLecturer.open', { defaultValue: 'Open' })}
                </Badge>
              </div>
              <div className={styles.sessionCardBody}>
                <div className={styles.sessionStat}>
                  <span>{sess._count.records}</span>
                  <label>{t('lmsCourseDetailLecturer.attended', { defaultValue: 'Attended' })}</label>
                </div>
                <div className={styles.sessionStat}>
                  <span>{offering._count.enrolments}</span>
                  <label>{t('lmsCourseDetailLecturer.enrolled', { defaultValue: 'Enrolled' })}</label>
                </div>
                <div className={styles.sessionStat}>
                  <span>
                    {offering._count.enrolments > 0
                      ? Math.round((sess._count.records / offering._count.enrolments) * 100)
                      : 0}%
                  </span>
                  <label>{t('lmsCourseDetailLecturer.rate', { defaultValue: 'Rate' })}</label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-student attendance summary */}
      {attendanceReport && attendanceReport.summary.length > 0 && (
        <div style={{ marginTop: 20 }}>
        <Card title={t('lmsCourseDetailLecturer.attendanceSummary', { defaultValue: 'Student Attendance Summary' })}>
          <div className={styles.attendanceReport}>
            {attendanceReport.summary.map(row => {
              const pct = row.attendancePct
              const level = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low'
              return (
                <div key={row.studentId} className={styles.attendanceRow}>
                  <span className={styles.attendanceStudentName}>{row.name}</span>
                  <div className={styles.progressBar}>
                    <div className={`${styles.progressFill} ${styles[level]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`${styles.attendancePct} ${styles[level]}`}>{pct}%</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-gray-5)' }}>{row.present}/{row.total}</span>
                </div>
              )
            })}
          </div>
        </Card>
        </div>
      )}
    </div>
  )

  // ── Grade modal helpers ──────────────────────────────────────────────────────
  const parseRubric = (jsonStr?: string) => {
    if (!jsonStr) return []
    try {
      const parsed = JSON.parse(jsonStr)
      return Array.isArray(parsed) ? parsed : (parsed.criteria ?? [])
    } catch { return [] }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Back button */}
      <button className={styles.backBtn} onClick={() => navigate('/lms/courses')}>
        <ArrowLeft size={16} /> {t('lmsCourseDetail.backToCourses', { defaultValue: 'Back to My Courses' })}
      </button>

      {/* Course hero */}
      <div className={styles.courseHero}>
        <div className={styles.heroLeft}>
          <div className={styles.courseCode}>{offering.course?.code}</div>
          <h1 className={styles.courseName}>{offering.course?.name}</h1>
          <div className={styles.courseMeta}>
            <span>📅 {offering.dayOfWeek} {offering.startTime}–{offering.endTime}</span>
            <span>📍 {offering.room}</span>
            <span>👤 {offering.lecturer?.user?.displayName}</span>
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span>{offering._count.enrolments}</span>
            <label>{t('lmsCourseDetailLecturer.students', { defaultValue: 'Students' })}</label>
          </div>
          <div className={styles.heroStat}>
            <span>{offering.assignments.length}</span>
            <label>{t('lmsCourseDetailLecturer.assignments', { defaultValue: 'Assignments' })}</label>
          </div>
          <div className={styles.heroStat}>
            <span>{offering._count.attendanceSessions}</span>
            <label>{t('lmsCourseDetailLecturer.sessions', { defaultValue: 'Sessions' })}</label>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.blue}`}><Users size={20} /></div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{offering._count.enrolments}</div>
            <div className={styles.statLabel}>{t('lmsCourseDetailLecturer.enrolledStudents', { defaultValue: 'Enrolled Students' })}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.orange}`}><ClipboardList size={20} /></div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{pendingCount}</div>
            <div className={styles.statLabel}>{t('lmsCourseDetailLecturer.pendingGrading', { defaultValue: 'Pending Grading' })}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.green}`}><Calendar size={20} /></div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{offering._count.attendanceSessions}</div>
            <div className={styles.statLabel}>{t('lmsCourseDetailLecturer.totalSessions', { defaultValue: 'Total Sessions' })}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.purple}`}><BookOpen size={20} /></div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{offering.materials.length}</div>
            <div className={styles.statLabel}>{t('lmsCourseDetailLecturer.materials', { defaultValue: 'Materials' })}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {([
          { key: 'overview',    icon: <BookOpen size={14} />,      label: t('lmsCourseDetailLecturer.tabOverview',    { defaultValue: 'Overview' }) },
          { key: 'students',    icon: <Users size={14} />,         label: t('lmsCourseDetailLecturer.tabStudents',    { defaultValue: 'Students' }), badge: offering._count.enrolments },
          { key: 'grading',     icon: <Star size={14} />,          label: t('lmsCourseDetailLecturer.tabGrading',     { defaultValue: 'Grading' }), badge: pendingCount || undefined },
          { key: 'materials',   icon: <FileText size={14} />,      label: t('lmsCourseDetailLecturer.tabMaterials',   { defaultValue: 'Materials' }) },
          { key: 'attendance',  icon: <CheckCircle size={14} />,   label: t('lmsCourseDetailLecturer.tabAttendance',  { defaultValue: 'Attendance' }), badge: offering._count.attendanceSessions },
        ] as { key: Tab; icon: React.ReactNode; label: string; badge?: number }[]).map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={styles.tabBadge}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'   && renderOverview()}
      {activeTab === 'students'   && renderStudents()}
      {activeTab === 'grading'    && renderGrading()}
      {activeTab === 'materials'  && renderMaterials()}
      {activeTab === 'attendance' && renderAttendance()}

      {/* ── Grade Modal ──────────────────────────────────────────────────── */}
      {gradingTarget && (
        <Modal
          open
          title={`${t('lmsCourseDetailLecturer.gradeSubmission', { defaultValue: 'Grade Submission' })}: ${gradingTarget.assignment.title}`}
          onClose={() => { setGradingTarget(null); setGradingMarks('') }}
          okText={t('lmsCourseDetailLecturer.saveGrade', { defaultValue: 'Save Grade' })}
          onOk={() => {
            const marks = parseFloat(gradingMarks)
            if (isNaN(marks) || marks < 0 || marks > gradingTarget.assignment.maxMarks) {
              addToast({ type: 'error', message: `Marks must be 0–${gradingTarget.assignment.maxMarks}` })
              return
            }
            gradeMutation.mutate({ submissionId: gradingTarget.sub.id, marks })
          }}
          okLoading={gradeMutation.isPending}
        >
          <div className={styles.gradeModalContent}>
            <div className={styles.gradeModalStudent}>
              <Users size={16} color="var(--color-gray-5)" />
              <div>
                <div className={styles.gradeModalStudentName}>{gradingTarget.sub.student?.user?.displayName}</div>
                {gradingTarget.sub.submittedAt && (
                  <div className={styles.gradeModalStudentDate}>{new Date(gradingTarget.sub.submittedAt).toLocaleString()}</div>
                )}
              </div>
            </div>

            {gradingTarget.sub.content && (
              <>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-gray-7)' }}>
                  {t('lmsCourseDetail.submissionContent', { defaultValue: 'Submission' })}
                </label>
                <div className={styles.submissionContentBox}>{gradingTarget.sub.content}</div>
              </>
            )}

            {gradingTarget.sub.asset && (
              <div className={styles.fileInfo}>
                <FileText size={14} />
                <span>{gradingTarget.sub.asset.originalName ?? gradingTarget.sub.asset.fileName}</span>
                <span className={styles.fileSizeText}>({(gradingTarget.sub.asset.fileSizeBytes / 1024).toFixed(1)} KB)</span>
              </div>
            )}

            {/* AI rubric summary */}
            {gradingTarget.sub.aiRubricScores && (() => {
              const rubric = parseRubric(gradingTarget.sub.aiRubricScores)
              if (!rubric.length) return null
              const avg = rubric.reduce((s: number, r: any) => s + r.ai_score, 0) / rubric.length
              return (
                <>
                  <div className={styles.aiDivider}>{t('lmsCourseDetailLecturer.aiSuggestion', { defaultValue: 'AI Suggestion' })}</div>
                  <div className={styles.aiRubricSummary}>
                    <div className={styles.aiRubricTitle}>
                      🤖 {t('lmsCourseDetailLecturer.aiAvgScore', { defaultValue: 'AI Average Score' })}: {avg.toFixed(1)}/10
                    </div>
                    <div className={styles.aiRubricList}>
                      {rubric.map((r: any, i: number) => (
                        <div key={i} className={styles.aiRubricRow}>
                          <span>{r.criterion}</span>
                          <span className={styles.aiRubricScore}>{r.ai_score}/10</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => acceptAIMutation.mutate(gradingTarget.sub.id)}
                    loading={acceptAIMutation.isPending}
                  >
                    {t('lmsCourseDetailLecturer.acceptAI', { defaultValue: 'Accept AI Scores as Final Grade' })}
                  </Button>
                </>
              )
            })()}

            <div className={styles.gradeInputRow}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-gray-7)' }}>
                {t('lmsCourseDetailLecturer.finalMarks', { defaultValue: 'Final Marks' })}:
              </label>
              <input
                type="number"
                className={styles.gradeInput}
                min={0}
                max={gradingTarget.assignment.maxMarks}
                value={gradingMarks}
                onChange={e => setGradingMarks(e.target.value)}
                placeholder="0"
              />
              <span className={styles.gradeInputMax}>/ {gradingTarget.assignment.maxMarks}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* ── View Submission Modal ────────────────────────────────────────── */}
      {viewSubmission && (
        <Modal
          open
          title={t('lmsCourseDetail.submissionDetails', { defaultValue: 'Submission Details' })}
          onClose={() => setViewSubmission(null)}
          footer={<Button onClick={() => setViewSubmission(null)}>{t('lmsCourseDetail.close', { defaultValue: 'Close' })}</Button>}
        >
          <div className={styles.submissionDetails}>
            <div className={styles.detailSection}>
              <h4 className={styles.detailLabel}>{t('lmsCourseDetailLecturer.student', { defaultValue: 'Student' })}:</h4>
              <p className={styles.detailValue}>{viewSubmission.student?.user?.displayName}</p>
            </div>
            {viewSubmission.submittedAt && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailLabel}>{t('lmsCourseDetail.submittedAt', { defaultValue: 'Submitted At' })}:</h4>
                <p className={styles.detailValue}>{new Date(viewSubmission.submittedAt).toLocaleString()}</p>
              </div>
            )}
            {viewSubmission.content && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailLabel}>{t('lmsCourseDetail.submissionContent', { defaultValue: 'Content' })}:</h4>
                <div className={styles.contentBox}>{viewSubmission.content}</div>
              </div>
            )}
            {viewSubmission.asset && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailLabel}>{t('lmsCourseDetail.attachedFiles', { defaultValue: 'Attachment' })}:</h4>
                {viewSubmission.asset.mimeType?.startsWith('image/') ? (
                  <>
                    <img src={viewSubmission.asset.fileUrl} alt={viewSubmission.asset.originalName ?? viewSubmission.asset.fileName} className={styles.previewImage} />
                    <p className={styles.imageInfo}>{viewSubmission.asset.originalName ?? viewSubmission.asset.fileName} ({(viewSubmission.asset.fileSizeBytes / 1024).toFixed(1)} KB)</p>
                  </>
                ) : (
                  <div className={styles.fileInfo}>
                    <FileText size={16} />
                    <span>{viewSubmission.asset.originalName ?? viewSubmission.asset.fileName}</span>
                    <span className={styles.fileSizeText}>({(viewSubmission.asset.fileSizeBytes / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>
            )}
            {viewSubmission.finalMarks !== undefined && viewSubmission.finalMarks !== null && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailLabel}>{t('lmsCourseDetail.grade', { defaultValue: 'Grade' })}:</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#E8F3FF', borderRadius: 4, color: '#165DFF', fontWeight: 700 }}>
                  <Star size={14} /> {viewSubmission.finalMarks}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── AI Rubric Viewer ─────────────────────────────────────────────── */}
      {viewAIRubric && viewAIRubric.aiRubricScores && (
        <Modal
          open
          title={t('lmsCourseDetail.aiRubricAssessment', { defaultValue: 'AI Rubric Assessment' })}
          onClose={() => setViewAIRubric(null)}
          footer={<Button onClick={() => setViewAIRubric(null)}>{t('lmsCourseDetail.close', { defaultValue: 'Close' })}</Button>}
        >
          <div className={styles.rubricList}>
            {parseRubric(viewAIRubric.aiRubricScores).map((s: any, i: number) => (
              <div key={i} className={styles.rubricItem}>
                <div className={styles.rubricHeader}>
                  <span className={styles.rubricCriterion}>{s.criterion}</span>
                  <span className={styles.rubricScore}>{s.ai_score}/10</span>
                </div>
                <div className={styles.rubricBar}>
                  <div className={styles.rubricFill} style={{ width: `${s.ai_score * 10}%` }} />
                </div>
                {(s.ai_comment || s.ai_suggestions) && (
                  <div className={styles.rubricFeedback}>
                    {s.ai_comment && <p className={styles.rubricComment}>{s.ai_comment}</p>}
                    {s.ai_suggestions && (
                      <p className={styles.rubricComment} style={{ marginTop: 8, fontStyle: 'italic' }}>{s.ai_suggestions}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Upload Material Modal ─────────────────────────────────────────────── */}
      {materialModal && (
        <Modal
          open
          title={t('lmsCourseDetailLecturer.uploadMaterial', { defaultValue: 'Upload Material' })}
          onClose={() => setMaterialModal(false)}
          okText={t('lmsCourseDetailLecturer.upload', { defaultValue: 'Upload' })}
          onOk={() => uploadMaterialMutation.mutate()}
          okLoading={uploadMaterialMutation.isPending}
        >
          <div className={styles.uploadForm}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('lmsCourseDetailLecturer.title', { defaultValue: 'Title' })} *</label>
              <input
                type="text"
                className={styles.formInput}
                value={materialTitle}
                onChange={e => setMaterialTitle(e.target.value)}
                placeholder={t('lmsCourseDetailLecturer.titlePlaceholder', { defaultValue: 'Enter material title' })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('lmsCourseDetailLecturer.description', { defaultValue: 'Description' })}</label>
              <textarea
                className={styles.formTextarea}
                value={materialDesc}
                onChange={e => setMaterialDesc(e.target.value)}
                placeholder={t('lmsCourseDetailLecturer.descPlaceholder', { defaultValue: 'Optional description' })}
                rows={3}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('lmsCourseDetailLecturer.file', { defaultValue: 'File' })} *</label>
              <input
                type="file"
                className={styles.formFileInput}
                onChange={e => setMaterialFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.zip,.png,.jpg,.jpeg,.mp4,.webm,.mov,.avi,.mkv"
              />
              {materialFile && (
                <div className={styles.filePreview}>
                  <FileText size={14} />
                  <span>{materialFile.name}</span>
                  <span className={styles.fileSize}>
                    ({materialFile.size > 1024 * 1024 
                      ? `${(materialFile.size / 1024 / 1024).toFixed(2)} MB` 
                      : `${(materialFile.size / 1024).toFixed(0)} KB`})
                  </span>
                </div>
              )}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={materialPublished}
                  onChange={e => setMaterialPublished(e.target.checked)}
                />
                <span>{t('lmsCourseDetailLecturer.publishImmediately', { defaultValue: 'Publish immediately (visible to students)' })}</span>
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Material Preview Modal ─────────────────────────────────────────────── */}
      {materialPreview && materialPreview.asset && (
        <Modal
          open
          title={materialPreview.title}
          onClose={() => { setMaterialPreview(null); setPptPreviewMode('office') }}
          width={900}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={materialPreview.asset?.fileUrl}
                target="_blank"
                rel="noreferrer"
                download
                style={{ textDecoration: 'none' }}
              >
                <Button icon={<Download size={14} />}>
                  {t('lmsCourseDetail.download', { defaultValue: 'Download' })}
                </Button>
              </a>
              <Button variant="secondary" onClick={() => { setMaterialPreview(null); setPptPreviewMode('office') }}>
                {t('lmsCourseDetail.close', { defaultValue: 'Close' })}
              </Button>
            </div>
          }
        >
          <div className={styles.materialPreviewContent}>
            {materialPreview.materialType === 'video' ? (
              <div className={styles.videoContainer}>
                <video
                  controls
                  className={styles.videoPlayer}
                  src={materialPreview.asset.fileUrl}
                >
                  {t('lmsCourseDetail.videoNotSupported', { defaultValue: 'Your browser does not support video playback.' })}
                </video>
              </div>
            ) : (
              <div className={styles.pptPreviewWrapper}>
                <div className={styles.pptPreviewTabs}>
                  <Button 
                    size="sm" 
                    variant={pptPreviewMode === 'office' ? 'primary' : 'secondary'}
                    onClick={() => setPptPreviewMode('office')}
                  >
                    {t('lmsCourseDetail.onlinePreview', { defaultValue: 'Online Preview' })}
                  </Button>
                  <Button 
                    size="sm" 
                    variant={pptPreviewMode === 'download' ? 'primary' : 'secondary'}
                    onClick={() => setPptPreviewMode('download')}
                  >
                    {t('lmsCourseDetail.fileInfo', { defaultValue: 'File Info' })}
                  </Button>
                </div>
                
                {pptPreviewMode === 'office' ? (
                  <div className={styles.pptIframeContainer}>
                    <iframe
                      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(window.location.origin + materialPreview.asset.fileUrl)}`}
                      className={styles.pptIframe}
                      frameBorder="0"
                    >
                      {t('lmsCourseDetail.iframeNotSupported', { defaultValue: 'Your browser does not support iframes.' })}
                    </iframe>
                    <div className={styles.pptPreviewHint}>
                      {t('lmsCourseDetail.pptPreviewHint', { defaultValue: 'If preview fails, please download the file or check if the file is publicly accessible.' })}
                    </div>
                  </div>
                ) : (
                  <div className={styles.pptPreviewContainer}>
                    <div className={styles.pptPreviewInfo}>
                      <FileText size={48} />
                      <h3>{materialPreview.asset.originalName ?? materialPreview.asset.fileName}</h3>
                      <p>{t('lmsCourseDetail.pptPreviewNote', { defaultValue: 'PPT files can be previewed online or downloaded for offline viewing.' })}</p>
                      <div className={styles.pptFileInfo}>
                        <span>{(materialPreview.asset.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {materialPreview.description && (
              <div className={styles.materialPreviewDesc}>
                <h4>{t('lmsCourseDetail.description', { defaultValue: 'Description' })}</h4>
                <p>{materialPreview.description}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Create Assignment Modal ──────────────────────────────────────────── */}
      {assignmentModal && (
        <Modal
          open
          title={t('lmsCourseDetailLecturer.createAssignment', { defaultValue: 'Create Assignment' })}
          onClose={() => { setAssignmentModal(false); resetAssignmentForm() }}
          okText={t('lmsCourseDetailLecturer.create', { defaultValue: 'Create' })}
          onOk={() => createAssignmentMutation.mutate()}
          okLoading={createAssignmentMutation.isPending}
          width={640}
        >
          <div className={styles.uploadForm}>
            {/* Title */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('lmsCourseDetailLecturer.title', { defaultValue: 'Title' })} *</label>
              <Input
                className={styles.formInput}
                value={asnTitle}
                onChange={e => setAsnTitle(e.target.value)}
                placeholder={t('lmsCourseDetailLecturer.asnTitlePlaceholder', { defaultValue: 'e.g. Lab Report 1 – Linked List' })}
              />
            </div>
            {/* Description */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('lmsCourseDetailLecturer.description', { defaultValue: 'Description' })}</label>
              <textarea className={styles.formTextarea} rows={3} value={asnDesc} onChange={e => setAsnDesc(e.target.value)}
                placeholder={t('lmsCourseDetailLecturer.asnDescPlaceholder', { defaultValue: 'Instructions visible to students' })} />
            </div>
            {/* Due date / marks / weight row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('lmsCourseDetailLecturer.dueDate', { defaultValue: 'Due Date' })} *</label>
                <Input
                  className={styles.formInput}
                  type="datetime-local"
                  value={asnDueDate}
                  onChange={e => setAsnDueDate(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('lmsCourseDetailLecturer.maxMarks', { defaultValue: 'Max Marks' })}</label>
                <Input
                  className={styles.formInput}
                  type="number"
                  min={1}
                  value={asnMaxMarks}
                  onChange={e => setAsnMaxMarks(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('lmsCourseDetailLecturer.weightPct', { defaultValue: 'Weight (%)' })}</label>
                <Input
                  className={styles.formInput}
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={asnWeight}
                  onChange={e => setAsnWeight(e.target.value)}
                />
              </div>
            </div>

            {/* Rubric Criteria */}
            <div className={styles.formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className={styles.formLabel} style={{ margin: 0 }}>{t('lmsCourseDetailLecturer.rubricCriteria', { defaultValue: 'Rubric Criteria' })}</label>
                <Button size="sm" variant="ghost" icon={<Plus size={12} />}
                  onClick={() => setAsnCriteria(prev => [...prev, { criterion: '', max_marks: 10 }])}>
                  {t('lmsCourseDetailLecturer.addCriterion', { defaultValue: 'Add' })}
                </Button>
              </div>
              {asnCriteria.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <Input
                    className={styles.formInput}
                    style={{ flex: 3 }}
                    placeholder={t('lmsCourseDetailLecturer.criterionName', { defaultValue: 'Criterion name' })}
                    value={c.criterion}
                    onChange={e => setAsnCriteria(prev => prev.map((x, xi) => xi === i ? { ...x, criterion: e.target.value } : x))}
                  />
                  <Input
                    className={styles.formInput}
                    style={{ flex: 1 }}
                    type="number"
                    min={1}
                    placeholder="Marks"
                    value={c.max_marks}
                    onChange={e => setAsnCriteria(prev => prev.map((x, xi) => xi === i ? { ...x, max_marks: parseInt(e.target.value) || 0 } : x))}
                  />
                  <Button size="sm" variant="ghost" icon={<Minus size={12} />}
                    onClick={() => setAsnCriteria(prev => prev.filter((_, xi) => xi !== i))} />
                </div>
              ))}
            </div>

            {/* Questions */}
            <div className={styles.formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className={styles.formLabel} style={{ margin: 0 }}>{t('lmsCourseDetailLecturer.questions', { defaultValue: 'Questions' })}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['single-choice', 'multiple-choice', 'open-ended'] as QuestionType[]).map(type => (
                    <Button key={type} size="sm" variant="ghost" icon={<Plus size={12} />}
                      onClick={() => setAsnQuestions(prev => [...prev, {
                        type, text: '', marks: 5,
                        options: type !== 'open-ended' ? ['', ''] : [],
                      }])}>
                      {type === 'single-choice' ? 'Single' : type === 'multiple-choice' ? 'Multi' : 'Open'}
                    </Button>
                  ))}
                </div>
              </div>
              {asnQuestions.map((q, qi) => (
                <div key={qi} style={{ background: 'var(--color-gray-1)', borderRadius: 6, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-gray-6)', textTransform: 'uppercase' }}>
                      Q{qi + 1} · {q.type}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="number" min={1} value={q.marks} style={{ width: 52, fontSize: 12, padding: '2px 6px', border: '1px solid var(--color-gray-3)', borderRadius: 4 }}
                        onChange={e => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? { ...x, marks: parseInt(e.target.value) || 1 } : x))} />
                      <span style={{ fontSize: 11, color: 'var(--color-gray-5)' }}>pts</span>
                      <Button size="sm" variant="ghost" icon={<Minus size={12} />}
                        onClick={() => setAsnQuestions(prev => prev.filter((_, xi) => xi !== qi))} />
                    </div>
                  </div>
                  <input type="text" className={styles.formInput} style={{ marginBottom: 6 }}
                    placeholder={t('lmsCourseDetailLecturer.questionText', { defaultValue: 'Question text' })}
                    value={q.text} onChange={e => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? { ...x, text: e.target.value } : x))} />
                  {q.type !== 'open-ended' && (
                    <div>
                      {q.options.map((opt, oi) => (
                        <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: 'var(--color-gray-5)', padding: '6px 2px', minWidth: 16 }}>{String.fromCharCode(65 + oi)}.</span>
                          <input type="text" className={styles.formInput} style={{ flex: 1 }}
                            placeholder={t('lmsCourseDetailLecturer.optionText', { defaultValue: `Option ${String.fromCharCode(65 + oi)}` })}
                            value={opt} onChange={e => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? {
                              ...x, options: x.options.map((o, oi2) => oi2 === oi ? e.target.value : o)
                            } : x))} />
                          {q.options.length > 2 && (
                            <Button size="sm" variant="ghost" icon={<Minus size={11} />}
                              onClick={() => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? { ...x, options: x.options.filter((_, oi2) => oi2 !== oi) } : x))} />
                          )}
                        </div>
                      ))}
                      <Button size="sm" variant="ghost" icon={<Plus size={11} />}
                        onClick={() => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? { ...x, options: [...x.options, ''] } : x))}>
                        {t('lmsCourseDetailLecturer.addOption', { defaultValue: 'Add option' })}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default LmsCourseDetailLecturer
