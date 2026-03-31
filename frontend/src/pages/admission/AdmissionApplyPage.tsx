import { useTranslation } from 'react-i18next'
import React, { useState, useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Form, Input, Select, DatePicker, Checkbox,
  Button, Card, Row, Col, Descriptions, Alert, Space,
  Spin, Tag, Typography,
} from 'antd'
import {
  CheckCircleOutlined, UserOutlined, BookOutlined,
  TrophyOutlined, FileTextOutlined, IdcardOutlined, ClockCircleOutlined,
  BellOutlined, CloseCircleOutlined, LoadingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import styles from './AdmissionApplyPage.module.scss'

const { Title, Text } = Typography

// ── Enrolled student status card ──────────────────────────────────────────────
const EnrolledStudentCard: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    active: 'green', suspended: 'orange', graduated: 'blue', withdrawn: 'red',
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('admissionApply.title')}</h1>
        <p className={styles.pageSub}>{t('admissionApply.enrolledNote', { defaultValue: 'You are already enrolled as a student at UNISSA.' })}</p>
      </div>

      {/* Admission notice banner */}
      <div style={{
        maxWidth: 640, margin: '0 auto 20px',
        background: 'linear-gradient(135deg, #e8f5e9 0%, #f0f9ff 100%)',
        border: '1px solid #b7eb8f',
        borderRadius: 12, padding: '20px 24px',
        display: 'flex', alignItems: 'flex-start', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: '#00B42A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#135200', marginBottom: 4 }}>
            {t('admissionApply.admissionNoticeTitle', { defaultValue: 'Admission Notice — UNISSA AY 2026/2027' })}
          </div>
          <div style={{ fontSize: 13, color: '#237804', lineHeight: 1.6 }}>
            {t('admissionApply.admissionNoticeBody', { defaultValue: 'You have been successfully admitted and enrolled. Your student account has been activated. You may now access all student modules.' })}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* <Button size="small" type="primary" onClick={() => navigate('/lms/attendance')}>
              {t('nav.attendance', { defaultValue: 'Attendance' })}
            </Button> */}
            <Button size="small" onClick={() => navigate('/student/courses')}>
              {t('nav.courseReg', { defaultValue: 'Course Registration' })}
            </Button>
            <Button size="small" onClick={() => navigate('/finance/statement')}>
              {t('nav.feeStatement', { defaultValue: 'Fee Statement' })}
            </Button>
            <Button size="small" onClick={() => navigate('/student/profile')}>
              {t('nav.myProfile', { defaultValue: 'My Profile' })}
            </Button>
          </div>
        </div>
      </div>

      <Card
        style={{ maxWidth: 640, margin: '0 auto' }}
        styles={{ body: { padding: 32 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IdcardOutlined style={{ fontSize: 36, color: '#00B42A' }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>
            {profile?.user?.displayName ?? '—'}
          </Title>
          <Tag color={statusColor[profile?.status] ?? 'default'} style={{ fontSize: 13, padding: '2px 12px' }}>
            {(profile?.status ?? 'active').toUpperCase()}
          </Tag>
        </div>

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('admissionApply.studentId', { defaultValue: 'Student ID' })}>
            <strong>{profile?.studentId ?? '—'}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={t('admissionApply.reviewEmail', { defaultValue: 'Email' })}>
            {profile?.user?.email ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('admissionApply.programmeLabel', { defaultValue: 'Programme' })}>
            {profile?.programme ? `${profile.programme.name} (${profile.programme.code})` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('admissionApply.reviewIntake', { defaultValue: 'Intake' })}>
            {profile?.intake?.semester?.name ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="CGPA">
            {profile?.currentCgpa?.toFixed(2) ?? '0.00'}
          </Descriptions.Item>
          <Descriptions.Item label={t('admissionApply.enrolledDate', { defaultValue: 'Enrolled' })}>
            {profile?.enrolledAt ? dayjs(profile.enrolledAt).format('DD MMM YYYY') : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

// ── Step schemas ──────────────────────────────────────────────
const step1Schema = z.object({
  fullName:    z.string().min(1, 'Full name is required').min(3, 'Must be at least 3 characters'),
  icPassport:  z.string().min(1, 'IC/Passport number is required').min(6, 'Must be at least 6 characters'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender:      z.enum(['male', 'female'], { required_error: 'Gender is required', invalid_type_error: 'Gender is required' }),
  nationality: z.string().min(1, 'Nationality is required').min(2, 'Must be at least 2 characters'),
  email:       z.string().min(1, 'Email address is required').email('Please enter a valid email address'),
  mobile:      z.string().min(1, 'Mobile number is required').min(7, 'Must be at least 7 digits'),
  homeAddress: z.string().min(1, 'Home address is required').min(5, 'Must be at least 5 characters'),
})

const step2Schema = z.object({
  highestQualification: z.string().min(1, 'Qualification is required'),
  previousInstitution:  z.string().min(1, 'Previous institution is required').min(2, 'Must be at least 2 characters'),
  yearOfCompletion:     z.string().min(1, 'Year of completion is required').min(4, 'Please enter a valid 4-digit year'),
  cgpa:                 z.string()
    .transform(val => val === '' || val == null ? undefined : val)
    .pipe(z.string().optional())
    .refine(
      val => val === undefined || val === '' || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 4),
      { message: 'CGPA must be between 0.00 and 4.00' }
    )
    .refine(
      val => val === undefined || val === '' || /^\d+\.\d{2}$/.test(val) || /^\d+$/.test(val),
      { message: 'CGPA must have exactly 2 decimal places' }
    ),
}).refine(
  data => {
    const qual = data.highestQualification?.toUpperCase()
    return !['DIPLOMA', 'DEGREE', 'MASTERS'].includes(qual ?? '') || (data.cgpa && data.cgpa.trim() !== '')
  },
  { message: 'CGPA is required for Diploma or higher qualifications', path: ['cgpa'] }
)

const step3Schema = z.object({
  programmeId:        z.string().min(1, 'Programme is required'),
  intakeId:           z.string().min(1, 'Intake is required'),
  modeOfStudy:        z.enum(['full_time', 'part_time'], { required_error: 'Mode of study is required', invalid_type_error: 'Mode of study is required' }),
  scholarshipApplied: z.boolean().optional(),
  scholarshipType:    z.string().optional(),
})

type Step1 = z.infer<typeof step1Schema>
type Step2 = z.infer<typeof step2Schema>
type Step3 = z.infer<typeof step3Schema>

interface IntakeOption {
  id: string
  programme: { id: string; name: string; code: string }
  semester: { name: string }
  intakeStart: string
  maxCapacity: number
}

const fe = (msg?: string) => ({
  validateStatus: msg ? ('error' as const) : ('' as const),
  help: msg ?? '',
})

const RequiredLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span>
    {children}
    <span style={{ color: '#ff4d4f', marginLeft: 4 }} aria-hidden="true">*</span>
  </span>
)

// ── Pending application status card ──────────────────────────────────────────
const PendingApplicationCard: React.FC<{ app: any }> = ({ app }) => {
  const { t } = useTranslation()
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()

  const statusColor: Record<string, string> = {
    submitted: 'blue', under_review: 'orange', waitlisted: 'purple',
    rejected: 'red', accepted: 'green', auto_check_failed: 'red',
  }

  const QUAL_LABELS: Record<string, string> = {
    O_LEVEL: 'O-Level / BGCE', A_LEVEL: 'A-Level / STPM',
    DIPLOMA: 'Diploma', DEGREE: 'Bachelor Degree', MASTERS: 'Masters Degree',
    o_level: 'O-Level / BGCE', a_level: 'A-Level / STPM',
    diploma: 'Diploma', degree: 'Bachelor Degree', masters: 'Masters Degree',
  }

  const acceptMutation = useMutation({
    mutationFn: () => apiClient.post('/admissions/accept-offer'),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message ?? t('admissionApply.offerAccepted', { defaultValue: 'Offer accepted! Welcome to UNISSA.' }) })
      qc.invalidateQueries({ queryKey: ['student', 'me'] })
      qc.invalidateQueries({ queryKey: ['admissions', 'my-application'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'kpi'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? t('admissionApply.acceptOfferFailed', { defaultValue: 'Failed to accept offer. Please try again.' }) })
    },
  })

  const isAccepted = app.status === 'accepted'
  const isRejected = app.status === 'rejected'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('admissionApply.title')}</h1>
        <p className={styles.pageSub}>
          {isAccepted
            ? t('admissionApply.offerReadyNote', { defaultValue: 'Your application has been approved. Please review and accept your offer below.' })
            : isRejected
              ? t('admissionApply.rejectedNote', { defaultValue: 'Thank you for your application to UNISSA.' })
              : t('admissionApply.pendingNote', { defaultValue: 'Your application is being reviewed.' })
          }
        </p>
      </div>

      {/* Acceptance / Rejection notification banner */}
      {isAccepted && (
        <div style={{
          maxWidth: 760, margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #e8f5e9 0%, #f6ffed 100%)',
          border: '2px solid #52c41a', borderRadius: 12, padding: '20px 24px',
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <BellOutlined style={{ fontSize: 28, color: '#52c41a', marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#135200', marginBottom: 6 }}>
              🎓 {t('admissionApply.congratulations', { defaultValue: 'Congratulations, you have been admitted!' })}
            </div>
            <div style={{ fontSize: 13, color: '#237804', lineHeight: 1.7, marginBottom: 12 }}>
              {t('admissionApply.acceptInstructions', { defaultValue: 'Your application to UNISSA has been approved by the Admissions Office. Please review your application details below and click "Accept Offer & Enrol" to complete your registration.' })}
            </div>
            <Button
              type="primary"
              size="large"
              loading={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
              style={{ background: '#52c41a', borderColor: '#52c41a', fontWeight: 600 }}
            >
              <CheckCircleOutlined />
              {t('admissionApply.acceptOffer', { defaultValue: 'Accept Offer & Enrol' })}
            </Button>
          </div>
        </div>
      )}

      {isRejected && (
        <Alert
          style={{ maxWidth: 760, margin: '0 auto 20px' }}
          type="error"
          icon={<CloseCircleOutlined />}
          showIcon
          message={
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              {t('admissionApply.sorryRejected', { defaultValue: 'Sorry, you have not been admitted.' })}
            </span>
          }
          description={
            app.officerRemarks
              ? `${t('admissionApply.rejectionReason', { defaultValue: 'Reason' })}: ${app.officerRemarks}`
              : t('admissionApply.noReason', { defaultValue: 'Please contact the Admissions Office for further details.' })
          }
        />
      )}

      {/* Application summary card */}
      <Card style={{ maxWidth: 760, margin: '0 auto' }} styles={{ body: { padding: 24 } }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: isAccepted ? '#e8f5e9' : isRejected ? '#fff1f0' : '#fffbe6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {isAccepted
              ? <CheckCircleOutlined style={{ fontSize: 28, color: '#00B42A' }} />
              : isRejected
                ? <CloseCircleOutlined style={{ fontSize: 28, color: '#f5222d' }} />
                : <ClockCircleOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{app.fullName}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{app.applicationRef}</div>
          </div>
          <Tag color={statusColor[app.status] ?? 'default'} style={{ fontSize: 13, padding: '2px 12px' }}>
            {app.status.replace(/_/g, ' ').toUpperCase()}
          </Tag>
        </div>

        <Row gutter={[16, 16]}>
          {/* Personal Information */}
          <Col xs={24} md={12}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('admissionApply.personalInfo', { defaultValue: 'Personal Information' })}
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('admissionApply.reviewFullName', { defaultValue: 'Full Name' })}>{app.fullName}</Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewIC', { defaultValue: 'IC / Passport' })}>{app.icPassport}</Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewDOB', { defaultValue: 'Date of Birth' })}>
                {app.dateOfBirth ? dayjs(app.dateOfBirth).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewGender', { defaultValue: 'Gender' })}>{app.gender}</Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewNationality', { defaultValue: 'Nationality' })}>{app.nationality}</Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewEmail', { defaultValue: 'Email' })}>{app.email}</Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewMobile', { defaultValue: 'Mobile' })}>{app.mobile}</Descriptions.Item>
            </Descriptions>
          </Col>

          {/* Academic Background */}
          <Col xs={24} md={12}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('admissionApply.academicBg', { defaultValue: 'Academic Background' })}
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('admissionApply.reviewQual', { defaultValue: 'Qualification' })}>
                {QUAL_LABELS[app.highestQualification] ?? app.highestQualification}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewInstitution', { defaultValue: 'Institution' })}>{app.previousInstitution}</Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewYear', { defaultValue: 'Year' })}>{app.yearOfCompletion}</Descriptions.Item>
              {app.cgpa != null && (
                <Descriptions.Item label={t('admissionApply.reviewCGPA', { defaultValue: 'CGPA' })}>{app.cgpa}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Subject Grades */}
            {Array.isArray(app.subjectGrades) && app.subjectGrades.length > 0 && (
              <>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('admissionApply.subjectGrades', { defaultValue: 'Subject Grades' })}
                </div>
                <Descriptions column={1} size="small" bordered>
                  {app.subjectGrades.map((g: any) => (
                    <Descriptions.Item key={g.id ?? g.subjectName} label={g.subjectName}>
                      <Tag color={g.grade === 'A' ? 'green' : g.grade === 'B' ? 'blue' : g.grade === 'C' ? 'orange' : 'default'}>
                        {g.grade}
                      </Tag>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}
          </Col>

          {/* Programme Choice */}
          <Col xs={24}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('admissionApply.programmeLabel', { defaultValue: 'Programme Choice' })}
            </div>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('admissionApply.reviewIntake', { defaultValue: 'Intake' })}>
                {app.programme ? `${app.programme.name} (${app.programme.code})` : '—'}
                {app.intake?.semester ? ` — ${app.intake.semester.name}` : ''}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissionApply.reviewMode', { defaultValue: 'Mode' })}>
                {app.modeOfStudy === 'full_time' ? t('admissionApply.fullTime', { defaultValue: 'Full Time' }) : t('admissionApply.partTime', { defaultValue: 'Part Time' })}
              </Descriptions.Item>
              {app.scholarshipApplied && (
                <Descriptions.Item label={t('admissionApply.reviewScholarship', { defaultValue: 'Scholarship' })}>
                  {app.scholarshipType ?? t('admissionApply.applied', { defaultValue: 'Applied' })}
                </Descriptions.Item>
              )}
              <Descriptions.Item label={t('admissionApply.submittedAt', { defaultValue: 'Submitted' })}>
                {app.submittedAt ? dayjs(app.submittedAt).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>

        {/* Officer remarks for non-rejection cases */}
        {app.officerRemarks && !isRejected && (
          <Alert style={{ marginTop: 16 }} type="info"
            message={t('admissionApply.officerRemarks', { defaultValue: 'Remarks' })}
            description={app.officerRemarks} showIcon />
        )}

        {/* Bottom accept button for accepted state */}
        {isAccepted && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              loading={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
              style={{ background: '#52c41a', borderColor: '#52c41a', fontWeight: 600, minWidth: 200 }}
            >
              <CheckCircleOutlined />
              {t('admissionApply.acceptOffer', { defaultValue: 'Accept Offer & Enrol' })}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

const AdmissionApplyPage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)

  const { data: studentProfile, isLoading: studentLoading } = useQuery<any>({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/students/me')
        return data.data ?? null
      } catch (e: any) {
        if (e?.response?.status === 404) return null   // not enrolled yet
        throw e
      }
    },
    retry: false,
  })

  const { data: myApplication, isLoading: appLoading } = useQuery<any>({
    queryKey: ['admissions', 'my-application'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/admissions/my-application')
        return data.data ?? null
      } catch (e: any) {
        if (e?.response?.status === 404) return null   // no application yet — show the form
        throw e
      }
    },
    retry: false,
    enabled: !studentLoading && !studentProfile,
    refetchInterval: 8000,
  })

  const [step, setStep]           = useState(() => {
    const saved = sessionStorage.getItem('admission-apply-step')
    return saved ? Number(saved) : 0
  })
  const [submitted, setSubmitted] = useState<{ applicationRef: string; autoCheckPassed: boolean } | null>(null)
  const [checkStep, setCheckStep] = useState(0)
  const [formData, setFormData]   = useState<Partial<Step1 & Step2 & Step3>>(() => {
    try {
      const saved = sessionStorage.getItem('admission-apply-form')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const addToast                  = useUIStore(s => s.addToast)
  const qc                        = useQueryClient()

  useEffect(() => {
    sessionStorage.setItem('admission-apply-step', String(step))
  }, [step])

  useEffect(() => {
    sessionStorage.setItem('admission-apply-form', JSON.stringify(formData))
  }, [formData])

  useEffect(() => {
    if (submitted) {
      sessionStorage.removeItem('admission-apply-step')
      sessionStorage.removeItem('admission-apply-form')
    }
  }, [submitted])

  // Animate auto-check steps after submission
  useEffect(() => {
    if (submitted) {
      setCheckStep(0)
      const t1 = setTimeout(() => setCheckStep(1), 700)
      const t2 = setTimeout(() => setCheckStep(2), 1400)
      const t3 = setTimeout(() => setCheckStep(3), 2100)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }
  }, [submitted])

  // Auto-transition: after animation completes, clear submitted so PendingApplicationCard renders
  useEffect(() => {
    if (checkStep >= 3 && submitted) {
      const t4 = setTimeout(() => setSubmitted(null), 4000)
      return () => clearTimeout(t4)
    }
  }, [checkStep, submitted])

  const STEPS = [
    { title: t('admissionApply.stepPersonal'),  icon: <UserOutlined /> },
    { title: t('admissionApply.stepAcademic'),  icon: <BookOutlined /> },
    { title: t('admissionApply.stepProgramme'), icon: <TrophyOutlined /> },
    { title: t('admissionApply.stepReview'),    icon: <FileTextOutlined /> },
  ]

  const QUAL_OPTIONS = [
    { value: 'O_LEVEL', label: t('admissionApply.qualOLevel') },
    { value: 'A_LEVEL', label: t('admissionApply.qualALevel') },
    { value: 'DIPLOMA', label: t('admissionApply.qualDiploma') },
    { value: 'DEGREE',  label: t('admissionApply.qualBachelor') },
    { value: 'MASTERS', label: t('admissionApply.qualMasters') },
  ]

  const { data: intakes = [] } = useQuery<IntakeOption[]>({
    queryKey: ['admissions', 'intakes'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admissions/intakes')
      return data.data
    },
  })

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiClient.post('/admissions/apply', payload),
    onSuccess: (res) => {
      setSubmitted({
        applicationRef: res.data.data.applicationRef,
        autoCheckPassed: res.data.autoCheckPassed ?? true,
      })
      // Warm the cache so PendingApplicationCard renders immediately after animation
      qc.setQueryData(['admissions', 'my-application'], res.data.data)
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('admissionApply.submissionFailed') }),
  })

  const submitErrorMsg: string | null = submitMutation.isError
    ? ((submitMutation.error as any)?.response?.data?.message ?? t('admissionApply.submissionFailed'))
    : null

  const form1 = useForm<Step1>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      ...formData as Step1,
      fullName: (formData as Step1)?.fullName || user?.displayName || '',
      dateOfBirth: (formData as Step1)?.dateOfBirth || '2005-10-24',
      nationality: (formData as Step1)?.nationality || 'Brunei Darussalam',
    },
  })
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema), defaultValues: formData as Step2 })
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema), defaultValues: formData as Step3 })

  if (studentLoading || (appLoading && !studentProfile)) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><Spin size="large" /></div>
  }

  // Already enrolled as a student
  if (studentProfile) return <EnrolledStudentCard />

  // Resolve selected intake for review / submitted views
  const selectedIntake = intakes.find(i => i.id === formData.intakeId)

  // ── Submitted view: auto-check animation + 4-step summary ────────────────
  if (submitted) {
    const autoCheckSteps = [
      t('admissionApply.checkStep1', { defaultValue: 'Verifying qualification credentials...' }),
      t('admissionApply.checkStep2', { defaultValue: 'Checking programme eligibility requirements...' }),
      t('admissionApply.checkStep3', { defaultValue: 'Reviewing intake availability...' }),
    ]
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>{t('admissionApply.title')}</h1>
          <p className={styles.pageSub}>
            {t('admissionApply.submittedSubtitle', { defaultValue: 'Application submitted — automatic qualification check in progress.' })}
          </p>
        </div>

        {/* ── Auto-check animation card ── */}
        <Card style={{ maxWidth: 760, margin: '0 auto 20px' }} styles={{ body: { padding: 24 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircleOutlined style={{ fontSize: 24, color: '#00B42A' }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {t('admissionApply.successTitle', { defaultValue: 'Application Submitted Successfully' })}
              </Title>
              <Text type="secondary">
                {t('admissionApply.successRef', { defaultValue: 'Reference' })}: <strong style={{ color: '#165DFF' }}>{submitted.applicationRef}</strong>
              </Text>
            </div>
          </div>

          {/* Auto-qualification check animation */}
          <div style={{ background: '#f9f9ff', border: '1px solid #e8e8ff', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', marginBottom: 12 }}>
              🤖 {t('admissionApply.autoCheckTitle', { defaultValue: 'Automatic Qualification Review' })}
            </div>
            {autoCheckSteps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 13, color: checkStep > i ? '#237804' : checkStep === i ? '#165DFF' : '#aaa' }}>
                {checkStep > i
                  ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                  : checkStep === i
                    ? <LoadingOutlined style={{ color: '#165DFF', fontSize: 16 }} />
                    : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #ddd', display: 'inline-block', flexShrink: 0 }} />
                }
                {s}
              </div>
            ))}
            {checkStep >= 3 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e8e8ff', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircleOutlined style={{ color: '#00B42A', fontSize: 18 }} />
                <span style={{ fontWeight: 600, color: submitted.autoCheckPassed ? '#237804' : '#cf1322', fontSize: 14 }}>
                  {submitted.autoCheckPassed
                    ? t('admissionApply.autoCheckPassed', { defaultValue: 'Auto-check passed — Application forwarded for specialist review.' })
                    : t('admissionApply.autoCheckFailed', { defaultValue: 'Auto-check did not pass. Please contact the Admissions Office.' })
                  }
                </span>
              </div>
            )}
          </div>

          {/* Under Review status */}
          {checkStep >= 3 && submitted.autoCheckPassed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '12px 16px' }}>
              <ClockCircleOutlined style={{ color: '#fa8c16', fontSize: 20, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: '#d46b08', fontSize: 14 }}>
                  {t('admissionApply.pendingStatus', { defaultValue: 'Under Review' })}
                </div>
                <div style={{ fontSize: 12, color: '#8c6d1f', marginTop: 2 }}>
                  {t('admissionApply.pendingDetailNote', { defaultValue: 'Your application is being reviewed by the Admissions Office. You will receive a notification once a decision is made.' })}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ── 4-step submitted data summary ── */}
        <Card
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileTextOutlined style={{ color: '#165DFF' }} />
              {t('admissionApply.submittedSummary', { defaultValue: 'Submitted Application Details' })}
            </span>
          }
          style={{ maxWidth: 760, margin: '0 auto' }}
          styles={{ body: { padding: 24 } }}
        >
          <Row gutter={[16, 20]}>
            {/* Step 1 – Personal Info */}
            <Col xs={24} md={12}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#165DFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <UserOutlined style={{ marginRight: 5 }} />
                {t('admissionApply.personalInfo', { defaultValue: 'Personal Information' })}
              </div>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('admissionApply.reviewFullName', { defaultValue: 'Full Name' })}>{formData.fullName}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewIC', { defaultValue: 'IC / Passport' })}>{formData.icPassport}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewDOB', { defaultValue: 'Date of Birth' })}>
                  {(formData as any).dateOfBirth ? dayjs((formData as any).dateOfBirth).format('DD MMM YYYY') : '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewGender', { defaultValue: 'Gender' })}>{formData.gender}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewNationality', { defaultValue: 'Nationality' })}>{formData.nationality}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewEmail', { defaultValue: 'Email' })}>{formData.email}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewMobile', { defaultValue: 'Mobile' })}>{formData.mobile}</Descriptions.Item>
              </Descriptions>
            </Col>

            {/* Step 2 – Academic Background */}
            <Col xs={24} md={12}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#165DFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <BookOutlined style={{ marginRight: 5 }} />
                {t('admissionApply.academicBg', { defaultValue: 'Academic Background' })}
              </div>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('admissionApply.reviewQual', { defaultValue: 'Qualification' })}>
                  {QUAL_OPTIONS.find(q => q.value === (formData as any).highestQualification)?.label ?? (formData as any).highestQualification}
                </Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewInstitution', { defaultValue: 'Institution' })}>{(formData as any).previousInstitution}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewYear', { defaultValue: 'Year' })}>{(formData as any).yearOfCompletion}</Descriptions.Item>
                {(formData as any).cgpa && (
                  <Descriptions.Item label={t('admissionApply.reviewCGPA', { defaultValue: 'CGPA' })}>{(formData as any).cgpa}</Descriptions.Item>
                )}
              </Descriptions>
            </Col>

            {/* Step 3 – Programme Choice */}
            <Col xs={24}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#165DFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <TrophyOutlined style={{ marginRight: 5 }} />
                {t('admissionApply.programmeLabel', { defaultValue: 'Programme Choice' })}
              </div>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label={t('admissionApply.reviewIntake', { defaultValue: 'Programme / Intake' })}>
                  {selectedIntake
                    ? `${selectedIntake.programme.name} (${selectedIntake.programme.code}) — ${selectedIntake.semester.name}`
                    : (formData as any).intakeId ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewMode', { defaultValue: 'Mode of Study' })}>
                  {(formData as any).modeOfStudy === 'full_time'
                    ? t('admissionApply.fullTime', { defaultValue: 'Full Time' })
                    : t('admissionApply.partTime', { defaultValue: 'Part Time' })}
                </Descriptions.Item>
                {(formData as any).scholarshipApplied && (
                  <Descriptions.Item label={t('admissionApply.reviewScholarship', { defaultValue: 'Scholarship' })}>
                    {(formData as any).scholarshipType ?? t('admissionApply.applied', { defaultValue: 'Applied' })}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Col>
          </Row>
        </Card>
      </div>
    )
  }

  // Application submitted (waiting/accepted/rejected) — shown on page revisit
  if (myApplication) return <PendingApplicationCard app={myApplication} />

  const handleNext1 = form1.handleSubmit(data => { setFormData(p => ({ ...p, ...data })); setStep(1) })
  const handleNext2 = form2.handleSubmit(data => { setFormData(p => ({ ...p, ...data })); setStep(2) })
  const handleNext3 = form3.handleSubmit(data => { setFormData(p => ({ ...p, ...data })); setStep(3) })
  const handleSubmit = () => submitMutation.mutate({ ...formData })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('admissionApply.title')}</h1>
        <p className={styles.pageSub}>{t('admissionApply.subtitle')}</p>
      </div>

      {/* Steps indicator */}
      <div className={styles.stepperCard}>
        <div className={styles.stepTrack}>
          {STEPS.map((_s, i) => (
            <div key={i} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${i < step ? styles.stepDone : i === step ? styles.stepActive : ''}`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />}
            </div>
          ))}
        </div>
        <div className={styles.stepCaption}>
          {t('admissionApply.stepOf', { current: step + 1, total: STEPS.length })}&nbsp;—&nbsp;{STEPS[step].title}
        </div>
      </div>

      {/* ── Step 1: Personal Info ─────────────────────────────── */}
      {step === 0 && (
        <Card title={t('admissionApply.step1Title')}>
          <Form layout="vertical" onFinish={handleNext1} requiredMark={false}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.fullName')}</RequiredLabel>} {...fe(form1.formState.errors.fullName?.message)}>
                  <Controller name="fullName" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.fullNamePlaceholder')} size="large" aria-label={t('admissionApply.fullName')} />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.icPassport')}</RequiredLabel>} {...fe(form1.formState.errors.icPassport?.message)}>
                  <Controller name="icPassport" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.icPassportPlaceholder')} size="large" aria-label={t('admissionApply.icPassport')} />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.dob')}</RequiredLabel>} {...fe(form1.formState.errors.dateOfBirth?.message)}>
                  <Controller name="dateOfBirth" control={form1.control}
                    render={({ field }) => (
                      <DatePicker
                        style={{ width: '100%' }}
                        size="large"
                        value={field.value ? dayjs(field.value) : null}
                        onChange={d => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                        format="DD/MM/YYYY"
                        aria-label={t('admissionApply.dob')}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.gender')}</RequiredLabel>} {...fe(form1.formState.errors.gender?.message)}>
                  <Controller name="gender" control={form1.control}
                    render={({ field }) => (
                      <Select {...field} size="large" placeholder={t('admissionApply.selectGender')}
                        options={[{ value: 'male', label: t('admissionApply.male') }, { value: 'female', label: t('admissionApply.female') }]}
                        aria-label={t('admissionApply.gender')}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.nationality')}</RequiredLabel>} {...fe(form1.formState.errors.nationality?.message)}>
                  <Controller name="nationality" control={form1.control}
                    render={({ field }) => <Input {...field} size="large" aria-label={t('admissionApply.nationality')} />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.email')}</RequiredLabel>} {...fe(form1.formState.errors.email?.message)}>
                  <Controller name="email" control={form1.control}
                    render={({ field }) => <Input {...field} type="email" placeholder={t('admissionApply.emailPlaceholder')} size="large" aria-label={t('admissionApply.email')} />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.mobile')}</RequiredLabel>} {...fe(form1.formState.errors.mobile?.message)}>
                  <Controller name="mobile" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.mobilePlaceholder')} size="large" aria-label={t('admissionApply.mobile')} />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.address')}</RequiredLabel>} {...fe(form1.formState.errors.homeAddress?.message)}>
                  <Controller name="homeAddress" control={form1.control}
                    render={({ field }) => <Input.TextArea {...field} rows={2} placeholder={t('admissionApply.addressPlaceholder')} aria-label={t('admissionApply.address')} />}
                  />
                </Form.Item>
              </Col>
            </Row>
            <div className={styles.formActions}>
              <Button type="primary" htmlType="submit" size="large">
                {t('admissionApply.nextAcademic')}
              </Button>
            </div>
          </Form>
        </Card>
      )}

      {/* ── Step 2: Academic Background ──────────────────────── */}
      {step === 1 && (
        <Card title={t('admissionApply.step2Title')}>
          <Form layout="vertical" onFinish={handleNext2} requiredMark={false}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.qualification')}</RequiredLabel>} {...fe(form2.formState.errors.highestQualification?.message)}>
                  <Controller name="highestQualification" control={form2.control}
                    render={({ field }) => (
                      <Select {...field} size="large" options={QUAL_OPTIONS} placeholder={t('admissionApply.selectQualification')} aria-label={t('admissionApply.qualification')} />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.prevInstitution')}</RequiredLabel>} {...fe(form2.formState.errors.previousInstitution?.message)}>
                  <Controller name="previousInstitution" control={form2.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.institutionPlaceholder')} size="large" aria-label={t('admissionApply.prevInstitution')} />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.yearCompleted')}</RequiredLabel>} {...fe(form2.formState.errors.yearOfCompletion?.message)}>
                  <Controller name="yearOfCompletion" control={form2.control}
                    render={({ field }) => <Input {...field} type="number" placeholder={t('admissionApply.yearPlaceholder')} size="large" aria-label={t('admissionApply.yearCompleted')} />}
                  />
                </Form.Item>
              </Col>
              {(() => {
                const qual = form2.watch('highestQualification')?.toUpperCase()
                const showCgpa = ['DIPLOMA', 'DEGREE', 'MASTERS'].includes(qual ?? '')
                return showCgpa ? (
                  <Col xs={24} md={12}>
                    <Form.Item
                      label={<RequiredLabel>{t('admissionApply.cgpa')}</RequiredLabel>}
                      {...fe(form2.formState.errors.cgpa?.message)}
                      extra={form2.formState.errors.cgpa ? undefined : 'Enter a value between 0.00 and 4.00 (2 decimal places)'}
                    >
                      <Controller name="cgpa" control={form2.control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            placeholder="e.g. 3.50"
                            size="large"
                            type="text"
                            inputMode="decimal"
                            maxLength={4}
                            status={form2.formState.errors.cgpa ? 'error' : undefined}
                            aria-label="CGPA / Grade"
                            aria-describedby={form2.formState.errors.cgpa ? 'cgpa-error' : undefined}
                            onBlur={(e) => {
                              const raw = e.target.value.trim()
                              if (raw !== '') {
                                const num = parseFloat(raw)
                                if (!isNaN(num)) {
                                  const clamped = Math.min(Math.max(num, 0), 4)
                                  field.onChange(clamped.toFixed(2))
                                }
                              }
                              field.onBlur()
                            }}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                field.onChange(val)
                              }
                            }}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                ) : null
              })()}
            </Row>
            <div className={styles.formActions}>
              <Space>
                <Button size="large" onClick={() => setStep(0)}>{t('admissionApply.backBtn')}</Button>
                <Button type="primary" htmlType="submit" size="large">{t('admissionApply.nextProgramme')}</Button>
              </Space>
            </div>
          </Form>
        </Card>
      )}

      {/* ── Step 3: Programme Choice ──────────────────────────── */}
      {step === 2 && (
        <Card title={t('admissionApply.step3Title')}>
          <Form layout="vertical" onFinish={handleNext3} requiredMark={false}>
            <Row gutter={[16, 0]}>
              <Col xs={24}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.selectIntake')}</RequiredLabel>} {...fe(form3.formState.errors.intakeId?.message)}>
                  <Controller name="intakeId" control={form3.control}
                    render={({ field }) => (
                      <Select {...field} size="large" showSearch optionFilterProp="label"
                        placeholder={t('admissionApply.intakePlaceholder')}
                        options={intakes.map(i => ({
                          value: i.id,
                          label: `${i.programme.name} (${i.programme.code}) — ${i.semester.name}`,
                        }))}
                        onChange={val => {
                          field.onChange(val)
                          const found = intakes.find(i => i.id === val)
                          if (found) form3.setValue('programmeId', found.programme.id)
                        }}
                        aria-label={t('admissionApply.selectIntake')}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<RequiredLabel>{t('admissionApply.modeStudy')}</RequiredLabel>} {...fe(form3.formState.errors.modeOfStudy?.message)}>
                  <Controller name="modeOfStudy" control={form3.control}
                    render={({ field }) => (
                      <Select {...field} size="large" placeholder={t('admissionApply.selectMode')}
                        options={[{ value: 'full_time', label: t('admissionApply.fullTime') }, { value: 'part_time', label: t('admissionApply.partTime') }]}
                        aria-label={t('admissionApply.modeStudy')}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item>
                  <Controller name="scholarshipApplied" control={form3.control}
                    render={({ field }) => (
                      <Checkbox checked={!!field.value} onChange={e => field.onChange(e.target.checked)}>
                        {t('admissionApply.scholarship')}
                      </Checkbox>
                    )}
                  />
                </Form.Item>
              </Col>
              {form3.watch('scholarshipApplied') && (
                <Col xs={24} md={12}>
                  <Form.Item label={t('admissionApply.scholarshipType')}>
                    <Controller name="scholarshipType" control={form3.control}
                      render={({ field }) => <Input {...field} placeholder={t('admissionApply.scholarshipPlaceholder')} size="large" aria-label={t('admissionApply.scholarshipType')} />}
                    />
                  </Form.Item>
                </Col>
              )}
            </Row>
            <div className={styles.formActions}>
              <Space>
                <Button size="large" onClick={() => setStep(1)}>{t('admissionApply.backBtn')}</Button>
                <Button type="primary" htmlType="submit" size="large">{t('admissionApply.reviewSubmit')}</Button>
              </Space>
            </div>
          </Form>
        </Card>
      )}

      {/* ── Step 4: Review ────────────────────────────────────── */}
      {step === 3 && (
        <Card title={t('admissionApply.step4Title')}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Descriptions title={t('admissionApply.personalInfo')} column={1} size="small" bordered>
                <Descriptions.Item label={t('admissionApply.reviewFullName')}>{formData.fullName}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewIC')}>{formData.icPassport}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewDOB')}>{formData.dateOfBirth}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewGender')}>{formData.gender}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewNationality')}>{formData.nationality}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewEmail')}>{formData.email}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewMobile')}>{formData.mobile}</Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Descriptions title={t('admissionApply.academicBg')} column={1} size="small" bordered>
                <Descriptions.Item label={t('admissionApply.reviewQual')}>
                  {QUAL_OPTIONS.find(q => q.value === formData.highestQualification)?.label}
                </Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewInstitution')}>{formData.previousInstitution}</Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewYear')}>{formData.yearOfCompletion}</Descriptions.Item>
                {formData.cgpa && <Descriptions.Item label={t('admissionApply.reviewCGPA')}>{formData.cgpa}</Descriptions.Item>}
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Descriptions title={t('admissionApply.programmeLabel')} column={1} size="small" bordered>
                <Descriptions.Item label={t('admissionApply.reviewIntake')}>
                  {selectedIntake ? `${selectedIntake.programme.name} — ${selectedIntake.semester.name}` : ''}
                </Descriptions.Item>
                <Descriptions.Item label={t('admissionApply.reviewMode')}>
                  {formData.modeOfStudy === 'full_time' ? t('admissionApply.fullTime') : t('admissionApply.partTime')}
                </Descriptions.Item>
                {formData.scholarshipApplied && (
                  <Descriptions.Item label={t('admissionApply.reviewScholarship')}>{formData.scholarshipType ?? t('admissionApply.applied')}</Descriptions.Item>
                )}
              </Descriptions>
            </Col>
          </Row>
          <Alert
            style={{ margin: '20px 0 16px' }}
            type="info"
            message={t('admissionApply.declarationTitle')}
            description={t('admissionApply.declaration')}
            showIcon
          />
          {submitErrorMsg && (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              message={t('admissionApply.submissionFailed', { defaultValue: 'Submission Failed' })}
              description={submitErrorMsg}
              showIcon
              closable
              onClose={() => submitMutation.reset()}
            />
          )}
          <div className={styles.formActions}>
            <Space>
              <Button size="large" onClick={() => setStep(2)}>{t('admissionApply.backBtn')}</Button>
              <Button type="primary" size="large" loading={submitMutation.isPending}
                icon={<CheckCircleOutlined />} onClick={handleSubmit}>
                {t('admissionApply.submitApplication')}
              </Button>
            </Space>
          </div>
        </Card>
      )}
    </div>
  )
}

export default AdmissionApplyPage
