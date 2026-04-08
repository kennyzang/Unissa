import { useTranslation } from 'react-i18next'
import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, Upload, Star, CheckCircle, Clock, Video, Link, BookOpen, Download, Eye, Play,
  Scan, AlertTriangle, UserCheck,
} from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import styles from './LmsCourseDetailStudent.module.scss'

// PPTX preview library
import * as pptxPreview from 'pptx-preview'

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface Submission {
  id: string
  assignmentId: string
  finalMarks?: number
  gradedAt?: string
  aiRubricScores?: string
  submittedAt?: string
  content?: string
  asset?: {
    id: string
    fileName: string
    originalName?: string
    fileUrl: string
    mimeType?: string
    fileSizeBytes: number
  }
  assignment?: { id: string; title: string; maxMarks: number; dueDate?: string }
}

interface CourseMaterial {
  id: string
  title: string
  description?: string
  materialType: string
  externalUrl?: string
  duration?: number
  orderIndex: number
  isPublished?: boolean
  asset?: {
    id: string
    fileName: string
    originalName?: string
    fileUrl: string
    mimeType?: string
    fileSizeBytes: number
  }
}

interface CourseSession {
  id: string
  name?: string
  startedAt: string
  endedAt?: string
  _count: { records: number }
}

interface StudentOffering {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  course: { id: string; name: string; code: string; creditHours: number; description?: string }
  lecturer: { user: { displayName: string } }
  assignments: Assignment[]
}

interface Enrolment {
  id: string
  finalGrade?: string
  offering: StudentOffering
}

interface AttendanceRecord {
  id: string
  sessionId: string
  scannedAt: string
  status: string
  session: { id: string; offeringId: string; startedAt: string; name?: string }
}

type Tab = 'materials' | 'assignments' | 'progress' | 'attendance'

