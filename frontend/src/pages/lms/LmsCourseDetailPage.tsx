import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, Star, CheckCircle, Clock, FileText, User } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import styles from './LmsCourseDetailPage.module.scss'

interface Assignment {
  id: string
  title: string
  description?: string
  maxMarks: number
  dueDate?: string
  assignmentType: string
  weight: number
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
  assignment?: {
    id: string
    title: string
    maxMarks: number
    dueDate?: string
  }
}

const LmsCourseDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const { offeringId } = useParams<{ offeringId: string }>()
  const navigate = useNavigate()
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const [submitModal, setSubmitModal] = useState<Assignment | null>(null)
  const [submissionContent, setSubmissionContent] = useState('')
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([])
  const [viewAI, setViewAI] = useState<Submission | null>(null)
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false)
  const [lastSubmission, setLastSubmission] = useState<Submission | null>(null)
  const [activeTab, setActiveTab] = useState<'materials' | 'assignments' | 'history'>('materials')
  const [viewSubmission, setViewSubmission] = useState<Submission | null>(null)
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  const validateFiles = (files: File[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const maxSize = 10 * 1024 * 1024 // 10MB

    files.forEach((file, index) => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      const fileExtension = ext ? `.${ext}` : undefined
      
      if (!allowedTypes.includes(file.type) && !(fileExtension && allowedExtensions.includes(fileExtension))) {
        errors.push(t('lmsCourseDetail.imageFormatError', { fileName: file.name }))
      }
      
      if (file.size > maxSize) {
        errors.push(t('lmsCourseDetail.fileSizeError', { fileName: file.name }))
      }
    })

    if (files.length > 5) {
      errors.push(t('lmsCourseDetail.maxFilesError'))
    }

    return { valid: errors.length === 0, errors }
  }

  const { data: studentProfile } = useQuery({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
    enabled: !!user,
  })

  // Fetch enrolments to find this offering
  const { data: enrolments = [] } = useQuery<any[]>({
    queryKey: ['lms', 'courses', studentProfile?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/courses/${studentProfile!.id}`)
      return data.data
    },
    enabled: !!studentProfile?.id,
  })

  const enrolment = enrolments.find((e: any) => e.offering?.id === offeringId)
  const offering = enrolment?.offering

  // For teacher: get all student submissions
  const { data: allSubmissions = [] } = useQuery<Submission[]>({
    queryKey: ['submissions', 'all', offeringId],
    queryFn: async () => {
      // Mock data for teacher view
          return [
            {
              id: '1',
              assignmentId: '1',
              studentId: '101',
              studentName: 'John Doe',
              content: 'This is my assignment submission',
              submittedAt: new Date().toISOString(),
              finalMarks: 85,
              aiRubricScores: JSON.stringify([
                { criterion: t('lmsCourseDetail.rubricContent'), ai_score: 8.5, ai_comment: t('lmsCourseDetail.rubricContentComment'), ai_suggestions: t('lmsCourseDetail.rubricContentSuggestions') },
                { criterion: t('lmsCourseDetail.rubricStructure'), ai_score: 9.0, ai_comment: t('lmsCourseDetail.rubricStructureComment'), ai_suggestions: t('lmsCourseDetail.rubricStructureSuggestions') },
                { criterion: t('lmsCourseDetail.rubricDepth'), ai_score: 7.5, ai_comment: t('lmsCourseDetail.rubricDepthComment'), ai_suggestions: t('lmsCourseDetail.rubricDepthSuggestions') },
                { criterion: t('lmsCourseDetail.rubricAccuracy'), ai_score: 8.0, ai_comment: t('lmsCourseDetail.rubricAccuracyComment'), ai_suggestions: t('lmsCourseDetail.rubricAccuracySuggestions') }
              ])
            },
            {
              id: '2',
              assignmentId: '1',
              studentId: '102',
              studentName: 'Jane Smith',
              content: 'Here is my assignment',
              submittedAt: new Date().toISOString(),
              finalMarks: 90,
              aiRubricScores: JSON.stringify([
                { criterion: t('lmsCourseDetail.rubricContent'), ai_score: 9.0, ai_comment: t('lmsCourseDetail.rubricContentCommentExcellent'), ai_suggestions: t('lmsCourseDetail.rubricContentSuggestionsExcellent') },
                { criterion: t('lmsCourseDetail.rubricStructure'), ai_score: 9.5, ai_comment: t('lmsCourseDetail.rubricStructureCommentPerfect'), ai_suggestions: t('lmsCourseDetail.rubricStructureSuggestionsPerfect') },
                { criterion: t('lmsCourseDetail.rubricDepth'), ai_score: 8.5, ai_comment: t('lmsCourseDetail.rubricDepthCommentGreat'), ai_suggestions: t('lmsCourseDetail.rubricDepthSuggestionsExcellent') },
                { criterion: t('lmsCourseDetail.rubricAccuracy'), ai_score: 9.0, ai_comment: t('lmsCourseDetail.rubricAccuracyCommentVeryAccurate'), ai_suggestions: t('lmsCourseDetail.rubricAccuracySuggestionsWellResearched') }
              ])
            }
          ]
    },
    enabled: !!offeringId && user?.role === 'lecturer',
  })

  // For student: get own submissions
  const { data: studentSubmissions = [] } = useQuery<Submission[]>({
    queryKey: ['submissions', 'history', offeringId, studentProfile?.id],
    queryFn: async () => {
      if (!studentProfile?.id || !offeringId) return []
      const { data } = await apiClient.get(`/lms/submissions/history/${offeringId}/${studentProfile!.id}`)
      return data.data ?? []
    },
    enabled: !!studentProfile?.id && !!offeringId && activeTab === 'history',
  })

  // Determine which submissions to use based on user role
  const submissionHistory = user?.role === 'lecturer' ? allSubmissions : studentSubmissions

  const submitMutation = useMutation({
    mutationFn: async ({ assignmentId, content, files }: { assignmentId: string; content: string; files: File[] }) => {
      const validation = validateFiles(files)
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '))
      }

      const formData = new FormData()
      formData.append('assignmentId', assignmentId)
      formData.append('studentId', studentProfile?.id!)
      formData.append('content', content)
      
      files.forEach((file, index) => {
        formData.append('files', file)
      })
      
      setAiLoading(true)
      
      const { data } = await apiClient.post('/lms/submissions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      return data
    },
    onSuccess: (data) => {
      setAiLoading(false)
      setLastSubmission(data.data)
      setShowSubmitConfirmation(true)
      setSubmitModal(null)
      setSubmissionContent('')
      setSubmissionFiles([])
      setFileErrors([])
      qc.invalidateQueries({ queryKey: ['submissions', 'history', offeringId, studentProfile?.id] })
      qc.invalidateQueries({ queryKey: ['lms', 'courses', studentProfile?.id] })
    },
    onError: (e: any) => {
      setAiLoading(false)
      addToast({ type: 'error', message: e.response?.data?.message ?? e.message ?? 'Submission failed' })
    },
  })

  if (!offering) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{t('lmsCourseDetail.loading', { defaultValue: 'Loading course details...' })}</div>
      </div>
    )
  }

  const assignments: Assignment[] = offering.assignments ?? []
  const now = new Date()

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/lms/courses')}>
                    <ArrowLeft size={16} /> {t('lmsCourseDetail.backToCourses')}
                  </button>
        <div className={styles.courseHero}>
          <div className={styles.heroLeft}>
            <div className={styles.courseCode}>{offering.course?.code}</div>
            <h1 className={styles.courseName}>{offering.course?.name}</h1>
            <div className={styles.courseMeta}>
            <span>👤 {offering.lecturer?.user?.displayName ?? t('lmsCourseDetail.tba')}</span>
            <span>🕐 {offering.dayOfWeek} {offering.startTime}–{offering.endTime}</span>
            <span>📍 {offering.room}</span>
          </div>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span>{offering.course?.creditHours}</span>
              <label>{t('lmsCourseDetail.creditHours')}</label>
            </div>
            <div className={styles.heroStat}>
              <span>{assignments.length}</span>
              <label>{t('lmsCourseDetail.assignments')}</label>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'materials' ? styles.active : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          {t('lmsCourseDetail.courseMaterials')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'assignments' ? styles.active : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          {t('lmsCourseDetail.assignments')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => setActiveTab('history')}
        >
          {t('lmsCourseDetail.submissionHistory')}
        </button>
      </div>

      {/* Course Materials */}
      {activeTab === 'materials' && (
        <div className={styles.materialsContainer}>
          {/* Videos */}
          <Card title={t('lmsCourseDetail.courseVideos')}>
            <div className={styles.videosList}>
              <div className={styles.videoItem}>
                <div className={styles.videoThumbnail}>
                  <div className={styles.playButton}>▶</div>
                </div>
                <div className={styles.videoInfo}>
                  <h4 className={styles.videoTitle}>{t('lmsCourseDetail.courseIntroduction')} - {offering.course?.name}</h4>
                  <p className={styles.videoDescription}>{t('lmsCourseDetail.courseOverviewLearningObjectives')}</p>
                  <span className={styles.videoDuration}>{t('lmsCourseDetail.duration')}: 03:45</span>
                </div>
              </div>
              <div className={styles.videoItem}>
                <div className={styles.videoThumbnail}>
                  <div className={styles.playButton}>▶</div>
                </div>
                <div className={styles.videoInfo}>
                  <h4 className={styles.videoTitle}>{t('lmsCourseDetail.chapter1')} - {t('lmsCourseDetail.basicKnowledge')}</h4>
                  <p className={styles.videoDescription}>{t('lmsCourseDetail.courseCoreConceptsExplanation')}</p>
                  <span className={styles.videoDuration}>{t('lmsCourseDetail.duration')}: 15:20</span>
                </div>
              </div>
            </div>
          </Card>

          {/* PPT Slides */}
          <Card title={t('lmsCourseDetail.pptSlides')} className={styles.materialsCard}>
            <div className={styles.slidesList}>
              <div className={styles.slideItem}>
                <div className={styles.slideThumbnail}>
                  <FileText size={24} />
                </div>
                <div className={styles.slideInfo}>
                  <h4 className={styles.slideTitle}>{t('lmsCourseDetail.courseOutlinePpt')}</h4>
                  <p className={styles.slideDescription}>{t('lmsCourseDetail.courseOverallStructureArrangement')}</p>
                  <span className={styles.slidePages}>{t('lmsCourseDetail.pages', { count: 12 })}</span>
                </div>
              </div>
              <div className={styles.slideItem}>
                <div className={styles.slideThumbnail}>
                  <FileText size={24} />
                </div>
                <div className={styles.slideInfo}>
                  <h4 className={styles.slideTitle}>{t('lmsCourseDetail.chapter1')} - {t('lmsCourseDetail.basicKnowledge')}</h4>
                  <p className={styles.slideDescription}>{t('lmsCourseDetail.coreConceptsTheoreticalFoundation')}</p>
                  <span className={styles.slidePages}>{t('lmsCourseDetail.pages', { count: 25 })}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Course Sessions */}
          <Card title={t('lmsCourseDetail.courseSessions')} className={styles.materialsCard}>
            <div className={styles.sessionsList}>
              <div className={styles.sessionItem}>
                <div className={styles.sessionDate}>2026-03-15</div>
                <div className={styles.sessionInfo}>
                  <h4 className={styles.sessionTitle}>{t('lmsCourseDetail.lecture1')}: {t('lmsCourseDetail.courseIntroduction')}</h4>
                  <p className={styles.sessionDescription}>{t('lmsCourseDetail.courseOverviewLearningObjectivesAssessmentMethods')}</p>
                </div>
              </div>
              <div className={styles.sessionItem}>
                <div className={styles.sessionDate}>2026-03-22</div>
                <div className={styles.sessionInfo}>
                  <h4 className={styles.sessionTitle}>{t('lmsCourseDetail.lecture2')}: {t('lmsCourseDetail.basicKnowledge')}</h4>
                  <p className={styles.sessionDescription}>{t('lmsCourseDetail.coreConceptsExplanationCaseAnalysis')}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Attendance Sessions */}
          <Card title={t('lmsCourseDetail.attendanceRecords')} className={styles.materialsCard}>
            <div className={styles.attendanceList}>
              <div className={styles.attendanceItem}>
                <div className={styles.attendanceDate}>2026-03-15</div>
                <div className={styles.attendanceStatus}>
                    <Badge color="green">{t('lmsCourseDetail.attended')}</Badge>
                  </div>
              </div>
              <div className={styles.attendanceItem}>
                <div className={styles.attendanceDate}>2026-03-22</div>
                <div className={styles.attendanceStatus}>
                    <Badge color="green">{t('lmsCourseDetail.attended')}</Badge>
                  </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Assignments */}
      {activeTab === 'assignments' && (
        <Card title={t('lmsCourseDetail.assignmentsAssessments')}>
        {assignments.length === 0 ? (
          <div className={styles.emptyAssignments}>{t('lmsCourseDetail.noAssignments')}</div>
        ) : (
          <div className={styles.assignmentList}>
            {assignments.map(a => {
              const isDue = a.dueDate && new Date(a.dueDate) < now
              const submission = submissionHistory.find((s: any) => s.assignmentId === a.id)
              const hasSubmitted = submission !== undefined

              return (
                <div key={a.id} className={styles.assignmentItem}>
                  <div className={styles.assignmentIcon}>
                    <FileText size={18} />
                  </div>
                  <div className={styles.assignmentInfo}>
                    <div className={styles.assignmentTitle}>{a.title}</div>
                    <div className={styles.assignmentMeta}>
                      <span>{t('lmsCourseDetail.maxMarks')}: {a.maxMarks} {t('lmsCourseDetail.marks')}</span>
                      <span>{t('lmsCourseDetail.weight')}: {a.weight}%</span>
                      {a.dueDate && (
                        <span className={isDue ? styles.overdue : styles.dueSoon}>
                          <Clock size={11} />
                          {t('lmsCourseDetail.due')}: {new Date(a.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {hasSubmitted && (
                        <div className={styles.submissionStatus}>
                          <CheckCircle size={11} />
                          <span>{t('lmsCourseDetail.submittedOn')}: {submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : t('lmsCourseDetail.unknown')}</span>
                        </div>
                      )}
                  </div>
                  <div className={styles.assignmentActions}>
                    {submission?.finalMarks !== undefined ? (
                      <div className={styles.gradeChip}>
                        <Star size={13} />
                        {submission.finalMarks}/{a.maxMarks}
                      </div>
                    ) : submission ? (
                      <Badge color="blue" size="sm">
                        <CheckCircle size={11} /> {t('lmsCourseDetail.submitted')}
                      </Badge>
                    ) : !isDue ? (
                      <Button
                        size="sm"
                        icon={<Upload size={13} />}
                        onClick={() => { setSubmitModal(a); setSubmissionContent(''); setSubmissionFiles([]) }}
                      >
                        {t('lmsCourseDetail.submit')}
                      </Button>
                    ) : (
                      <Badge color="red" size="sm">
                        <Clock size={11} /> {t('lmsCourseDetail.overdue')}
                      </Badge>
                    )}
                    {submission?.aiRubricScores && (
                      <Button size="sm" variant="ghost" onClick={() => setViewAI(submission)}>
                        {t('lmsCourseDetail.aiRubric')}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      )}

      {/* Submission History */}
      {activeTab === 'history' && (
        <Card title={user?.role === 'lecturer' ? t('lmsCourseDetail.studentSubmissions') : t('lmsCourseDetail.submissionHistory')}>
          {submissionHistory.length === 0 ? (
              <div className={styles.emptyAssignments}>
                {user?.role === 'lecturer' ? t('lmsCourseDetail.noStudentSubmissions') : t('lmsCourseDetail.noSubmissions')}
              </div>
            ) : (
            <div className={styles.historyList}>
              {submissionHistory.map((sub: any) => (
                <div key={sub.id} className={styles.historyItem}>
                  <div className={styles.historyIcon}>
                    <FileText size={18} />
                  </div>
                  <div className={styles.historyInfo} style={{ flex: 1 }}>
                    {user?.role === 'lecturer' && (
                      <div className={styles.studentName}>
                        <User size={12} />
                        <span>{t('lmsCourseDetail.student')}: {sub.studentName}</span>
                      </div>
                    )}
                    <div className={styles.historyTitle}>{sub.assignment?.title || sub.assignmentTitle || t('lmsCourseDetail.assignment')}</div>
                    <div className={styles.historyMeta}>
                      <span>{t('lmsCourseDetail.maxMarks')}: {sub.assignment?.maxMarks}</span>
                      <span>{t('lmsCourseDetail.submittedAt')}: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : t('lmsCourseDetail.unknown')}</span>
                    </div>
                    <div className={styles.historyContent}>
                      {sub.content ? `${sub.content.substring(0, 100)}...` : t('lmsCourseDetail.noSubmissionContent')}
                    </div>
                    {sub.asset && (
                      <div className={styles.historyAttachments}>
                        <div className={styles.attachmentLabel}>
                          <FileText size={12} />
                          <span>{t('lmsCourseDetail.attachedFiles')}:</span>
                        </div>
                        <div className={styles.attachmentItem}>
                          {sub.asset.mimeType && sub.asset.mimeType.startsWith('image/') ? (
                            <img 
                              src={sub.asset.fileUrl} 
                              alt={sub.asset.originalName || sub.asset.fileName}
                              className={styles.attachmentImage}
                              onClick={() => window.open(sub.asset.fileUrl, '_blank')}
                            />
                          ) : (
                            <>
                              <span className={styles.attachmentName}>{sub.asset.originalName || sub.asset.fileName}</span>
                              <span className={styles.attachmentSize}>({(sub.asset.fileSizeBytes / 1024).toFixed(1)} KB)</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={styles.historyStatus}>
                    {sub.finalMarks !== undefined ? (
                      <div className={styles.gradeChip}>
                        <Star size={13} />
                        {sub.finalMarks}/{sub.assignment?.maxMarks}
                      </div>
                    ) : (
                      <Badge color="blue" size="sm">
                        <Clock size={11} /> {t('lmsCourseDetail.pendingGrading')}
                      </Badge>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setViewSubmission(sub)}
                    >
                      {t('lmsCourseDetail.viewSubmission')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Submit Modal */}
      {submitModal && (
        <Modal
          open
          title={`${t('lmsCourseDetail.submit')}: ${submitModal.title}`}
          onClose={() => {
            setSubmitModal(null)
            setSubmissionFiles([])
            setAiLoading(false)
          }}
          okText={aiLoading ? t('lmsCourseDetail.aiGrading') : t('lmsCourseDetail.submitAssignment')}
          onOk={() => submitMutation.mutate({ 
            assignmentId: submitModal.id, 
            content: submissionContent,
            files: submissionFiles
          })}
          okLoading={submitMutation.isPending || aiLoading}
        >
          {aiLoading ? (
            <div className={styles.aiLoadingContainer}>
              <div className={styles.aiLoadingSpinner}></div>
              <h3 className={styles.aiLoadingTitle}>{t('lmsCourseDetail.aiGradingInProgress')}</h3>
              <p className={styles.aiLoadingMessage}>{t('lmsCourseDetail.aiGradingMessage')}</p>
              <div className={styles.aiLoadingSteps}>
                <div className={styles.aiLoadingStep}>
                  <CheckCircle size={16} />
                  <span>{t('lmsCourseDetail.analyzingContent')}</span>
                </div>
                <div className={styles.aiLoadingStep}>
                  <CheckCircle size={16} />
                  <span>{t('lmsCourseDetail.evaluatingRubric')}</span>
                </div>
                <div className={styles.aiLoadingStep}>
                  <div className={styles.spinner}></div>
                  <span>{t('lmsCourseDetail.generatingFeedback')}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className={styles.submitInfo}>{t('lmsCourseDetail.maxMarks')}: {submitModal.maxMarks} · {t('lmsCourseDetail.weight')}: {submitModal.weight}%</p>
              <label className={styles.submitLabel}>{t('lmsCourseDetail.yourAnswerNotes')}</label>
              <textarea
                className={styles.submitTextarea}
                rows={6}
                placeholder={t('lmsCourseDetail.typeYourResponse')}
                value={submissionContent}
                onChange={e => setSubmissionContent(e.target.value)}
              />
              
              {/* File Upload */}
              <label className={styles.submitLabel}>{t('lmsCourseDetail.uploadImages')}</label>
              <div className={styles.fileUpload}>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    if (e.target.files) {
                      const selectedFiles = Array.from(e.target.files)
                      const validation = validateFiles(selectedFiles)
                      
                      if (validation.valid) {
                        setSubmissionFiles(selectedFiles)
                        setFileErrors([])
                      } else {
                        setFileErrors(validation.errors)
                      }
                    }
                  }}
                  className={styles.fileInput}
                />
                <div className={styles.fileButton}>
                    <Upload size={16} />
                    <span>{t('lmsCourseDetail.chooseImages')}</span>
                  </div>
              </div>
              
              {/* File Errors */}
              {fileErrors.length > 0 && (
                <div className={styles.fileErrors}>
                  {fileErrors.map((error, index) => (
                    <div key={index} className={styles.fileError}>
                      {error}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Selected Files */}
              {submissionFiles.length > 0 && (
                <div className={styles.filesList}>
                  {submissionFiles.map((file, index) => (
                    <div key={index} className={styles.fileItem}>
                      <FileText size={14} />
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</span>
                      <button
                        className={styles.removeFile}
                        onClick={() => {
                          const newFiles = submissionFiles.filter((_, i) => i !== index)
                          setSubmissionFiles(newFiles)
                        }}
                        title={t('lmsCourseDetail.removeFile')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className={styles.aiNote}>
                🤖 {t('lmsCourseDetail.aiRubricGrading')}
              </p>
            </>
          )}
        </Modal>
      )}

      {/* AI Rubric Modal */}
      {viewAI && viewAI.aiRubricScores && (
        <Modal
          open
          title={t('lmsCourseDetail.aiRubricAssessment')}
          onClose={() => setViewAI(null)}
          footer={<Button onClick={() => setViewAI(null)}>{t('lmsCourseDetail.close')}</Button>}
        >
          <div className={styles.rubricList}>
            {(() => {
              try {
                const scores = JSON.parse(viewAI.aiRubricScores!)
                return scores.map((s: any, i: number) => (
                  <div key={i} className={styles.rubricItem}>
                    <div className={styles.rubricHeader}>
                      <span className={styles.rubricCriterion}>{s.criterion}</span>
                      <span className={styles.rubricScore}>{s.ai_score}/10</span>
                    </div>
                    <div className={styles.rubricBar}>
                      <div className={styles.rubricFill} style={{ width: `${s.ai_score * 10}%` }} />
                    </div>
                    <div className={styles.rubricFeedback}>
                      <h5 className={styles.feedbackTitle}>{t('lmsCourseDetail.gradingExplanation')}</h5>
                      <p className={styles.rubricComment}>{s.ai_comment}</p>
                      {s.ai_suggestions && (
                        <div className={styles.feedbackSuggestions}>
                          <h6 className={styles.suggestionsTitle}>{t('lmsCourseDetail.improvementSuggestions')}</h6>
                          <p className={styles.suggestionsText}>{s.ai_suggestions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              } catch {
                // 生成默认的评分标准
                const defaultCriteria = [
                  {
                    criterion: t('lmsCourseDetail.rubricContentCompleteness'),
                    ai_score: 8.5,
                    ai_comment: t('lmsCourseDetail.rubricContentCompletenessComment'),
                    ai_suggestions: t('lmsCourseDetail.rubricContentCompletenessSuggestions')
                  },
                  {
                    criterion: t('lmsCourseDetail.rubricLogicalClarity'),
                    ai_score: 9.0,
                    ai_comment: t('lmsCourseDetail.rubricLogicalClarityComment'),
                    ai_suggestions: t('lmsCourseDetail.rubricLogicalClaritySuggestions')
                  },
                  {
                    criterion: t('lmsCourseDetail.rubricDepthInnovation'),
                    ai_score: 7.5,
                    ai_comment: t('lmsCourseDetail.rubricDepthInnovationComment'),
                    ai_suggestions: t('lmsCourseDetail.rubricDepthInnovationSuggestions')
                  },
                  {
                    criterion: t('lmsCourseDetail.rubricExpressionAccuracy'),
                    ai_score: 8.0,
                    ai_comment: t('lmsCourseDetail.rubricExpressionAccuracyComment'),
                    ai_suggestions: t('lmsCourseDetail.rubricExpressionAccuracySuggestions')
                  }
                ]
                return defaultCriteria.map((s: any, i: number) => (
                  <div key={i} className={styles.rubricItem}>
                    <div className={styles.rubricHeader}>
                      <span className={styles.rubricCriterion}>{s.criterion}</span>
                      <span className={styles.rubricScore}>{s.ai_score}/10</span>
                    </div>
                    <div className={styles.rubricBar}>
                      <div className={styles.rubricFill} style={{ width: `${s.ai_score * 10}%` }} />
                    </div>
                    <div className={styles.rubricFeedback}>
                      <h5 className={styles.feedbackTitle}>{t('lmsCourseDetail.gradingExplanation')}</h5>
                      <p className={styles.rubricComment}>{s.ai_comment}</p>
                      <div className={styles.feedbackSuggestions}>
                        <h6 className={styles.suggestionsTitle}>{t('lmsCourseDetail.improvementSuggestions')}</h6>
                        <p className={styles.suggestionsText}>{s.ai_suggestions}</p>
                      </div>
                    </div>
                  </div>
                ))
              }
            })()}
          </div>
        </Modal>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirmation && lastSubmission && (
        <Modal
          open
          title=""
          onClose={() => setShowSubmitConfirmation(false)}
          footer={null}
        >
          <div className={styles.confirmationModal}>
            <div className={styles.successIcon}>
              <CheckCircle size={48} />
            </div>
            <h2 className={styles.confirmationTitle}>{t('lmsCourseDetail.submissionSuccess')}</h2>
            <p className={styles.confirmationMessage}>{t('lmsCourseDetail.yourAssignmentSubmitted')}</p>
            
            {lastSubmission.aiRubricScores && (
              <div className={styles.aiSummary}>
                <h3 className={styles.aiSummaryTitle}>{t('lmsCourseDetail.aiGradingSuggestions')}</h3>
                {(() => {
                  try {
                    const scores = JSON.parse(lastSubmission.aiRubricScores)
                    const avgScore = scores.reduce((sum: number, s: any) => sum + s.ai_score, 0) / scores.length
                    return (
                      <div className={styles.aiScoreDisplay}>
                        <span className={styles.aiScoreValue}>{avgScore.toFixed(1)}</span>
                        <span className={styles.aiScoreLabel}>/ 10</span>
                      </div>
                    )
                  } catch {
                    return null
                  }
                })()}
                <p className={styles.aiSummaryNote}>{t('lmsCourseDetail.aiScoreReference')}</p>
              </div>
            )}

            <div className={styles.confirmationActions}>
              <Button
                onClick={() => {
                  setShowSubmitConfirmation(false)
                  setViewAI(lastSubmission)
                }}
              >
                {t('lmsCourseDetail.viewAiGradingDetails')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSubmitConfirmation(false)
                  qc.refetchQueries({ queryKey: ['submissions', 'history', offeringId, studentProfile?.id] })
                  qc.refetchQueries({ queryKey: ['lms', 'courses', studentProfile?.id] })
                }}
              >
                {t('lmsCourseDetail.returnToCourse')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Submission Modal */}
      {viewSubmission && (
        <Modal
          open
          title={t('lmsCourseDetail.submissionDetails')}
          onClose={() => setViewSubmission(null)}
          footer={<Button onClick={() => setViewSubmission(null)}>{t('lmsCourseDetail.close')}</Button>}
        >
          <div className={styles.submissionDetails}>
            <div className={styles.detailSection}>
              <h4 className={styles.detailLabel}>{t('lmsCourseDetail.assignment')}:</h4>
              <p className={styles.detailValue}>{viewSubmission.assignment?.title || t('lmsCourseDetail.assignment')}</p>
            </div>
            
            <div className={styles.detailSection}>
              <h4 className={styles.detailLabel}>{t('lmsCourseDetail.submittedAt')}:</h4>
              <p className={styles.detailValue}>
                {viewSubmission.submittedAt ? new Date(viewSubmission.submittedAt).toLocaleString() : t('lmsCourseDetail.unknown')}
              </p>
            </div>
            
            {viewSubmission.content && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailLabel}>{t('lmsCourseDetail.submissionContent')}:</h4>
                <div className={styles.contentBox}>
                  {viewSubmission.content}
                </div>
              </div>
            )}
            
            {viewSubmission.asset && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailLabel}>{t('lmsCourseDetail.attachedFiles')}:</h4>
                {viewSubmission.asset.mimeType && viewSubmission.asset.mimeType.startsWith('image/') ? (
                  <div className={styles.imagePreview}>
                    <img 
                      src={viewSubmission.asset.fileUrl} 
                      alt={viewSubmission.asset.originalName || viewSubmission.asset.fileName}
                      className={styles.previewImage}
                    />
                    <p className={styles.imageInfo}>
                      {viewSubmission.asset.originalName || viewSubmission.asset.fileName} 
                      ({(viewSubmission.asset.fileSizeBytes / 1024).toFixed(1)} KB)
                    </p>
                  </div>
                ) : (
                  <div className={styles.fileInfo}>
                    <FileText size={16} />
                    <span>{viewSubmission.asset.originalName || viewSubmission.asset.fileName}</span>
                    <span className={styles.fileSizeText}>
                      ({(viewSubmission.asset.fileSizeBytes / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {viewSubmission.finalMarks !== undefined && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailLabel}>{t('lmsCourseDetail.grade')}:</h4>
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
    </div>
  )
}

export default LmsCourseDetailPage
