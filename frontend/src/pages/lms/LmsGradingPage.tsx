import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Clock, Star, FileText, User, BookOpen, Sparkles, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import styles from './LmsGradingPage.module.scss'

interface Submission {
  id: string
  assignmentId: string
  studentId: string
  assetId?: string
  content?: string
  asset?: {
    id: string
    fileName: string
    originalName?: string
    fileUrl: string
    mimeType?: string
    fileSizeBytes: number
  }
  aiRubricScores?: string
  aiGeneratedAt?: string
  finalMarks?: number
  gradedAt?: string
  student: {
    id: string
    studentId: string
    userId: string
    user: { displayName: string }
  }
  assignment: {
    id: string
    title: string
    maxMarks: number
    weightPct?: number
  }
  offering?: {
    id: string
    course: {
      code: string
      name: string
      creditHours: number
    }
  }
}

interface RubricScore {
  criterion: string
  ai_score: number
  ai_comment: string
  instructor_score?: number
  instructor_comment?: string
}

const LmsGradingPage: React.FC = () => {
  const { t } = useTranslation()
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null)
  const [rubricScores, setRubricScores] = useState<RubricScore[]>([])
  const [finalMarks, setFinalMarks] = useState<number>(0)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'graded' | 'all'>('pending')

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ['lms', 'submissions', 'lecturer', user?.id, statusFilter],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/submissions/lecturer/${user!.id}`, {
        params: { status: statusFilter === 'all' ? undefined : statusFilter }
      })
      return data.data
    },
    enabled: !!user,
  })

  // Separate query always fetching all submissions for accurate tab counts
  const { data: allSubmissions = [] } = useQuery<Submission[]>({
    queryKey: ['lms', 'submissions', 'lecturer', user?.id, 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/submissions/lecturer/${user!.id}`)
      return data.data
    },
    enabled: !!user,
  })

  const gradeMutation = useMutation({
    mutationFn: async ({ submissionId, instructorScores, finalMarks }: {
      submissionId: string
      instructorScores: RubricScore[]
      finalMarks: number
    }) => {
      const { data } = await apiClient.patch(`/lms/submissions/${submissionId}/grade`, {
        instructorScores,
        finalMarks,
      })
      return data
    },
    onSuccess: (data) => {
      addToast({
        type: 'success',
        message: `Grade confirmed! Student GPA updated to ${data.data.currentGpa.toFixed(2)}`,
      })
      setGradingSubmission(null)
      qc.invalidateQueries({ queryKey: ['lms', 'submissions', 'lecturer', user?.id] })
      qc.invalidateQueries({ queryKey: ['submissions', 'all'] })
      qc.invalidateQueries({ queryKey: ['submissions', 'history'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Grading failed' })
    },
  })

  const acceptAiMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const { data } = await apiClient.patch(`/lms/submissions/${submissionId}/accept-ai`)
      return data
    },
    onSuccess: (data) => {
      addToast({
        type: 'success',
        message: `AI scores accepted! Student GPA updated to ${data.data.currentGpa.toFixed(2)}`,
      })
      setGradingSubmission(null)
      qc.invalidateQueries({ queryKey: ['lms', 'submissions', 'lecturer', user?.id] })
      qc.invalidateQueries({ queryKey: ['submissions', 'all'] })
      qc.invalidateQueries({ queryKey: ['submissions', 'history'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Failed to accept AI scores' })
    },
  })

  const openGradingModal = (submission: Submission) => {
    setGradingSubmission(submission)
    try {
      const scores: RubricScore[] = submission.aiRubricScores
        ? JSON.parse(submission.aiRubricScores)
        : []
      setRubricScores(scores)
      const totalAiScore = scores.reduce((sum, s) => sum + s.ai_score, 0)
      const avgScore = scores.length > 0 ? totalAiScore / scores.length : 0
      setFinalMarks(Math.round(avgScore * 10))
    } catch {
      setRubricScores([])
      setFinalMarks(0)
    }
  }

  const updateRubricScore = (index: number, field: 'instructor_score' | 'instructor_comment', value: number | string) => {
    setRubricScores(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const acceptAllAiScores = () => {
    setRubricScores(prev => prev.map(s => ({ ...s, instructor_score: s.ai_score })))
    const totalScore = rubricScores.reduce((sum, s) => sum + s.ai_score, 0)
    const avgScore = rubricScores.length > 0 ? totalScore / rubricScores.length : 0
    setFinalMarks(Math.round(avgScore * 10))
  }

  const calculateFinalMarks = () => {
    const hasInstructorScores = rubricScores.some(s => s.instructor_score !== undefined)
    const scoresToUse = hasInstructorScores
      ? rubricScores.map(s => s.instructor_score ?? s.ai_score)
      : rubricScores.map(s => s.ai_score)
    const total = scoresToUse.reduce((sum, s) => sum + s, 0)
    const avg = scoresToUse.length > 0 ? total / scoresToUse.length : 0
    return Math.round(avg * 10)
  }

  const submitGrade = () => {
    if (!gradingSubmission) return
    gradeMutation.mutate({
      submissionId: gradingSubmission.id,
      instructorScores: rubricScores,
      finalMarks,
    })
  }

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
        <h1 className={styles.pageTitle}>
          <Star size={24} /> {t('lmsGrading.title', { defaultValue: 'Assignment Grading' })}
        </h1>
        <p className={styles.pageDesc}>
          {t('lmsGrading.desc', { defaultValue: 'Review AI-suggested scores and confirm student grades' })}
        </p>
      </div>

      <div className={styles.filterBar}>
        <button
          className={`${styles.filterBtn} ${statusFilter === 'pending' ? styles.active : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <Clock size={14} />
          {t('lmsGrading.pendingGrading')} ({allSubmissions.filter(s => s.finalMarks === undefined || s.finalMarks === null).length})
        </button>
        <button
          className={`${styles.filterBtn} ${statusFilter === 'graded' ? styles.active : ''}`}
          onClick={() => setStatusFilter('graded')}
        >
          <CheckCircle size={14} />
          {t('lmsGrading.graded')} ({allSubmissions.filter(s => s.finalMarks !== undefined && s.finalMarks !== null).length})
        </button>
        <button
          className={`${styles.filterBtn} ${statusFilter === 'all' ? styles.active : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <FileText size={14} />
          {t('lmsGrading.all')} ({allSubmissions.length})
        </button>
      </div>

      {submissions.length === 0 ? (
        <Card>
          <div className={styles.emptyState}>
            <CheckCircle size={48} />
            <h3>{t('lmsGrading.allGraded', { defaultValue: 'All caught up!' })}</h3>
            <p>{t('lmsGrading.noPending', { defaultValue: 'No submissions found.' })}</p>
          </div>
        </Card>
      ) : (
        <div className={styles.submissionList}>
          {submissions.map((submission: Submission) => (
            <Card key={submission.id} className={styles.submissionCard}>
              <div className={styles.submissionHeader}>
                <div className={styles.submissionInfo}>
                  <div className={styles.courseTag}>
                    <BookOpen size={14} />
                    {submission.offering?.course?.code ?? 'N/A'}
                  </div>
                  <h3 className={styles.assignmentTitle}>{submission.assignment.title}</h3>
                  <div className={styles.studentInfo}>
                    <User size={14} />
                    {submission.student.user.displayName}
                    <span className={styles.studentId}>({submission.student.studentId})</span>
                  </div>
                </div>
                <div className={styles.submissionMeta}>
                  {submission.finalMarks !== undefined && submission.finalMarks !== null ? (
                    <Badge color="green" size="sm">
                      <CheckCircle size={11} /> {t('lmsGrading.teacherGraded')}
                    </Badge>
                  ) : submission.aiRubricScores ? (
                    <Badge color="blue" size="sm">
                      <Sparkles size={11} /> {t('lmsGrading.aiGradedPending')}
                    </Badge>
                  ) : (
                    <Badge color="orange" size="sm">
                      <Clock size={11} /> {t('lmsGrading.pendingGradingBadge')}
                    </Badge>
                  )}
                  {submission.finalMarks !== undefined && submission.finalMarks !== null && (
                    <div className={styles.grade}>
                      {t('lmsGrading.grade')}: {submission.finalMarks}/100
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.aiPreview}>
                <div className={styles.aiHeader}>
                  <Sparkles size={14} />
                  AI Rubric Preview
                </div>
                {submission.aiRubricScores ? (
                  <div className={styles.aiScores}>
                    {(() => {
                      try {
                        const scores: RubricScore[] = JSON.parse(submission.aiRubricScores)
                        return scores.slice(0, 3).map((s, i) => (
                          <div key={i} className={styles.aiScoreItem}>
                            <span className={styles.criterion}>{s.criterion}</span>
                            <span className={styles.score}>{s.ai_score}/10</span>
                          </div>
                        ))
                      } catch {
                        return <span>No AI scores available</span>
                      }
                    })()}
                  </div>
                ) : (
                  <span className={styles.noAi}>No AI scores generated</span>
                )}
              </div>

              <div className={styles.submissionActions}>
                {submission.finalMarks === undefined && submission.aiRubricScores && (
                  <Button
                    variant="secondary"
                    onClick={() => acceptAiMutation.mutate(submission.id)}
                    disabled={acceptAiMutation.isPending}
                  >
                    <Sparkles size={14} /> {t('lmsGrading.acceptAiScore')}
                  </Button>
                )}
                <Button onClick={() => openGradingModal(submission)}>
                  <Star size={14} /> {submission.finalMarks !== undefined ? t('lmsGrading.viewGrade') : t('lmsGrading.gradeAction')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {gradingSubmission && (
        <Modal
          open
          title={`Grade: ${gradingSubmission.assignment.title}`}
          onClose={() => setGradingSubmission(null)}
          width={700}
          footer={
            <div className={styles.modalFooter}>
              <Button variant="ghost" onClick={() => setGradingSubmission(null)}>
                Cancel
              </Button>
              <Button onClick={acceptAllAiScores} variant="secondary">
                <Sparkles size={14} /> Accept All AI Scores
              </Button>
              <Button onClick={submitGrade} loading={gradeMutation.isPending}>
                <CheckCircle size={14} /> Confirm Grade
              </Button>
            </div>
          }
        >
          <div className={styles.gradingContent}>
            <div className={styles.studentSection}>
              <User size={16} />
              <span><strong>Student:</strong> {gradingSubmission.student.user.displayName}</span>
              <span className={styles.studentId}>({gradingSubmission.student.studentId})</span>
            </div>

            <div className={styles.submissionContentSection}>
              <h4>{t('lmsGrading.submissionContent', { defaultValue: 'Submission Content' })}</h4>
              {gradingSubmission.content && (
                <div className={styles.contentBox}>
                  <h5>{t('lmsGrading.textContent', { defaultValue: 'Text Content' })}</h5>
                  <div className={styles.textContent}>
                    {gradingSubmission.content}
                  </div>
                </div>
              )}
              {gradingSubmission.asset && (
                <div className={styles.attachmentBox}>
                  <h5>{t('lmsGrading.attachedFiles', { defaultValue: 'Attached Files' })}</h5>
                  {gradingSubmission.asset.mimeType && gradingSubmission.asset.mimeType.startsWith('image/') ? (
                    <div className={styles.imageAttachment}>
                      <img 
                        src={gradingSubmission.asset.fileUrl} 
                        alt={gradingSubmission.asset.originalName || gradingSubmission.asset.fileName}
                        className={styles.attachmentImage}
                        onClick={() => window.open(gradingSubmission.asset!.fileUrl, '_blank')}
                      />
                      <p className={styles.attachmentInfo}>
                        {gradingSubmission.asset.originalName || gradingSubmission.asset.fileName}
                        <span className={styles.fileSize}>
                          ({(gradingSubmission.asset.fileSizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className={styles.fileAttachment}>
                      <FileText size={20} />
                      <div className={styles.fileDetails}>
                        <span className={styles.fileName}>
                          {gradingSubmission.asset.originalName || gradingSubmission.asset.fileName}
                        </span>
                        <span className={styles.fileSize}>
                          {(gradingSubmission.asset.fileSizeBytes / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => window.open(gradingSubmission.asset!.fileUrl, '_blank')}
                      >
                        {t('lmsGrading.viewFile', { defaultValue: 'View' })}
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {!gradingSubmission.content && !gradingSubmission.asset && (
                <div className={styles.noContent}>
                  <AlertCircle size={16} />
                  {t('lmsGrading.noSubmissionContent', { defaultValue: 'No submission content available' })}
                </div>
              )}
            </div>

            <div className={styles.rubricSection}>
              <h4>Rubric Assessment</h4>
              <div className={styles.rubricTable}>
                <div className={styles.rubricHeader}>
                  <span className={styles.colCriterion}>Criterion</span>
                  <span className={styles.colAiScore}>AI Score</span>
                  <span className={styles.colAiComment}>AI Comment</span>
                  <span className={styles.colInstrScore}>Your Score</span>
                </div>
                {rubricScores.map((score, index) => (
                  <div key={index} className={styles.rubricRow}>
                    <span className={styles.colCriterion}>{score.criterion}</span>
                    <span className={styles.colAiScore}>
                      <Badge color="blue" size="sm">{score.ai_score}/10</Badge>
                    </span>
                    <span className={styles.colAiComment}>{score.ai_comment}</span>
                    <span className={styles.colInstrScore}>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={score.instructor_score ?? score.ai_score}
                        onChange={e => updateRubricScore(index, 'instructor_score', Number(e.target.value))}
                        className={styles.scoreInput}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.finalMarksSection}>
              <div className={styles.finalMarksInput}>
                <label>Final Score (0–100):</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={finalMarks}
                  onChange={e => setFinalMarks(Number(e.target.value))}
                  className={styles.marksInput}
                />
              </div>
              <div className={styles.marksPreview}>
                <AlertCircle size={14} />
                Calculated from rubric: {calculateFinalMarks()} / 100
              </div>
            </div>

            <div className={styles.gradePreview}>
              <h4>Grade Preview</h4>
              <div className={styles.gradeScale}>
                <span className={finalMarks >= 90 ? styles.gradeActive : ''}>A+ (90-100)</span>
                <span className={finalMarks >= 80 && finalMarks < 90 ? styles.gradeActive : ''}>A (80-89)</span>
                <span className={finalMarks >= 75 && finalMarks < 80 ? styles.gradeActive : ''}>B+ (75-79)</span>
                <span className={finalMarks >= 70 && finalMarks < 75 ? styles.gradeActive : ''}>B (70-74)</span>
                <span className={finalMarks >= 65 && finalMarks < 70 ? styles.gradeActive : ''}>C+ (65-69)</span>
                <span className={finalMarks >= 60 && finalMarks < 65 ? styles.gradeActive : ''}>C (60-64)</span>
                <span className={finalMarks >= 50 && finalMarks < 60 ? styles.gradeActive : ''}>D (50-59)</span>
                <span className={finalMarks < 50 ? styles.gradeActive : ''}>F (&lt;50)</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default LmsGradingPage