// ─── Component ────────────────────────────────────────────────────────────────
const LmsCourseDetailStudent: React.FC = () => {
  const { t }          = useTranslation()
  const { offeringId } = useParams<{ offeringId: string }>()
  const navigate       = useNavigate()
  const user           = useAuthStore(s => s.user)
  const addToast       = useUIStore(s => s.addToast)
  const qc             = useQueryClient()

  const [activeTab, setActiveTab]                 = useState<Tab>('materials')
  const [submitModal, setSubmitModal]             = useState<Assignment | null>(null)
  const [submissionContent, setSubmissionContent] = useState('')
  const [submissionFiles, setSubmissionFiles]     = useState<File[]>([])
  const [questionAnswers, setQuestionAnswers]     = useState<Record<number, string | string[]>>({})
  const [fileErrors, setFileErrors]               = useState<string[]>([])
  const [aiLoading, setAiLoading]                 = useState(false)
  const [showConfirmation, setShowConfirmation]   = useState(false)
  const [lastSubmission, setLastSubmission]       = useState<Submission | null>(null)
  const [viewAI, setViewAI]                       = useState<Submission | null>(null)
  const [viewSubmission, setViewSubmission]       = useState<Submission | null>(null)
  const [imagePreview, setImagePreview]           = useState<{ url: string; name: string } | null>(null)
  const [materialPreview, setMaterialPreview]     = useState<CourseMaterial | null>(null)
  const [pptPreviewMode, setPptPreviewMode]       = useState<'native' | 'download'>('native')
  const [checkinToken, setCheckinToken]           = useState('')
  const [checkinMsg, setCheckinMsg]               = useState<{ ok: boolean; text: string } | null>(null)
  const [pptFileBuffer, setPptFileBuffer]         = useState<ArrayBuffer | null>(null)
  const [pptLoading, setPptLoading]               = useState(false)
  const pptRef                                    = useRef<HTMLDivElement>(null)
  const pptxPreviewer                             = useRef<any>(null)

  // PPT file loading effect
  useEffect(() => {
    if (materialPreview && materialPreview.asset && pptPreviewMode === 'native') {
      const loadPPTFile = async () => {
        try {
          setPptLoading(true)
          console.log('Loading PPT file from:', materialPreview.asset.fileUrl)
          const response = await fetch(materialPreview.asset.fileUrl)
          console.log('PPT file response status:', response.status)
          if (!response.ok) {
            throw new Error('Failed to load PPT file')
          }
          const arrayBuffer = await response.arrayBuffer()
          console.log('PPT file loaded successfully, buffer size:', arrayBuffer.byteLength)
          setPptFileBuffer(arrayBuffer)
        } catch (error) {
          console.error('PPT file loading failed:', error)
          setPptFileBuffer(null)
        } finally {
          setPptLoading(false)
        }
      }
      
      loadPPTFile()
    }
  }, [materialPreview, pptPreviewMode])

  // PPT preview initialization effect
  useEffect(() => {
    if (pptFileBuffer && pptRef.current) {
      try {
        console.log('Initializing PPT preview')
        // Initialize pptx previewer
        if (!pptxPreviewer.current) {
          pptxPreviewer.current = pptxPreview.init(pptRef.current, { width: '100%' })
        }
        // Preview the PPT file
        pptxPreviewer.current.preview(pptFileBuffer)
        console.log('PPT preview initialized successfully')
      } catch (error) {
        console.error('PPT preview initialization failed:', error)
      }
    }

    // Cleanup function
    return () => {
      if (pptxPreviewer.current) {
        pptxPreviewer.current = null
      }
    }
  }, [pptFileBuffer])

  // ── Student profile ──────────────────────────────────────────────────────────
  const { data: studentProfile } = useQuery({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
    enabled: !!user && user.role === 'student',
  })

  // ── Enrolments (to find this offering) ──────────────────────────────────────
  const { data: enrolments = [], isLoading: loadingEnrolments } = useQuery<Enrolment[]>({
    queryKey: ['lms', 'courses', studentProfile?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/courses/${studentProfile!.id}`)
      return data.data
    },
    enabled: !!studentProfile?.id,
  })

  const enrolment = enrolments.find(e => e.offering?.id === offeringId)
  const offering  = enrolment?.offering

  // ── Course materials ─────────────────────────────────────────────────────────
  const { data: materials = [] } = useQuery<CourseMaterial[]>({
    queryKey: ['lms', 'materials', offeringId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/materials/${offeringId}`)
      return data.data ?? []
    },
    enabled: !!offeringId && !!offering,
  })

  // ── Attendance sessions (for the Sessions section) ───────────────────────────
  const { data: sessions = [] } = useQuery<CourseSession[]>({
    queryKey: ['lms', 'sessions', offeringId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/sessions/offering/${offeringId}`)
      return data.data ?? []
    },
    enabled: !!offeringId && !!offering,
  })

  // ── Active attendance session for this offering ───────────────────────────────
  const { data: activeSession, refetch: refetchActiveSession } = useQuery<{
    id: string
    sessionToken: string
    qrExpiresAt: string
    startedAt: string
    name?: string
  } | null>({
    queryKey: ['lms', 'attendance', 'active-session', offeringId],
    queryFn: async () => {
      const { data } = await apiClient.get('/lms/attendance/active-sessions')
      const active = (data.data ?? []).find((s: any) => s.offeringId === offeringId)
      return active || null
    },
    enabled: !!offeringId && !!offering,
    refetchInterval: 30000,
  })

  // ── Check-in mutation ─────────────────────────────────────────────────────────
  const checkinMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/lms/attendance/check-in', {
        token: checkinToken,
        studentId: studentProfile?.id,
      })
      return data
    },
    onSuccess: (res) => {
      setCheckinMsg({ ok: true, text: res.message ?? t('lmsCourseDetail.checkinSuccess', { defaultValue: 'Check-in successful!' }) })
      setCheckinToken('')
      qc.invalidateQueries({ queryKey: ['lms', 'attendance', 'student', studentProfile?.id, offeringId] })
      qc.invalidateQueries({ queryKey: ['lms', 'sessions', offeringId] })
      refetchActiveSession()
      setTimeout(() => setCheckinMsg(null), 4000)
    },
    onError: (err: any) => {
      setCheckinMsg({ ok: false, text: err.response?.data?.message ?? t('lmsCourseDetail.checkinFailed', { defaultValue: 'Check-in failed. Please try again.' }) })
      setTimeout(() => setCheckinMsg(null), 4000)
    },
  })

  // ── Student attendance records ────────────────────────────────────────────────
  const { data: attendanceRecords = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['lms', 'attendance', 'student', studentProfile?.id, offeringId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/records/student/${studentProfile!.id}`)
      // API returns { records, summary } — filter records to this offering's sessions
      const sessionIds = new Set(sessions.map(s => s.id))
      return (data.data?.records ?? []).filter((r: any) => sessionIds.has(r.sessionId))
    },
    enabled: !!studentProfile?.id && !!offeringId && sessions.length > 0 && (activeTab === 'progress' || activeTab === 'attendance'),
  })

  // ── Submission history ────────────────────────────────────────────────────────
  const { data: submissionHistory = [] } = useQuery<Submission[]>({
    queryKey: ['submissions', 'history', offeringId, studentProfile?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/submissions/history/${offeringId}/${studentProfile!.id}`)
      return data.data ?? []
    },
    enabled: !!studentProfile?.id && !!offeringId,
  })

  // ── File validation ───────────────────────────────────────────────────────────
  const validateFiles = (files: File[]) => {
    const errors: string[] = []
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt']
    const maxSize = 10 * 1024 * 1024
    files.forEach(f => {
      const ext = `.${f.name.split('.').pop()?.toLowerCase()}`
      if (!allowed.includes(f.type) && !allowedExt.includes(ext))
        errors.push(t('lmsCourseDetail.fileFormatError', { fileName: f.name, defaultValue: `Unsupported file type: {{fileName}}. Allowed: JPG, PNG, PDF, DOC, DOCX, TXT.` }))
      if (f.size > maxSize)
        errors.push(t('lmsCourseDetail.fileSizeError', { fileName: f.name }))
    })
    if (files.length > 5) errors.push(t('lmsCourseDetail.maxFilesError'))
    return { valid: errors.length === 0, errors }
  }

  // ── Submit mutation ──────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async ({ assignmentId, content, files, answers }: { assignmentId: string; content: string; files: File[]; answers?: Array<{ questionIndex: number; type: string; answer: string | string[] }> }) => {
      const v = validateFiles(files)
      if (!v.valid) throw new Error(v.errors.join('; '))
      const trimmedContent = content.trim()
      const fd = new FormData()
      fd.append('assignmentId', assignmentId)
      fd.append('studentId', studentProfile?.id!)
      fd.append('content', trimmedContent)
      files.forEach(f => fd.append('files', f))
      if (answers && answers.length > 0) {
        fd.append('answers', JSON.stringify(answers))
      }
      setAiLoading(true)
      const { data } = await apiClient.post('/lms/submissions', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await new Promise(r => setTimeout(r, 2000))
      return data
    },
    onSuccess: data => {
      setAiLoading(false)
      setLastSubmission(data.data)
      setShowConfirmation(true)
      setSubmitModal(null)
      setSubmissionContent('')
      setSubmissionFiles([])
      setFileErrors([])
      setQuestionAnswers({})
      qc.invalidateQueries({ queryKey: ['submissions', 'history', offeringId, studentProfile?.id] })
      qc.invalidateQueries({ queryKey: ['lms', 'courses', studentProfile?.id] })
    },
    onError: (e: any) => {
      setAiLoading(false)
      const isNetworkError = !e.response && e.message === 'Network Error'
      const errorMessage = isNetworkError
        ? t('lmsCourseDetail.networkError', { defaultValue: 'Network error. Please check your connection and try again.' })
        : e.response?.data?.message ?? e.message ?? t('lmsCourseDetail.submissionFailed', { defaultValue: 'Submission failed' })
      addToast({ type: 'error', message: errorMessage })
    },
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const parseRubric = (jsonStr?: string) => {
    if (!jsonStr) return []
    try { return JSON.parse(jsonStr) } catch { return [] }
  }

  const parseAssignmentQuestions = (assignment: Assignment | null) => {
    if (!assignment) return []
    try {
      const rubric = typeof assignment.rubricCriteria === 'string'
        ? JSON.parse(assignment.rubricCriteria)
        : assignment.rubricCriteria
      return rubric?.questions ?? []
    } catch {
      return []
    }
  }

  // ── Loading / access denied ──────────────────────────────────────────────────
  if (loadingEnrolments) {
    return <div className={styles.page}><div className={styles.loading}>{t('lmsCourseDetail.loading', { defaultValue: 'Loading…' })}</div></div>
  }
  if (!offering) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{t('lmsCourseDetailStudent.notEnrolled', { defaultValue: 'You are not enrolled in this course.' })}</div>
      </div>
    )
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const assignments      = offering.assignments ?? []
  const now              = new Date()
  const submittedCount   = assignments.filter(a => submissionHistory.some(s => s.assignmentId === a.id)).length
  const presentCount     = attendanceRecords.filter(r => r.status === 'present').length
  const attendancePct    = sessions.length > 0 ? Math.round((presentCount / sessions.length) * 100) : 0
  const attendanceLevel  = attendancePct >= 80 ? 'high' : attendancePct >= 60 ? 'mid' : 'low'

  // ── Tab renderers ────────────────────────────────────────────────────────────
  const renderMaterials = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card title={t('lmsCourseDetail.courseMaterials', { defaultValue: 'Course Materials' })}>
        {materials.length === 0 ? (
          <div className={styles.emptyState}>{t('lmsCourseDetail.noMaterials', { defaultValue: 'No materials available yet.' })}</div>
        ) : (
          <div className={styles.materialsList}>
            {materials.filter(m => m.isPublished !== false).map(m => {
              const isVideo = m.materialType === 'video'
              const isLink  = m.materialType === 'link'
              const isPPT = m.materialType === 'presentation' || (m.asset?.mimeType?.includes('presentation') || m.asset?.originalName?.match(/\.pptx?$/i))
              const cls     = isVideo ? 'video' : isLink ? 'link' : 'doc'
              const href    = isLink ? m.externalUrl : m.asset?.fileUrl
              const canPreview = isVideo
              return (
                <div key={m.id} className={styles.materialItem}>
                  <div className={`${styles.materialIcon} ${styles[cls]}`}>
                    {isVideo ? <Video size={20} /> : isLink ? <Link size={20} /> : <FileText size={20} />}
                  </div>
                  <div className={styles.materialInfo}>
                    <div className={styles.materialTitle}>{m.title}</div>
                    {m.description && <div className={styles.materialMeta}>{m.description}</div>}
                    {m.asset && <div className={styles.materialMeta}>{m.asset.originalName ?? m.asset.fileName} · {(m.asset.fileSizeBytes / 1024).toFixed(0)} KB</div>}
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
                      <a
                        className={styles.materialDownloadBtn}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        download
                      >
                        <Download size={14} />
                        {t('lmsCourseDetail.download', { defaultValue: 'Download' })}
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Course sessions list */}
      <Card title={t('lmsCourseDetail.courseSessions', { defaultValue: 'Course Sessions' })}>
        {sessions.length === 0 ? (
          <div className={styles.emptyState}>{t('lmsCourseDetail.noSessions', { defaultValue: 'No sessions recorded yet.' })}</div>
        ) : (
          <div className={styles.sessionsList}>
            {sessions.map((s, idx) => (
              <div key={s.id} className={styles.sessionItem}>
                <div className={styles.sessionDate}>{new Date(s.startedAt).toLocaleDateString()}</div>
                <div className={styles.sessionInfo}>
                  <h4 className={styles.sessionTitle}>
                    {s.name ?? `${t('lmsCourseDetail.session', { defaultValue: 'Session' })} ${idx + 1}`}
                  </h4>
                  <p className={styles.sessionMeta}>
                    {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {s.endedAt && ` – ${new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <Badge color={s.endedAt ? 'green' : 'orange'} size="sm">
                  {s.endedAt
                    ? t('lmsCourseDetail.closed', { defaultValue: 'Closed' })
                    : t('lmsCourseDetail.open', { defaultValue: 'Open' })}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )

  const renderAssignments = () => {
    const sortedAssignments = [...assignments].sort((a, b) => {
      const aSubmitted = submissionHistory.some(s => s.assignmentId === a.id)
      const bSubmitted = submissionHistory.some(s => s.assignmentId === b.id)
      if (aSubmitted !== bSubmitted) return aSubmitted ? 1 : -1
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })
    
    return (
    <Card title={t('lmsCourseDetail.assignmentsAssessments', { defaultValue: 'Assignments & Assessments' })}>
      {sortedAssignments.length === 0 ? (
        <div className={styles.emptyState}>{t('lmsCourseDetail.noAssignments', { defaultValue: 'No assignments yet.' })}</div>
      ) : (
        <div className={styles.assignmentList}>
          {sortedAssignments.map(a => {
            const isDue      = a.dueDate && new Date(a.dueDate) < now
            const submission = submissionHistory.find(s => s.assignmentId === a.id)
            return (
              <div key={a.id} className={styles.assignmentItem}>
                <div className={styles.assignmentIcon}><FileText size={18} /></div>
                <div className={styles.assignmentInfo}>
                  <div className={styles.assignmentTitle}>{a.title}</div>
                  <div className={styles.assignmentMeta}>
                    <span>{t('lmsCourseDetail.maxMarks', { defaultValue: 'Max' })}: {a.maxMarks} pts</span>
                    <span>{t('lmsCourseDetail.weight', { defaultValue: 'Weight' })}: {a.weight || 0}%</span>
                    {a.dueDate && (
                      <span className={isDue ? styles.overdue : styles.dueSoon}>
                        <Clock size={11} />
                        {t('lmsCourseDetail.due', { defaultValue: 'Due' })} {new Date(a.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {submission && (
                    <div className={styles.submissionStatus}>
                      <CheckCircle size={11} />
                      {t('lmsCourseDetail.submittedOn', { defaultValue: 'Submitted' })}: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '—'}
                    </div>
                  )}
                </div>
                <div className={styles.assignmentActions}>
                  {submission?.finalMarks !== undefined && submission.finalMarks !== null ? (
                    <div className={styles.gradeChip}>
                      <Star size={13} /> {submission.finalMarks}/{a.maxMarks}
                    </div>
                  ) : submission ? (
                    <Badge color="blue" size="sm"><CheckCircle size={11} /> {t('lmsCourseDetail.submitted', { defaultValue: 'Submitted' })}</Badge>
                  ) : !isDue ? (
                    <Button
                      size="sm"
                      icon={<Upload size={13} />}
                      onClick={() => { setSubmitModal(a); setSubmissionContent(''); setSubmissionFiles([]) }}
                    >
                      {t('lmsCourseDetail.submit', { defaultValue: 'Submit' })}
                    </Button>
                  ) : (
                    <Badge color="red" size="sm"><Clock size={11} /> {t('lmsCourseDetail.overdue', { defaultValue: 'Overdue' })}</Badge>
                  )}
                  {submission?.aiRubricScores && (
                    <Button size="sm" variant="ghost" onClick={() => setViewAI(submission)}>
                      {t('lmsCourseDetail.aiRubric', { defaultValue: 'AI Rubric' })}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
    )
  }

  const renderProgress = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Submission history */}
      <Card title={t('lmsCourseDetail.submissionHistory', { defaultValue: 'Submission History' })}>
        {submissionHistory.length === 0 ? (
          <div className={styles.emptyState}>{t('lmsCourseDetail.noSubmissions', { defaultValue: 'No submissions yet.' })}</div>
        ) : (
          <div className={styles.historyList}>
            {submissionHistory.map(sub => (
              <div key={sub.id} className={styles.historyItem}>
                <div className={styles.historyIcon}><FileText size={18} /></div>
                <div className={styles.historyInfo}>
                  <div className={styles.historyTitle}>{sub.assignment?.title ?? t('lmsCourseDetail.assignment', { defaultValue: 'Assignment' })}</div>
                  <div className={styles.historyMeta}>
                    {sub.assignment?.maxMarks && <span>{t('lmsCourseDetail.maxMarks', { defaultValue: 'Max' })}: {sub.assignment.maxMarks}</span>}
                    {sub.submittedAt && <span>{t('lmsCourseDetail.submittedAt', { defaultValue: 'Submitted' })}: {new Date(sub.submittedAt).toLocaleString()}</span>}
                  </div>
                  {sub.content && <div className={styles.historyContent}>{sub.content.substring(0, 100)}{sub.content.length > 100 ? '…' : ''}</div>}
                  {sub.asset && (
                    <div className={styles.historyAttachments}>
                      <div className={styles.attachmentLabel}><FileText size={12} /><span>{t('lmsCourseDetail.attachedFiles', { defaultValue: 'Attachment' })}:</span></div>
                      <div className={styles.attachmentItem}>
                        {sub.asset.mimeType?.startsWith('image/') ? (
                          <img
                            src={sub.asset.fileUrl}
                            alt={sub.asset.originalName ?? sub.asset.fileName}
                            className={styles.attachmentImage}
                            onClick={() => sub.asset && setImagePreview({ url: sub.asset.fileUrl, name: sub.asset.originalName ?? sub.asset.fileName })}
                          />
                        ) : (
                          <>
                            <span className={styles.attachmentName}>{sub.asset.originalName ?? sub.asset.fileName}</span>
                            <span className={styles.attachmentSize}>({(sub.asset.fileSizeBytes / 1024).toFixed(1)} KB)</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.historyStatus}>
                  {sub.finalMarks !== undefined && sub.finalMarks !== null ? (
                    <div className={styles.gradeChip}><Star size={13} /> {sub.finalMarks}/{sub.assignment?.maxMarks}</div>
                  ) : (
                    <Badge color="blue" size="sm"><Clock size={11} /> {t('lmsCourseDetail.pendingGrading', { defaultValue: 'Pending' })}</Badge>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setViewSubmission(sub)}>
                    {t('lmsCourseDetail.viewSubmission', { defaultValue: 'View' })}
                  </Button>
                  {sub.aiRubricScores && (
                    <Button size="sm" variant="ghost" onClick={() => setViewAI(sub)}>
                      {t('lmsCourseDetail.aiRubric', { defaultValue: 'AI' })}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Attendance record */}
      <Card title={t('lmsCourseDetail.attendanceRecords', { defaultValue: 'Attendance' })}>
        {sessions.length === 0 ? (
          <div className={styles.emptyState}>{t('lmsCourseDetailStudent.noAttendance', { defaultValue: 'No sessions recorded.' })}</div>
        ) : (
          <div className={styles.attendanceStrip}>
            <div className={styles.attendanceBar}>
              <span className={styles.attendanceLabel}>{t('lmsCourseDetailStudent.attendanceRate', { defaultValue: 'Attendance rate' })}</span>
              <div className={styles.attendanceBarFill}>
                <div className={`${styles.attendanceBarInner} ${styles[attendanceLevel]}`} style={{ width: `${attendancePct}%` }} />
              </div>
              <span className={`${styles.attendancePct} ${attendancePct >= 80 ? styles.high : attendancePct >= 60 ? styles.mid : styles.low}`}>
                {attendancePct}%
              </span>
              <span className={styles.attendanceLabel}>{presentCount}/{sessions.length}</span>
            </div>
            <div className={styles.attendanceRecordList}>
              {sessions.map((s, idx) => {
                const attended = attendanceRecords.some(r => r.sessionId === s.id && r.status === 'present')
                return (
                  <div key={s.id} className={styles.attendanceRecordItem}>
                    <span className={styles.attendanceRecordDate}>
                      {s.name ?? `${t('lmsCourseDetail.session', { defaultValue: 'Session' })} ${idx + 1}`} · {new Date(s.startedAt).toLocaleDateString()}
                    </span>
                    <Badge color={attended ? 'green' : 'red'} size="sm">
                      {attended
                        ? t('lmsCourseDetail.attended', { defaultValue: 'Present' })
                        : t('lmsCourseDetailStudent.absent', { defaultValue: 'Absent' })}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  )

  const renderAttendance = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Check-in form — always visible so student can paste a token any time */}
      <Card title={t('lmsCourseDetail.checkInTitle', { defaultValue: 'Check In to Session' })}>
        {activeSession ? (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f0faf4', border: '1px solid #b7eb8f', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} color="#52c41a" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#389e0d' }}>
              {activeSession.name ?? t('lmsCourseDetail.activeSession', { defaultValue: 'Active Session' })}
            </span>
            <span style={{ fontSize: 12, color: '#86909c', marginLeft: 4 }}>
              · {t('lmsCourseDetail.startedAt', { defaultValue: 'Started' })} {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#86909c', marginBottom: 12 }}>
            {t('lmsCourseDetail.noActiveSession', { defaultValue: 'No active session right now. Enter your token to check in manually.' })}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={checkinToken}
            onChange={e => setCheckinToken(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && checkinToken.trim() && checkinMutation.mutate()}
            placeholder={t('lmsCourseDetail.enterToken', { defaultValue: 'Enter token from lecturer' })}
            className={styles.tokenInput}
            style={{ flex: 1 }}
            maxLength={64}
          />
          <Button
            onClick={() => checkinMutation.mutate()}
            disabled={!checkinToken.trim() || checkinMutation.isPending}
            loading={checkinMutation.isPending}
            icon={<UserCheck size={14} />}
          >
            {t('lmsCourseDetail.checkIn', { defaultValue: 'Check In' })}
          </Button>
        </div>
        {checkinMsg && (
          <div className={`${styles.checkinMsg} ${checkinMsg.ok ? styles.checkinMsgOk : styles.checkinMsgErr}`} style={{ marginTop: 10 }}>
            {checkinMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {checkinMsg.text}
          </div>
        )}
      </Card>

      {/* Attendance history */}
      <Card title={t('lmsCourseDetail.attendanceHistory', { defaultValue: 'Attendance History' })}>
        {sessions.length === 0 ? (
          <div className={styles.emptyState}>
            {t('lmsCourseDetailStudent.noAttendance', { defaultValue: 'No sessions recorded yet.' })}
          </div>
        ) : (
          <>
            <div className={styles.attendanceBar} style={{ marginBottom: 16 }}>
              <span className={styles.attendanceLabel}>{t('lmsCourseDetailStudent.attendanceRate', { defaultValue: 'Attendance rate' })}</span>
              <div className={styles.attendanceBarFill}>
                <div className={`${styles.attendanceBarInner} ${styles[attendanceLevel]}`} style={{ width: `${attendancePct}%` }} />
              </div>
              <span className={`${styles.attendancePct} ${attendancePct >= 80 ? styles.high : attendancePct >= 60 ? styles.mid : styles.low}`}>
                {attendancePct}%
              </span>
              <span className={styles.attendanceLabel}>{presentCount}/{sessions.length}</span>
            </div>
            <div className={styles.attendanceRecordList}>
              {sessions.map((s, idx) => {
                const attended = attendanceRecords.some(r => r.sessionId === s.id && r.status === 'present')
                return (
                  <div key={s.id} className={styles.attendanceRecordItem}>
                    <UserCheck size={14} color={attended ? '#52c41a' : '#bbb'} />
                    <span className={styles.attendanceRecordDate}>
                      {s.name ?? `${t('lmsCourseDetail.session', { defaultValue: 'Session' })} ${idx + 1}`} · {new Date(s.startedAt).toLocaleDateString()}
                    </span>
                    <Badge color={attended ? 'green' : 'red'} size="sm">
                      {attended
                        ? t('lmsCourseDetail.attended', { defaultValue: 'Present' })
                        : t('lmsCourseDetailStudent.absent', { defaultValue: 'Absent' })}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Back */}
      <button className={styles.backBtn} onClick={() => navigate('/lms/courses')}>
        <ArrowLeft size={16} /> {t('lmsCourseDetail.backToCourses', { defaultValue: 'Back to My Courses' })}
      </button>

      {/* Hero */}
      <div className={styles.courseHero}>
        <div className={styles.heroLeft}>
          <div className={styles.courseCode}>{offering.course?.code}</div>
          <h1 className={styles.courseName}>{offering.course?.name}</h1>
          <div className={styles.courseMeta}>
            <span>👤 {offering.lecturer?.user?.displayName ?? 'TBA'}</span>
            <span>🕐 {offering.dayOfWeek} {offering.startTime}–{offering.endTime}</span>
            <span>📍 {offering.room}</span>
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span>{offering.course?.creditHours}</span>
            <label>{t('lmsCourseDetail.creditHours', { defaultValue: 'Credit Hrs' })}</label>
          </div>
          <div className={styles.heroStat}>
            <span>{assignments.length}</span>
            <label>{t('lmsCourseDetail.assignments', { defaultValue: 'Assignments' })}</label>
          </div>
          {enrolment?.finalGrade && (
            <div className={styles.heroStat}>
              <span style={{ fontSize: '24px' }}>{enrolment.finalGrade.replace('_plus', '+')}</span>
              <label>{t('lmsCourseDetailStudent.finalGrade', { defaultValue: 'Grade' })}</label>
            </div>
          )}
        </div>
      </div>

      {/* Quick Check-in Card */}
      {activeSession && (
        <div className={styles.checkinCard}>
          <div className={styles.checkinHeader}>
            <div className={styles.checkinTitle}>
              <Scan size={20} />
              <span>{t('lmsCourseDetail.quickCheckin', { defaultValue: 'Quick Check-in' })}</span>
            </div>
            <Badge color="green" size="sm">
              <CheckCircle size={12} />
              {t('lmsCourseDetail.sessionActive', { defaultValue: 'Session Active' })}
            </Badge>
          </div>
          <div className={styles.checkinBody}>
            <div className={styles.checkinInfo}>
              <p className={styles.checkinSessionName}>
                {activeSession.name ?? t('lmsCourseDetail.currentSession', { defaultValue: 'Current Session' })}
              </p>
              <p className={styles.checkinTime}>
                <Clock size={14} />
                {t('lmsCourseDetail.startedAt', { defaultValue: 'Started' })}: {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className={styles.checkinInput}>
              <input
                type="text"
                value={checkinToken}
                onChange={e => setCheckinToken(e.target.value.toUpperCase())}
                placeholder={t('lmsCourseDetail.enterToken', { defaultValue: 'Enter token from lecturer' })}
                className={styles.tokenInput}
                maxLength={6}
              />
              <Button
                onClick={() => checkinMutation.mutate()}
                disabled={!checkinToken.trim() || checkinMutation.isPending}
                loading={checkinMutation.isPending}
              >
                <CheckCircle size={14} />
                {t('lmsCourseDetail.checkIn', { defaultValue: 'Check In' })}
              </Button>
            </div>
            {checkinMsg && (
              <div className={`${styles.checkinMsg} ${checkinMsg.ok ? styles.checkinMsgOk : styles.checkinMsgErr}`}>
                {checkinMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {checkinMsg.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress summary cards */}
      <div className={styles.progressRow}>
        <div className={styles.progressCard}>
          <div className={styles.progressCardLabel}>{t('lmsCourseDetailStudent.assignments', { defaultValue: 'Assignments Submitted' })}</div>
          <div className={styles.progressCardValue}>{submittedCount} / {assignments.length}</div>
          <div className={styles.progressCardBar}>
            <div className={`${styles.progressCardFill} ${styles.blue}`} style={{ width: assignments.length ? `${(submittedCount / assignments.length) * 100}%` : '0%' }} />
          </div>
        </div>
        <div className={styles.progressCard}>
          <div className={styles.progressCardLabel}>{t('lmsCourseDetailStudent.attendance', { defaultValue: 'Attendance' })}</div>
          <div className={styles.progressCardValue}>{attendancePct}%</div>
          <div className={styles.progressCardBar}>
            <div className={`${styles.progressCardFill} ${attendancePct >= 80 ? styles.green : attendancePct >= 60 ? styles.orange : styles.orange}`} style={{ width: `${attendancePct}%` }} />
          </div>
        </div>
        <div className={styles.progressCard}>
          <div className={styles.progressCardLabel}>{t('lmsCourseDetailStudent.materials', { defaultValue: 'Materials Available' })}</div>
          <div className={styles.progressCardValue}>{materials.length}</div>
          <div className={styles.progressCardBar}>
            <div className={`${styles.progressCardFill} ${styles.blue}`} style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {([
          { key: 'materials',   icon: <BookOpen size={14} />,    label: t('lmsCourseDetail.courseMaterials', { defaultValue: 'Materials' }) },
          { key: 'assignments', icon: <FileText size={14} />,    label: t('lmsCourseDetail.assignments', { defaultValue: 'Assignments' }), badge: assignments.filter(a => !submissionHistory.some(s => s.assignmentId === a.id) && (!a.dueDate || new Date(a.dueDate) > now)).length || undefined },
          { key: 'attendance',  icon: <UserCheck size={14} />,   label: t('lmsCourseDetailStudent.tabAttendance', { defaultValue: 'Attendance' }), badge: activeSession ? 1 : undefined },
          { key: 'progress',    icon: <Star size={14} />,        label: t('lmsCourseDetailStudent.tabProgress', { defaultValue: 'My Progress' }) },
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
      {activeTab === 'materials'   && renderMaterials()}
      {activeTab === 'assignments' && renderAssignments()}
      {activeTab === 'attendance'  && renderAttendance()}
      {activeTab === 'progress'    && renderProgress()}

      {/* ── Submit Modal ──────────────────────────────────────────────────── */}
      {submitModal && (
        <Modal
          open
          title={`${t('lmsCourseDetail.submit', { defaultValue: 'Submit' })}: ${submitModal.title}`}
          onClose={() => { setSubmitModal(null); setSubmissionFiles([]); setAiLoading(false); setQuestionAnswers({}) }}
          okText={aiLoading ? t('lmsCourseDetail.aiGrading', { defaultValue: 'AI grading…' }) : t('lmsCourseDetail.submitAssignment', { defaultValue: 'Submit Assignment' })}
          onOk={() => {
            const questions = parseAssignmentQuestions(submitModal)
            const unanswered = questions.filter((_: any, qi: number) => {
              const ans = questionAnswers[qi]
              if (ans === undefined || ans === null) return true
              if (typeof ans === 'string') return ans.trim() === ''
              if (Array.isArray(ans)) return ans.length === 0
              return true
            })
            if (unanswered.length > 0) {
              addToast({ type: 'error', message: `Please answer all ${unanswered.length} required question(s) before submitting.` })
              return
            }
            const answersArray = questions.map((_: any, qi: number) => ({
              questionIndex: qi,
              type: questions[qi].type,
              answer: questionAnswers[qi] ?? '',
            }))
            submitMutation.mutate({
              assignmentId: submitModal.id,
              content: submissionContent,
              files: submissionFiles,
              answers: answersArray,
            })
          }}
          okLoading={submitMutation.isPending || aiLoading}
        >
          {aiLoading ? (
            <div className={styles.aiLoadingContainer}>
              <div className={styles.aiLoadingSpinner} />
              <h3 className={styles.aiLoadingTitle}>{t('lmsCourseDetail.aiGradingInProgress', { defaultValue: 'AI grading in progress…' })}</h3>
              <p className={styles.aiLoadingMessage}>{t('lmsCourseDetail.aiGradingMessage', { defaultValue: 'Analysing your submission…' })}</p>
              <div className={styles.aiLoadingSteps}>
                <div className={styles.aiLoadingStep}><CheckCircle size={16} /><span>{t('lmsCourseDetail.analyzingContent', { defaultValue: 'Analysing content' })}</span></div>
                <div className={styles.aiLoadingStep}><CheckCircle size={16} /><span>{t('lmsCourseDetail.evaluatingRubric', { defaultValue: 'Evaluating rubric' })}</span></div>
                <div className={styles.aiLoadingStep}><div className={styles.spinner} /><span>{t('lmsCourseDetail.generatingFeedback', { defaultValue: 'Generating feedback' })}</span></div>
              </div>
            </div>
          ) : (
            <>
              <p className={styles.submitInfo}>
                {t('lmsCourseDetail.maxMarks', { defaultValue: 'Max' })}: {submitModal.maxMarks} pts
                {' · '}{t('lmsCourseDetail.weight', { defaultValue: 'Weight' })}: {submitModal.weight}%
              </p>

              {/* Per-question answer section */}
              {(() => {
                const questions = parseAssignmentQuestions(submitModal)
                if (questions.length === 0) {
                  return (
                    <>
                      <label className={styles.submitLabel}>
                        {t('lmsCourseDetail.yourAnswerNotes', { defaultValue: 'Your answer / notes' })}
                      </label>
                      <textarea
                        className={styles.submitTextarea}
                        rows={6}
                        placeholder={t('lmsCourseDetail.typeYourResponse', { defaultValue: 'Type your response here…' })}
                        value={submissionContent}
                        onChange={e => setSubmissionContent(e.target.value)}
                      />
                    </>
                  )
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {questions.map((q: any, qi: number) => (
                      <div key={qi} style={{
                        background: 'var(--color-gray-1)',
                        borderRadius: 8,
                        padding: '12px 14px',
                        border: '1px solid var(--color-gray-3)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gray-8)' }}>
                            Q{qi + 1}. {q.text}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--color-gray-5)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                            {q.marks} pts · <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>Required</span>
                          </span>
                        </div>

                        {q.type === 'single-choice' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {q.options.map((opt: string, oi: number) => {
                              const label = String.fromCharCode(65 + oi)
                              return (
                                <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                  <input
                                    type="radio"
                                    name={`q-${qi}`}
                                    value={label}
                                    checked={questionAnswers[qi] === label}
                                    onChange={() => setQuestionAnswers(prev => ({ ...prev, [qi]: label }))}
                                    style={{ accentColor: 'var(--color-primary)' }}
                                  />
                                  <span style={{ fontWeight: 600, minWidth: 16 }}>{label}.</span>
                                  <span>{opt}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}

                        {q.type === 'multiple-choice' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 11, color: 'var(--color-gray-5)', marginBottom: 2 }}>Select all that apply</div>
                            {q.options.map((opt: string, oi: number) => {
                              const label = String.fromCharCode(65 + oi)
                              const selected: string[] = Array.isArray(questionAnswers[qi]) ? questionAnswers[qi] as string[] : []
                              return (
                                <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                  <input
                                    type="checkbox"
                                    value={label}
                                    checked={selected.includes(label)}
                                    onChange={() => {
                                      setQuestionAnswers(prev => {
                                        const cur: string[] = Array.isArray(prev[qi]) ? prev[qi] as string[] : []
                                        return {
                                          ...prev,
                                          [qi]: cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label]
                                        }
                                      })
                                    }}
                                    style={{ accentColor: 'var(--color-primary)' }}
                                  />
                                  <span style={{ fontWeight: 600, minWidth: 16 }}>{label}.</span>
                                  <span>{opt}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}

                        {q.type === 'open-ended' && (
                          <textarea
                            style={{
                              width: '100%', minHeight: 80, padding: '8px 10px',
                              border: '1px solid var(--color-gray-3)', borderRadius: 6,
                              fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                              background: 'white',
                            }}
                            placeholder="Type your answer here…"
                            value={typeof questionAnswers[qi] === 'string' ? questionAnswers[qi] as string : ''}
                            onChange={e => setQuestionAnswers(prev => ({ ...prev, [qi]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* File upload (always optional) */}
              <div style={{ marginTop: 12 }}>
                <label className={styles.submitLabel}>
                  {t('lmsCourseDetail.uploadImages', { defaultValue: 'Attach files (optional)' })}
                </label>
                <div className={styles.fileUpload}>
                  <input
                    type="file" multiple accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className={styles.fileInput}
                    onChange={e => {
                      if (e.target.files) {
                        const files = Array.from(e.target.files)
                        const v = validateFiles(files)
                        if (v.valid) { setSubmissionFiles(files); setFileErrors([]) }
                        else setFileErrors(v.errors)
                      }
                    }}
                  />
                  <div className={styles.fileButton}><Upload size={16} /><span>{t('lmsCourseDetail.chooseImages', { defaultValue: 'Choose files' })}</span></div>
                </div>
                {fileErrors.length > 0 && (
                  <div className={styles.fileErrors}>
                    {fileErrors.map((e, i) => <div key={i} className={styles.fileError}>{e}</div>)}
                  </div>
                )}
                {submissionFiles.length > 0 && (
                  <div className={styles.filesList}>
                    {submissionFiles.map((f, i) => (
                      <div key={i} className={styles.fileItem}>
                        <FileText size={14} />
                        <span className={styles.fileName}>{f.name}</span>
                        <span className={styles.fileSize}>{(f.size / 1024).toFixed(1)} KB</span>
                        <button className={styles.removeFile} onClick={() => setSubmissionFiles(submissionFiles.filter((_, j) => j !== i))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className={styles.aiNote}>🤖 {t('lmsCourseDetail.aiRubricGrading', { defaultValue: 'Submission will be assessed by AI rubric' })}</p>
            </>
          )}
        </Modal>
      )}

      {/* ── AI Rubric Modal ──────────────────────────────────────────────── */}
      {viewAI && viewAI.aiRubricScores && (
        <Modal
          open
          title={t('lmsCourseDetail.aiRubricAssessment', { defaultValue: 'AI Rubric Assessment' })}
          onClose={() => setViewAI(null)}
          footer={<Button onClick={() => setViewAI(null)}>{t('lmsCourseDetail.close', { defaultValue: 'Close' })}</Button>}
        >
          <div className={styles.rubricList}>
            {parseRubric(viewAI.aiRubricScores).map((s: any, i: number) => (
              <div key={i} className={styles.rubricItem}>
                <div className={styles.rubricHeader}>
                  <span className={styles.rubricCriterion}>{s.criterion}</span>
                  <span className={styles.rubricScore}>{s.ai_score}/10</span>
                </div>
                <div className={styles.rubricBar}><div className={styles.rubricFill} style={{ width: `${s.ai_score * 10}%` }} /></div>
                <div className={styles.rubricFeedback}>
                  <h5 className={styles.feedbackTitle}>{t('lmsCourseDetail.gradingExplanation', { defaultValue: 'Feedback' })}</h5>
                  <p className={styles.rubricComment}>{s.ai_comment}</p>
                  {s.ai_suggestions && (
                    <div className={styles.feedbackSuggestions}>
                      <h6 className={styles.suggestionsTitle}>{t('lmsCourseDetail.improvementSuggestions', { defaultValue: 'Suggestions' })}</h6>
                      <p className={styles.suggestionsText}>{s.ai_suggestions}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Confirmation Modal ──────────────────────────────────────────── */}
      {showConfirmation && lastSubmission && (
        <Modal open title="" onClose={() => setShowConfirmation(false)} footer={null}>
          <div className={styles.confirmationModal}>
            <div className={styles.successIcon}><CheckCircle size={48} /></div>
            <h2 className={styles.confirmationTitle}>{t('lmsCourseDetail.submissionSuccess', { defaultValue: 'Submitted!' })}</h2>
            <p className={styles.confirmationMessage}>{t('lmsCourseDetail.yourAssignmentSubmitted', { defaultValue: 'Your assignment has been submitted.' })}</p>
            {lastSubmission.aiRubricScores && (() => {
              const scores = parseRubric(lastSubmission.aiRubricScores)
              if (!scores.length) return null
              const avg = scores.reduce((s: number, r: any) => s + r.ai_score, 0) / scores.length
              return (
                <div className={styles.aiSummary}>
                  <h3 className={styles.aiSummaryTitle}>{t('lmsCourseDetail.aiGradingSuggestions', { defaultValue: 'AI Scoring Suggestion' })}</h3>
                  <div className={styles.aiScoreDisplay}>
                    <span className={styles.aiScoreValue}>{avg.toFixed(1)}</span>
                    <span className={styles.aiScoreLabel}>/ 10</span>
                  </div>
                  <p className={styles.aiSummaryNote}>{t('lmsCourseDetail.aiScoreReference', { defaultValue: 'AI score is for reference only.' })}</p>
                </div>
              )
            })()}
            <div className={styles.confirmationActions}>
              <Button onClick={() => { setShowConfirmation(false); setViewAI(lastSubmission) }}>
                {t('lmsCourseDetail.viewAiGradingDetails', { defaultValue: 'View AI Details' })}
              </Button>
              <Button variant="secondary" onClick={() => { setShowConfirmation(false); setActiveTab('progress') }}>
                {t('lmsCourseDetail.returnToCourse', { defaultValue: 'View My Progress' })}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── View Submission Modal ─────────────────────────────────────────── */}
      {viewSubmission && (
        <Modal
          open
          title={t('lmsCourseDetail.submissionDetails', { defaultValue: 'Submission Details' })}
          onClose={() => setViewSubmission(null)}
          footer={<Button onClick={() => setViewSubmission(null)}>{t('lmsCourseDetail.close', { defaultValue: 'Close' })}</Button>}
        >
          <div className={styles.submissionDetails}>
            <div className={styles.detailSection}>
              <h4 className={styles.detailLabel}>{t('lmsCourseDetail.assignment', { defaultValue: 'Assignment' })}:</h4>
              <p className={styles.detailValue}>{viewSubmission.assignment?.title ?? '—'}</p>
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
                    <img 
                      src={viewSubmission.asset.fileUrl} 
                      alt={viewSubmission.asset.originalName ?? viewSubmission.asset.fileName} 
                      className={styles.previewImage}
                      onClick={() => viewSubmission.asset && setImagePreview({ url: viewSubmission.asset.fileUrl, name: viewSubmission.asset.originalName ?? viewSubmission.asset.fileName })}
                      style={{ cursor: 'pointer' }}
                    />
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
                <div className={styles.gradeDisplay}>
                  <Star size={16} />
                  <span className={styles.gradeValue}>{viewSubmission.finalMarks}</span>
                  <span className={styles.gradeMax}>/ {viewSubmission.assignment?.maxMarks}</span>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Image Preview Modal */}
      {imagePreview && (
        <Modal
          open
          title={imagePreview.name}
          onClose={() => setImagePreview(null)}
        >
          <div className={styles.imagePreviewModal}>
            <img src={imagePreview.url} alt={imagePreview.name} className={styles.imagePreviewLarge} />
            <p className={styles.imagePreviewName}>{imagePreview.name}</p>
          </div>
        </Modal>
      )}

      {/* Material Preview Modal */}
      {materialPreview && materialPreview.asset && (
        <Modal
          open
          title={materialPreview.title}
          onClose={() => { setMaterialPreview(null); setPptPreviewMode('native') }}
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
              <Button variant="secondary" onClick={() => { setMaterialPreview(null); setPptPreviewMode('native') }}>
                {t('lmsCourseDetail.close', { defaultValue: 'Close' })}
              </Button>
            </div>
          }
          className={styles.materialPreviewModal}
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
                      variant={pptPreviewMode === 'native' ? 'primary' : 'secondary'}
                      onClick={() => setPptPreviewMode('native')}
                    >
                      {t('lmsCourseDetail.nativePreview', { defaultValue: 'Native Preview' })}
                    </Button>
                    <Button 
                      size="sm" 
                      variant={pptPreviewMode === 'download' ? 'primary' : 'secondary'}
                      onClick={() => setPptPreviewMode('download')}
                    >
                      {t('lmsCourseDetail.fileInfo', { defaultValue: 'File Info' })}
                    </Button>
                  </div>
                  
                  {pptPreviewMode === 'native' ? (
                    <div className={styles.pptNativeContainer}>
                      {pptLoading ? (
                        <div className={styles.pptLoading}>
                          <div className={styles.pptLoadingSpinner}></div>
                          <p>{t('lmsCourseDetail.loadingPPT', { defaultValue: 'Loading PPT...' })}</p>
                        </div>
                      ) : pptFileBuffer ? (
                        <div ref={pptRef} className={styles.pptNativePreview}></div>
                      ) : (
                        <div className={styles.pptError}>
                          <p>{t('lmsCourseDetail.pptLoadError', { defaultValue: 'Failed to load PPT file.' })}</p>
                        </div>
                      )}
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
    </div>
  )
}

export default LmsCourseDetailStudent
