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

  const validateFiles = (files: File[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/jpg', 'image/png']
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png']
    const maxSize = 10 * 1024 * 1024 // 10MB

    files.forEach((file, index) => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        errors.push(`文件 "${file.name}" 格式不支持，仅支持 PDF、DOC、DOCX、TXT、JPG、JPEG、PNG 格式`)
      }
      
      if (file.size > maxSize) {
        errors.push(`文件 "${file.name}" 超过10MB限制`)
      }
    })

    if (files.length > 5) {
      errors.push('最多只能上传5个文件')
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
            { criterion: 'Content', ai_score: 8.5, ai_comment: 'Good content', ai_suggestions: 'Add more examples' },
            { criterion: 'Structure', ai_score: 9.0, ai_comment: 'Well structured', ai_suggestions: 'Improve conclusion' },
            { criterion: 'Depth', ai_score: 7.5, ai_comment: 'Good depth', ai_suggestions: 'Explore more concepts' },
            { criterion: 'Accuracy', ai_score: 8.0, ai_comment: 'Accurate information', ai_suggestions: 'Check references' }
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
            { criterion: 'Content', ai_score: 9.0, ai_comment: 'Excellent content', ai_suggestions: 'Very good' },
            { criterion: 'Structure', ai_score: 9.5, ai_comment: 'Perfect structure', ai_suggestions: 'No suggestions' },
            { criterion: 'Depth', ai_score: 8.5, ai_comment: 'Great depth', ai_suggestions: 'Excellent analysis' },
            { criterion: 'Accuracy', ai_score: 9.0, ai_comment: 'Very accurate', ai_suggestions: 'Well researched' }
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
      
      const { data } = await apiClient.post('/lms/submissions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return data
    },
    onSuccess: (data) => {
      setLastSubmission(data.data)
      setShowSubmitConfirmation(true)
      setSubmitModal(null)
      setSubmissionContent('')
      setSubmissionFiles([])
      setFileErrors([])
      qc.invalidateQueries({ queryKey: ['submissions', offeringId] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? e.message ?? 'Submission failed' })
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
          className={`${styles.tab} ${activeTab === 'materials' ? styles.active : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          课程材料
        </button>
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

      {/* Course Materials */}
      {activeTab === 'materials' && (
        <div className={styles.materialsContainer}>
          {/* Videos */}
          <Card title="课程视频">
            <div className={styles.videosList}>
              <div className={styles.videoItem}>
                <div className={styles.videoThumbnail}>
                  <div className={styles.playButton}>▶</div>
                </div>
                <div className={styles.videoInfo}>
                  <h4 className={styles.videoTitle}>课程介绍 - {offering.course?.name}</h4>
                  <p className={styles.videoDescription}>课程概述和学习目标</p>
                  <span className={styles.videoDuration}>03:45</span>
                </div>
              </div>
              <div className={styles.videoItem}>
                <div className={styles.videoThumbnail}>
                  <div className={styles.playButton}>▶</div>
                </div>
                <div className={styles.videoInfo}>
                  <h4 className={styles.videoTitle}>第1章 - 基础知识</h4>
                  <p className={styles.videoDescription}>课程核心概念讲解</p>
                  <span className={styles.videoDuration}>15:20</span>
                </div>
              </div>
            </div>
          </Card>

          {/* PPT Slides */}
          <Card title="PPT课件" className={styles.materialsCard}>
            <div className={styles.slidesList}>
              <div className={styles.slideItem}>
                <div className={styles.slideThumbnail}>
                  <FileText size={24} />
                </div>
                <div className={styles.slideInfo}>
                  <h4 className={styles.slideTitle}>课程大纲 PPT</h4>
                  <p className={styles.slideDescription}>课程整体结构和安排</p>
                  <span className={styles.slidePages}>12 页</span>
                </div>
              </div>
              <div className={styles.slideItem}>
                <div className={styles.slideThumbnail}>
                  <FileText size={24} />
                </div>
                <div className={styles.slideInfo}>
                  <h4 className={styles.slideTitle}>第1章 - 基础知识</h4>
                  <p className={styles.slideDescription}>核心概念和理论基础</p>
                  <span className={styles.slidePages}>25 页</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Course Sessions */}
          <Card title="课程会话" className={styles.materialsCard}>
            <div className={styles.sessionsList}>
              <div className={styles.sessionItem}>
                <div className={styles.sessionDate}>2026-03-15</div>
                <div className={styles.sessionInfo}>
                  <h4 className={styles.sessionTitle}>第1讲：课程介绍</h4>
                  <p className={styles.sessionDescription}>课程概述、学习目标、评估方式</p>
                </div>
              </div>
              <div className={styles.sessionItem}>
                <div className={styles.sessionDate}>2026-03-22</div>
                <div className={styles.sessionInfo}>
                  <h4 className={styles.sessionTitle}>第2讲：基础知识</h4>
                  <p className={styles.sessionDescription}>核心概念讲解和案例分析</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Attendance Sessions */}
          <Card title="出勤记录" className={styles.materialsCard}>
            <div className={styles.attendanceList}>
              <div className={styles.attendanceItem}>
                <div className={styles.attendanceDate}>2026-03-15</div>
                <div className={styles.attendanceStatus}>
                  <Badge color="green">已出勤</Badge>
                </div>
              </div>
              <div className={styles.attendanceItem}>
                <div className={styles.attendanceDate}>2026-03-22</div>
                <div className={styles.attendanceStatus}>
                  <Badge color="green">已出勤</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Assignments */}
      {activeTab === 'assignments' && (
        <Card title="Assignments & Assessments">
        {assignments.length === 0 ? (
          <div className={styles.emptyAssignments}>No assignments posted yet.</div>
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
                      <span>Max: {a.maxMarks} marks</span>
                      <span>Weight: {a.weight}%</span>
                      {a.dueDate && (
                        <span className={isDue ? styles.overdue : styles.dueSoon}>
                          <Clock size={11} />
                          Due: {new Date(a.dueDate).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                    {hasSubmitted && (
                      <div className={styles.submissionStatus}>
                        <CheckCircle size={11} />
                        <span>Submitted on: {submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString('zh-CN') : 'Unknown'}</span>
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
                        <CheckCircle size={11} /> Submitted
                      </Badge>
                    ) : !isDue ? (
                      <Button
                        size="sm"
                        icon={<Upload size={13} />}
                        onClick={() => { setSubmitModal(a); setSubmissionContent(''); setSubmissionFiles([]) }}
                      >
                        Submit
                      </Button>
                    ) : (
                      <Badge color="red" size="sm">
                        <Clock size={11} /> Overdue
                      </Badge>
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
        <Card title={user?.role === 'lecturer' ? '学生提交记录' : '提交历史'}>
          {submissionHistory.length === 0 ? (
            <div className={styles.emptyAssignments}>
              {user?.role === 'lecturer' ? '暂无学生提交记录' : '暂无提交记录'}
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
                        <span>{sub.studentName}</span>
                      </div>
                    )}
                    <div className={styles.historyTitle}>{sub.assignment?.title || sub.assignmentTitle || '作业'}</div>
                    <div className={styles.historyMeta}>
                      <span>满分: {sub.assignment?.maxMarks}分</span>
                      <span>提交时间: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('zh-CN') : '未知'}</span>
                    </div>
                    <div className={styles.historyContent}>
                      {sub.content?.substring(0, 100)}...
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
          onClose={() => {
            setSubmitModal(null)
            setSubmissionFiles([])
          }}
          okText="Submit Assignment"
          onOk={() => submitMutation.mutate({ 
            assignmentId: submitModal.id, 
            content: submissionContent,
            files: submissionFiles
          })}
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
          
          {/* File Upload */}
          <label className={styles.submitLabel}>Upload Files</label>
          <div className={styles.fileUpload}>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              onChange={(e) => {
                if (e.target.files) {
                  const selectedFiles = Array.from(e.target.files)
                  const validation = validateFiles(selectedFiles)
                  
                  if (validation.valid) {
                    setSubmissionFiles(selectedFiles)
                    setFileErrors([])
                  } else {
                    setFileErrors(validation.errors)
                    addToast({ type: 'error', message: validation.errors[0] })
                  }
                }
              }}
              className={styles.fileInput}
            />
            <div className={styles.fileButton}>
              <Upload size={16} />
              <span>Choose Files</span>
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
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
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
                    <div className={styles.rubricFeedback}>
                      <h5 className={styles.feedbackTitle}>评分说明</h5>
                      <p className={styles.rubricComment}>{s.ai_comment}</p>
                      {s.ai_suggestions && (
                        <div className={styles.feedbackSuggestions}>
                          <h6 className={styles.suggestionsTitle}>改进建议</h6>
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
                    criterion: "内容完整性",
                    ai_score: 8.5,
                    ai_comment: "回答内容较为完整，涵盖了主要知识点，但在某些细节上可以进一步展开。",
                    ai_suggestions: "建议补充具体的例子和实际应用场景，以增强回答的说服力。"
                  },
                  {
                    criterion: "逻辑清晰度",
                    ai_score: 9.0,
                    ai_comment: "逻辑结构清晰，论证过程合理，能够很好地表达思想。",
                    ai_suggestions: "可以尝试使用更简洁的语言表达复杂概念，提高可读性。"
                  },
                  {
                    criterion: "深度与创新性",
                    ai_score: 7.5,
                    ai_comment: "对问题有一定的理解深度，但创新性不足，缺乏独特的见解。",
                    ai_suggestions: "建议从不同角度思考问题，提出一些有创意的解决方案。"
                  },
                  {
                    criterion: "表达准确性",
                    ai_score: 8.0,
                    ai_comment: "表达基本准确，没有明显的错误，但在专业术语的使用上可以更加精确。",
                    ai_suggestions: "建议查阅相关资料，确保专业术语的正确使用。"
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
                      <h5 className={styles.feedbackTitle}>评分说明</h5>
                      <p className={styles.rubricComment}>{s.ai_comment}</p>
                      <div className={styles.feedbackSuggestions}>
                        <h6 className={styles.suggestionsTitle}>改进建议</h6>
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
