import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Circle, ChevronRight, BookOpen, CreditCard, FileText, GraduationCap } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import styles from './StudentDashboardPage.module.scss'

interface OnboardingStatus {
  applicantStatus: string | null
  offerRef: string | null
  programmeName: string | null
  studentId: string | null
  isEnrolled: boolean
  hasEnrolments: boolean
  hasPendingInvoice: boolean
}

const StudentDashboardPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()

  const { data: status, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ['student', 'onboarding-status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/onboarding-status')
      return data.data
    },
  })

  const acceptMutation = useMutation({
    mutationFn: () => apiClient.post('/admissions/accept-offer'),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message ?? 'Offer accepted! Welcome to UNISSA.' })
      qc.invalidateQueries({ queryKey: ['student', 'onboarding-status'] })
      qc.invalidateQueries({ queryKey: ['student', 'me'] })
      navigate('/student/courses')
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Failed to accept offer. Please try again.' })
    },
  })

  if (isLoading || !status) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading...</div>
      </div>
    )
  }

  // Determine which steps are complete
  const offerAccepted = status.isEnrolled || (status.applicantStatus === 'accepted')
  const coursesRegistered = status.hasEnrolments
  const feesPaid = status.isEnrolled && !status.hasPendingInvoice && status.hasEnrolments

  const steps = [
    {
      num: 1,
      icon: <FileText size={20} />,
      title: status.applicantStatus === 'submitted' 
        ? t('studentDashboard.stepApplicationTitle', { defaultValue: 'Application Submitted' })
        : status.applicantStatus 
          ? t('studentDashboard.stepOfferTitle', { defaultValue: 'Accept Offer Letter' })
          : t('studentDashboard.stepNoApplicationTitle', { defaultValue: 'Submit Admission Application' }),
      desc: status.applicantStatus === 'submitted'
        ? t('studentDashboard.stepApplicationDesc', { defaultValue: 'Your application has been submitted. The admissions team is reviewing it. You will receive an offer letter once approved.' })
        : status.applicantStatus
          ? status.offerRef
            ? t('studentDashboard.stepOfferDesc', {
                defaultValue: `Offer reference: {{ref}} — {{programme}}`,
                ref: status.offerRef,
                programme: status.programmeName ?? '',
              })
            : t('studentDashboard.stepOfferDescNoRef', { defaultValue: 'Review and accept your admission offer from UNISSA.' })
          : t('studentDashboard.stepNoApplicationDesc', { defaultValue: 'You need to submit an admission application before you can enrol in courses.' }),
      done: offerAccepted,
      action: (offerAccepted || status.applicantStatus === 'submitted') 
        ? null 
        : status.applicantStatus 
          ? () => acceptMutation.mutate()
          : () => navigate('/admission/apply'),
      actionLabel: status.applicantStatus 
        ? t('studentDashboard.acceptOffer', { defaultValue: 'Accept Offer & Enrol' })
        : t('studentDashboard.submitApplication', { defaultValue: 'Submit Application' }),
      loading: acceptMutation.isPending,
    },
    {
      num: 2,
      icon: <BookOpen size={20} />,
      title: t('studentDashboard.stepCoursesTitle', { defaultValue: 'Register for Courses' }),
      desc: t('studentDashboard.stepCoursesDesc', { defaultValue: 'Select your courses for this semester from the available offerings.' }),
      done: coursesRegistered,
      action: offerAccepted && !coursesRegistered ? () => navigate('/student/courses') : null,
      actionLabel: t('studentDashboard.goToCourses', { defaultValue: 'Select Courses' }),
      disabled: !offerAccepted,
    },
    {
      num: 3,
      icon: <CreditCard size={20} />,
      title: t('studentDashboard.stepFeesTitle', { defaultValue: 'Pay Semester Fees' }),
      desc: t('studentDashboard.stepFeesDesc', { defaultValue: 'Pay your tuition fees to confirm your enrolment.' }),
      done: feesPaid,
      action: coursesRegistered && !feesPaid ? () => navigate('/finance/statement') : null,
      actionLabel: t('studentDashboard.goToFees', { defaultValue: 'Pay Fees' }),
      disabled: !coursesRegistered,
    },
    {
      num: 4,
      icon: <GraduationCap size={20} />,
      title: t('studentDashboard.stepLmsTitle', { defaultValue: 'Access Your Courses (LMS)' }),
      desc: t('studentDashboard.stepLmsDesc', { defaultValue: 'Access your course materials, submit assignments, and track your progress.' }),
      done: feesPaid,
      action: feesPaid ? () => navigate('/lms/courses') : null,
      actionLabel: t('studentDashboard.goToLms', { defaultValue: 'Go to LMS' }),
      disabled: !feesPaid,
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const progressPct = Math.round((completedCount / steps.length) * 100)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {t('studentDashboard.welcome', { defaultValue: 'Welcome, {{name}}!', name: user?.displayName ?? 'Student' })}
          </h1>
          <p className={styles.subtitle}>
            {t('studentDashboard.subtitle', { defaultValue: 'Complete the steps below to begin your journey at UNISSA.' })}
          </p>
        </div>
        {status.studentId && (
          <div className={styles.studentIdBadge}>
            <span className={styles.studentIdLabel}>{t('studentDashboard.studentId', { defaultValue: 'Student ID' })}</span>
            <span className={styles.studentIdValue}>{status.studentId}</span>
          </div>
        )}
      </div>

      <Card className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>
            {t('studentDashboard.onboardingProgress', { defaultValue: 'Enrolment Progress' })}
          </span>
          <span className={styles.progressCount}>{completedCount}/{steps.length} {t('studentDashboard.stepsComplete', { defaultValue: 'steps complete' })}</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
      </Card>

      <div className={styles.steps}>
        {steps.map((step) => (
          <div
            key={step.num}
            className={`${styles.step} ${step.done ? styles.stepDone : ''} ${step.disabled ? styles.stepDisabled : ''}`}
          >
            <div className={styles.stepLeft}>
              <div className={`${styles.stepIcon} ${step.done ? styles.stepIconDone : ''}`}>
                {step.done ? <CheckCircle size={20} /> : <Circle size={20} />}
              </div>
              <div className={styles.stepConnector} />
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepHeader}>
                <div className={styles.stepIconColored}>{step.icon}</div>
                <div>
                  <div className={styles.stepNum}>
                    {t('studentDashboard.step', { defaultValue: 'Step {{n}}', n: step.num })}
                  </div>
                  <div className={styles.stepTitle}>{step.title}</div>
                </div>
              </div>
              <p className={styles.stepDesc}>{step.desc}</p>
              {step.action && !step.done && (
                <Button
                  onClick={step.action}
                  loading={'loading' in step ? step.loading : false}
                  icon={<ChevronRight size={14} />}
                  className={styles.stepBtn}
                >
                  {step.actionLabel}
                </Button>
              )}
              {step.done && (
                <span className={styles.stepComplete}>
                  <CheckCircle size={14} />
                  {t('studentDashboard.complete', { defaultValue: 'Complete' })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {feesPaid && (
        <Card className={styles.readyCard}>
          <div className={styles.readyContent}>
            <GraduationCap size={32} className={styles.readyIcon} />
            <div>
              <div className={styles.readyTitle}>
                {t('studentDashboard.allDone', { defaultValue: 'You\'re all set!' })}
              </div>
              <div className={styles.readyDesc}>
                {t('studentDashboard.allDoneDesc', { defaultValue: 'Your enrolment is complete. Access your courses, view your timetable, and track your grades.' })}
              </div>
            </div>
            <Button onClick={() => navigate('/lms/courses')}>
              {t('studentDashboard.goToLms', { defaultValue: 'Go to LMS' })}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export default StudentDashboardPage
