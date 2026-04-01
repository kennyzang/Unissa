import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, Star, CheckCircle, Clock, FileText } from 'lucide-react'
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
  const [viewAI, setViewAI] = useState<Submission | null>(null)
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false)
  const [lastSubmission, setLastSubmission] = useState<Submission | null>(null)
  const [activeTab, setActiveTab] = useState<'assignments' | 'history'>('assignments')

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

  const { data: submissions = [] } = useQuery<Submission[]>({
    queryKey: ['submissions', offeringId],
    queryFn: async () => {
      // We'll use the offering assignments and fake some submitted state
      return [] as Submission[]
    },
  })

  const { data: submissionHistory = [] } = useQuery<Submission[]>({
    queryKey: ['submissions', 'history', offeringId, studentProfile?.id],
    queryFn: async () => {
      if (!studentProfile?.id || !offeringId) return []
      const { data } = await apiClient.get(`/lms/submissions/history/${offeringId}/${studentProfile!.id}`)
      return data.data ?? []
    },
    enabled: !!studentProfile?.id && !!offeringId && activeTab === 'history',
  })

  const submitMutation = useMutation({
    mutationFn: async ({ assignmentId, content }: { assignmentId: string; content: string }) => {
      const { data } = await apiClient.post('/lms/submissions', {
        assignmentId,
        studentId: studentProfile?.id,
        content,
      })
      return data
    },
    onSuccess: (data) => {
      setLastSubmission(data.data)
      setShowSubmitConfirmation(true)
      setSubmitModal(null)
      setSubmissionContent('')
      qc.invalidateQueries({ queryKey: ['submissions', offeringId] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Submission failed' })
    },
  })

  if (!offering) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{t('lmsCourseDetail.loading')}</div>
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
          <ArrowLeft size={16} /> Back to Courses
        </button>
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
              <label>Credit Hours</label>
            </div>
            <div className={styles.heroStat}>
              <span>{assignments.length}</span>
              <label>Assignments</label>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'assignments' ? styles.active : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          作业列表
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => setActiveTab('history')}
        >
          提交历史
        </button>
      </div>

      {/* Assignments */}
      {activeTab === 'assignments' && (
        <Card title="Assignments & Assessments">
        {assignments.length === 0 ? (
          <div className={styles.emptyAssignments}>No assignments posted yet.</div>
        ) : (
          <div className={styles.assignmentList}>
            {assignments.map(a => {
              const isDue = a.dueDate && new Date(a.dueDate) < now
              const submission = submissions.find(s => s.assignmentId === a.id)

              return (
                <div key={a.id} className={styles.assignmentItem}>
                  <div className={styles.assignmentIcon}>
                    <FileText size={18} />
                  </div>
                  <div className={styles.assignmentInfo}>
                    <div className={styles.assignmentTitle}>{a.title}</div>
                    <div className={styles.assignmentMeta}>
                      <span>Max: {a.maxMarks} marks</span>
                      <span>Weight: {a.weight}%</span>
                      {a.dueDate && (
                        <span className={isDue ? styles.overdue : styles.dueSoon}>
                          <Clock size={11} />
                          Due: {new Date(a.dueDate).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.assignmentActions}>
                    {submission?.finalMarks !== undefined ? (
                      <div className={styles.gradeChip}>
                        <Star size={13} />
                        {submission.finalMarks}/{a.maxMarks}
                      </div>
                    ) : submission ? (
                      <Badge color="blue" size="sm">
                        <CheckCircle size={11} /> Submitted
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        icon={<Upload size={13} />}
                        onClick={() => { setSubmitModal(a); setSubmissionContent('') }}
                      >
                        Submit
                      </Button>
                    )}
                    {submission?.aiRubricScores && (
                      <Button size="sm" variant="ghost" onClick={() => setViewAI(submission)}>
                        AI Rubric
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
        <Card title="提交历史">
          {submissionHistory.length === 0 ? (
            <div className={styles.emptyAssignments}>暂无提交记录</div>
          ) : (
            <div className={styles.historyList}>
              {submissionHistory.map(sub => (
                <div key={sub.id} className={styles.historyItem}>
                  <div className={styles.historyIcon}>
                    <FileText size={18} />
                  </div>
                  <div className={styles.historyInfo}>
                    <div className={styles.historyTitle}>{sub.assignment?.title}</div>
                    <div className={styles.historyMeta}>
                      <span>满分: {sub.assignment?.maxMarks}分</span>
                      <span>提交时间: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('zh-CN') : '未知'}</span>
                    </div>
                  </div>
                  <div className={styles.historyStatus}>
                    {sub.finalMarks !== undefined ? (
                      <div className={styles.gradeChip}>
                        <Star size={13} />
                        {sub.finalMarks}/{sub.assignment?.maxMarks}
                      </div>
                    ) : (
                      <Badge color="blue" size="sm">
                        <Clock size={11} /> 待评分
                      </Badge>
                    )}
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
          title={`Submit: ${submitModal.title}`}
          onClose={() => setSubmitModal(null)}
          okText="Submit Assignment"
          onOk={() => submitMutation.mutate({ assignmentId: submitModal.id, content: submissionContent })}
          okLoading={submitMutation.isPending}
        >
          <p className={styles.submitInfo}>Max marks: {submitModal.maxMarks} · Weight: {submitModal.weight}%</p>
          <label className={styles.submitLabel}>Your Answer / Notes</label>
          <textarea
            className={styles.submitTextarea}
            rows={6}
            placeholder="Type your response or paste your essay here…"
            value={submissionContent}
            onChange={e => setSubmissionContent(e.target.value)}
          />
          <p className={styles.aiNote}>
            🤖 AI rubric grading will automatically score your submission across multiple criteria.
          </p>
        </Modal>
      )}

      {/* AI Rubric Modal */}
      {viewAI && viewAI.aiRubricScores && (
        <Modal
          open
          title="AI Rubric Assessment"
          onClose={() => setViewAI(null)}
          footer={<Button onClick={() => setViewAI(null)}>Close</Button>}
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
                    <p className={styles.rubricComment}>{s.ai_comment}</p>
                  </div>
                ))
              } catch {
                return <p>No rubric data available.</p>
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
            <h2 className={styles.confirmationTitle}>作业提交成功</h2>
            <p className={styles.confirmationMessage}>您的作业已成功提交</p>
            
            {lastSubmission.aiRubricScores && (
              <div className={styles.aiSummary}>
                <h3 className={styles.aiSummaryTitle}>AI评分建议</h3>
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
                <p className={styles.aiSummaryNote}>AI评分仅供参考，最终成绩由讲师评定</p>
              </div>
            )}

            <div className={styles.confirmationActions}>
              <Button
                onClick={() => {
                  setShowSubmitConfirmation(false)
                  setViewAI(lastSubmission)
                }}
              >
                查看AI评分详情
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowSubmitConfirmation(false)}
              >
                返回课程
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default LmsCourseDetailPage
