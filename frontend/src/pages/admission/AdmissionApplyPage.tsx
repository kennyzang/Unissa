import { useTranslation } from 'react-i18next'
import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  UploadOutlined, FilePdfOutlined, FileWordOutlined, FileImageOutlined,
  DeleteOutlined, EyeOutlined, PaperClipOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import styles from './AdmissionApplyPage.module.scss'

const { Title, Text } = Typography
const { Option } = Select

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

  useEffect(() => {
    if (!isLoading && profile) {
      navigate('/student/profile', { replace: true })
    }
  }, [isLoading, profile, navigate])

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
              {t('nav.courseSelection', { defaultValue: 'Course Selection' })}
            </Button>
            <Button size="small" onClick={() => navigate('/finance/statement')}>
              {t('nav.myPayment', { defaultValue: 'My Payment' })}
            </Button>
            <Button size="small" onClick={() => navigate('/student/profile')}>
              {t('nav.myInfo', { defaultValue: 'My Info' })}
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
  cgpa: z.preprocess(
    val => (val === undefined || val === null || val === '') ? undefined : String(val),
    z.string()
      .optional()
      .refine(
        val => val === undefined || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 4),
        { message: 'CGPA must be between 0.00 and 4.00' }
      )
      .refine(
        val => val === undefined || /^\d+\.\d{2}$/.test(val) || /^\d+$/.test(val),
        { message: 'CGPA must have exactly 2 decimal places' }
      )
  ),
}).refine(
  data => {
    const qual = data.highestQualification?.toUpperCase()
    return !['DIPLOMA', 'DEGREE', 'MASTERS'].includes(qual ?? '') || (data.cgpa !== undefined && data.cgpa.trim() !== '')
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
  const navigate = useNavigate()
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ['admissions', app.id, 'documents'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/admissions/${app.id}/documents`)
      return data.data
    },
    enabled: !!app.id,
  })

  const statusColor: Record<string, string> = {
    submitted: 'blue', under_review: 'orange', waitlisted: 'purple',
    rejected: 'red', offered: 'green', accepted: 'green', auto_check_failed: 'red',
  }

  const QUAL_LABELS: Record<string, string> = {
    O_LEVEL: 'O-Level / BGCE', A_LEVEL: 'A-Level / STPM',
    DIPLOMA: 'Diploma', DEGREE: 'Bachelor Degree', MASTERS: 'Masters Degree',
    o_level: 'O-Level / BGCE', a_level: 'A-Level / STPM',
    diploma: 'Diploma', degree: 'Bachelor Degree', masters: 'Masters Degree',
  }

  const DOC_TYPE_LABELS: Record<string, string> = {
    transcript: t('admissionApply.docTypeTranscript', { defaultValue: 'Academic Transcript' }),
    ic_passport: t('admissionApply.docTypeIcPassport', { defaultValue: 'IC / Passport' }),
    passport_photo: t('admissionApply.docTypePassportPhoto', { defaultValue: 'Passport Photo' }),
    supporting: t('admissionApply.docTypeSupporting', { defaultValue: 'Supporting Document' }),
  }

  const handlePreview = (doc: any) => {
    if (doc.asset?.fileUrl) {
      if (doc.asset?.mimeType?.startsWith('image/')) {
        setPreviewImage({ url: doc.asset.fileUrl, name: doc.asset.originalName || doc.asset.fileName })
      } else {
        window.open(doc.asset.fileUrl, '_blank')
      }
    }
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

  const resubmitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiClient.patch(`/admissions/${app.id}/resubmit`, payload),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message ?? t('admissionApply.resubmitted', { defaultValue: 'Application resubmitted successfully!' }) })
      qc.invalidateQueries({ queryKey: ['admissions', 'my-application'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'kpi'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? t('admissionApply.resubmitFailed', { defaultValue: 'Failed to resubmit application. Please try again.' }) })
    },
  })

  const isOffered = app.status === 'offered'
  const isAccepted = app.status === 'accepted'
  const isRejected = app.status === 'rejected'

  const handleResubmit = () => {
    console.log('Resubmit button clicked')
    console.log('App data:', app)
    // Use app.id as fallback if userId is not available
    const key = app.userId ? `admission-apply-resubmit-${app.userId}` : 'admission-apply-resubmit'
    console.log('SessionStorage key:', key)
    sessionStorage.setItem(key, JSON.stringify(app))
    console.log('SessionStorage set successfully')
    console.log('Navigating to /admission/apply')
    navigate('/admission/apply')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('admissionApply.title')}</h1>
        <p className={styles.pageSub}>
          {isOffered
            ? t('admissionApply.offerReadyNote', { defaultValue: 'Your application has been approved. Please review and accept your offer below.' })
            : isAccepted
              ? t('admissionApply.enrolledNote', { defaultValue: 'You have accepted your offer. Welcome to UNISSA!' })
              : isRejected
                ? t('admissionApply.rejectedNote', { defaultValue: 'Thank you for your application to UNISSA.' })
                : t('admissionApply.pendingNote', { defaultValue: 'Your application is being reviewed.' })
          }
        </p>
      </div>

      {/* Acceptance / Rejection notification banner */}
      {isOffered && (
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
            background: isOffered || isAccepted ? '#e8f5e9' : isRejected ? '#fff1f0' : '#fffbe6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {isOffered || isAccepted
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

        {/* Uploaded Documents */}
        {documents.length > 0 && (
          <Col xs={24} style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('admissionApply.uploadedDocuments', { defaultValue: 'Uploaded Documents' })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {documents.map((doc: any) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                  onClick={() => handlePreview(doc)}
                >
                  {doc.asset?.mimeType?.startsWith('image/') ? (
                    <FileImageOutlined style={{ color: '#2e7d32', fontSize: 18 }} />
                  ) : doc.asset?.mimeType === 'application/pdf' ? (
                    <FilePdfOutlined style={{ color: '#e53935', fontSize: 18 }} />
                  ) : (
                    <FileTextOutlined style={{ color: '#1565c0', fontSize: 18 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.asset?.originalName || doc.asset?.fileName}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{DOC_TYPE_LABELS[doc.docType] || doc.docType}</div>
                  </div>
                  <EyeOutlined style={{ color: '#1890ff', fontSize: 14, marginLeft: 4 }} />
                </div>
              ))}
            </div>
          </Col>
        )}

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

        {/* Bottom resubmit button for rejected state */}
        {isRejected && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              loading={resubmitMutation.isPending}
              onClick={handleResubmit}
              style={{ background: '#1890ff', borderColor: '#1890ff', fontWeight: 600, minWidth: 200 }}
            >
              {t('admissionApply.resubmitApplication', { defaultValue: 'Resubmit Application' })}
            </Button>
          </div>
        )}
      </Card>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              }}
              onClick={e => e.stopPropagation()}
            />
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                color: 'white',
                fontSize: 14,
                fontWeight: 500,
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              {previewImage.name}
            </div>
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: -40,
                left: 0,
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 18,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Document upload types & helpers ──────────────────────────────────────────
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/jpg', 'image/png']
const ALLOWED_DOC_EXTS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

interface UploadFileItem {
  id: string
  file: File
  docType: string
  progress: number   // 0–100
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

const DOC_TYPE_OPTIONS = [
  { value: 'transcript',      label: 'Academic Transcript' },
  { value: 'ic_passport',     label: 'IC / Passport' },
  { value: 'passport_photo',  label: 'Passport Photo' },
  { value: 'supporting',      label: 'Supporting Document' },
]

function fileIcon(mime: string) {
  if (mime === 'application/pdf') return <FilePdfOutlined style={{ color: '#e53935' }} />
  if (mime.includes('word')) return <FileWordOutlined style={{ color: '#1565c0' }} />
  if (mime.startsWith('image/')) return <FileImageOutlined style={{ color: '#2e7d32' }} />
  return <PaperClipOutlined />
}

function fmtBytes(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`
}

// ── Document Upload Section (used inside Review step) ─────────────────────────
interface DocumentUploadSectionProps {
  files: UploadFileItem[]
  onAdd: (items: UploadFileItem[]) => void
  onRemove: (id: string) => void
  onTypeChange: (id: string, docType: string) => void
  onPreview: (item: UploadFileItem) => void
  disabled?: boolean
}

const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  files, onAdd, onRemove, onTypeChange, onPreview, disabled,
}) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [validationError, setValidationError] = useState('')

  const validateAndAdd = useCallback((rawFiles: File[]) => {
    setValidationError('')
    const items: UploadFileItem[] = []
    const errors: string[] = []
    for (const f of rawFiles) {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
      const typeOk = ALLOWED_DOC_TYPES.includes(f.type) || ALLOWED_DOC_EXTS.includes(ext)
      if (!typeOk) { errors.push(`"${f.name}" — unsupported format`); continue }
      if (f.size > MAX_FILE_SIZE_BYTES) { errors.push(`"${f.name}" — exceeds 10 MB`); continue }
      items.push({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f, docType: 'supporting', progress: 0, status: 'pending' })
    }
    if (errors.length) setValidationError(errors.join(' · '))
    if (items.length) onAdd(items)
  }, [onAdd])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAdd(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    validateAndAdd(Array.from(e.dataTransfer.files))
  }

  return (
    <div className={styles.docUploadSection}>
      <div
        className={`${styles.docDropZone} ${dragOver ? styles.docDropZoneOver : ''} ${disabled ? styles.docDropZoneDisabled : ''}`}
        onDragOver={e => { e.preventDefault(); !disabled && setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_DOC_EXTS.join(',')}
          onChange={handleInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        <UploadOutlined style={{ fontSize: 28, color: '#1677ff' }} />
        <div className={styles.docDropText}>
          {t('admissionApply.docDropTitle', { defaultValue: 'Click or drag files here to upload' })}
        </div>
        <div className={styles.docDropHint}>
          {t('admissionApply.docDropHint', { defaultValue: 'PDF, Word, JPG, PNG · Max 10 MB per file' })}
        </div>
      </div>

      {validationError && (
        <div className={styles.docValidationError}>
          ⚠ {validationError}
        </div>
      )}

      {files.length > 0 && (
        <div className={styles.docFileList}>
          {files.map(item => (
            <div key={item.id} className={styles.docFileItem}>
              <div className={styles.docFileIcon}>{fileIcon(item.file.type)}</div>
              <div className={styles.docFileInfo}>
                <div className={styles.docFileName}>{item.file.name}</div>
                <div className={styles.docFileMeta}>{fmtBytes(item.file.size)}</div>
                {/* Progress bar */}
                {(item.status === 'uploading' || item.status === 'done') && (
                  <div className={styles.docProgressBar}>
                    <div
                      className={`${styles.docProgressFill} ${item.status === 'done' ? styles.docProgressDone : ''}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <div className={styles.docFileError}>{item.error}</div>
                )}
              </div>
              <Select
                className={styles.docTypeSelect}
                value={item.docType}
                onChange={value => onTypeChange(item.id, value)}
                disabled={disabled || item.status === 'uploading'}
              >
                {DOC_TYPE_OPTIONS.map(o => (
                  <Option key={o.value} value={o.value}>{o.label}</Option>
                ))}
              </Select>
              <div className={styles.docFileActions}>
                {item.file.type.startsWith('image/') && (
                  <button
                    type="button"
                    className={styles.docActionBtn}
                    onClick={() => onPreview(item)}
                    title="Preview"
                  >
                    <EyeOutlined />
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.docActionBtn} ${styles.docDeleteBtn}`}
                  onClick={() => onRemove(item.id)}
                  disabled={disabled || item.status === 'uploading'}
                  title="Remove"
                >
                  <DeleteOutlined />
                </button>
              </div>
              {item.status === 'done' && (
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18, flexShrink: 0 }} />
              )}
              {item.status === 'uploading' && (
                <LoadingOutlined style={{ color: '#1677ff', fontSize: 18, flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      )}
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
        if (e?.response?.status === 404) return null
        throw e
      }
    },
    retry: false,
    throwOnError: false,
  })

  const { data: myApplication, isLoading: appLoading } = useQuery<any>({
    queryKey: ['admissions', 'my-application', user?.id],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/admissions/my-application')
        return data.data ?? null
      } catch (e: any) {
        if (e?.response?.status === 404) return null
        throw e
      }
    },
    retry: false,
    throwOnError: false,
    enabled: !studentLoading && !studentProfile,
    refetchInterval: 8000,
  })

  const [step, setStep]           = useState(() => {
    const saved = sessionStorage.getItem(`admission-apply-step-${user?.id}`)
    return saved ? Number(saved) : 0
  })
  const [submitted, setSubmitted] = useState<{ applicationRef: string; autoCheckPassed: boolean } | null>(null)
  const [checkStep, setCheckStep] = useState(0)
  const [formData, setFormData]   = useState<Partial<Step1 & Step2 & Step3>>(() => {
    try {
      const saved = sessionStorage.getItem(`admission-apply-form-${user?.id}`)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [resubmitData, setResubmitData] = useState<any | null>(null)
  const [docFiles, setDocFiles] = useState<UploadFileItem[]>([])
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const addToast                  = useUIStore(s => s.addToast)
  const qc                        = useQueryClient()

  const handleDocAdd = (items: UploadFileItem[]) => setDocFiles(p => [...p, ...items])
  const handleDocRemove = (id: string) => setDocFiles(p => p.filter(f => f.id !== id))
  const handleDocTypeChange = (id: string, docType: string) =>
    setDocFiles(p => p.map(f => f.id === id ? { ...f, docType } : f))
  const handleDocPreview = (item: UploadFileItem) => {
    const url = URL.createObjectURL(item.file)
    setPreviewSrc(url)
  }

  const uploadDocuments = async (applicantId: string) => {
    const pending = docFiles.filter(f => f.status === 'pending')
    if (!pending.length) return

    for (const item of pending) {
      setDocFiles(p => p.map(f => f.id === item.id ? { ...f, status: 'uploading', progress: 10 } : f))
      const fd = new FormData()
      fd.append('files', item.file)
      fd.append('docTypes', item.docType)
      try {
        // Simulate gradual progress
        setDocFiles(p => p.map(f => f.id === item.id ? { ...f, progress: 50 } : f))
        await apiClient.post(`/admissions/${applicantId}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (ev) => {
            if (ev.total) {
              const pct = Math.round((ev.loaded / ev.total) * 100)
              setDocFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: pct } : f))
            }
          },
        })
        setDocFiles(p => p.map(f => f.id === item.id ? { ...f, status: 'done', progress: 100 } : f))
      } catch (e: any) {
        setDocFiles(p => p.map(f => f.id === item.id ? { ...f, status: 'error', error: e.response?.data?.message ?? 'Upload failed' } : f))
      }
    }
  }

  useEffect(() => {
    if (user?.id) {
      sessionStorage.setItem(`admission-apply-step-${user.id}`, String(step))
    }
  }, [step, user?.id])

  useEffect(() => {
    if (user?.id) {
      sessionStorage.setItem(`admission-apply-form-${user.id}`, JSON.stringify(formData))
    }
  }, [formData, user?.id])

  useEffect(() => {
    if (submitted && user?.id) {
      sessionStorage.removeItem(`admission-apply-step-${user.id}`)
      sessionStorage.removeItem(`admission-apply-form-${user.id}`)
      sessionStorage.removeItem(`admission-apply-resubmit-${user.id}`)
    }
  }, [submitted, user?.id])

  useEffect(() => {
    try {
      // Try to get resubmit data with user ID
      let resubmit = sessionStorage.getItem(`admission-apply-resubmit-${user?.id}`)
      
      // Fallback: try without user ID for backward compatibility
      if (!resubmit) {
        resubmit = sessionStorage.getItem('admission-apply-resubmit')
      }
      
      if (resubmit) {
        const app = JSON.parse(resubmit)
        setResubmitData(app)
        setFormData({
          fullName: app.fullName,
          icPassport: app.icPassport,
          dateOfBirth: app.dateOfBirth ? dayjs(app.dateOfBirth).format('YYYY-MM-DD') : '',
          gender: app.gender,
          nationality: app.nationality,
          email: app.email,
          mobile: app.mobile,
          homeAddress: app.homeAddress,
          highestQualification: app.highestQualification,
          previousInstitution: app.previousInstitution,
          yearOfCompletion: String(app.yearOfCompletion),
          cgpa: app.cgpa ? String(app.cgpa) : '',
          programmeId: app.programmeId,
          intakeId: app.intakeId,
          modeOfStudy: app.modeOfStudy,
          scholarshipApplied: app.scholarshipApplied,
          scholarshipType: app.scholarshipType,
        })
        setStep(0)
      }
    } catch (e) {
      console.error('Failed to load resubmit data:', e)
    }
  }, [user?.id])

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

  const { data: intakes = [], isLoading: intakesLoading } = useQuery<IntakeOption[]>({
    queryKey: ['admissions', 'intakes'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admissions/intakes')
      return data.data
    },
    throwOnError: false,
  })

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiClient.post('/admissions/apply', payload),
    onSuccess: async (res) => {
      const applicantId: string = res.data.data.id
      if (docFiles.some(f => f.status === 'pending')) {
        await uploadDocuments(applicantId)
      }
      setSubmitted({
        applicationRef: res.data.data.applicationRef,
        autoCheckPassed: res.data.autoCheckPassed ?? true,
      })
      // Warm the cache so PendingApplicationCard renders immediately after animation
      qc.setQueryData(['admissions', 'my-application'], res.data.data)
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('admissionApply.submissionFailed') }),
  })

  const resubmitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiClient.patch(`/admissions/${resubmitData?.id}/resubmit`, payload),
    onSuccess: async (res) => {
      const applicantId: string = resubmitData?.id ?? res.data.data.id
      if (docFiles.some(f => f.status === 'pending')) {
        await uploadDocuments(applicantId)
      }
      setSubmitted({
        applicationRef: res.data.data.applicationRef,
        autoCheckPassed: res.data.autoCheckPassed ?? true,
      })
      qc.setQueryData(['admissions', 'my-application'], res.data.data)
      setResubmitData(null)
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('admissionApply.submissionFailed') }),
  })

  const submitErrorMsg: string | null = submitMutation.isError || resubmitMutation.isError
    ? ((resubmitMutation.error ?? submitMutation.error) as any)?.response?.data?.message ?? t('admissionApply.submissionFailed')
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
  const handleSubmit = () => {
    if (resubmitData) {
      resubmitMutation.mutate({ ...formData })
    } else {
      submitMutation.mutate({ ...formData })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          {resubmitData
            ? t('admissionApply.resubmitTitle', { defaultValue: 'Resubmit Admission Application' })
            : t('admissionApply.title')
          }
        </h1>
        <p className={styles.pageSub}>
          {resubmitData
            ? t('admissionApply.resubmitSubtitle', { defaultValue: 'Update your application details and resubmit for review.' })
            : t('admissionApply.subtitle')
          }
        </p>
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

      {/* Image preview modal */}
      {previewSrc && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setPreviewSrc(null); URL.revokeObjectURL(previewSrc) }}
        >
          <img src={previewSrc} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }} />
        </div>
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
          {/* Supporting Documents */}
          <Col xs={24} style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <PaperClipOutlined style={{ marginRight: 5 }} />
              {t('admissionApply.supportingDocuments', { defaultValue: 'Supporting Documents' })}
              <span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                {t('admissionApply.documentsOptional', { defaultValue: '(Optional — PDF, Word, JPG · Max 10 MB each)' })}
              </span>
            </div>
            <DocumentUploadSection
              files={docFiles}
              onAdd={handleDocAdd}
              onRemove={handleDocRemove}
              onTypeChange={handleDocTypeChange}
              onPreview={handleDocPreview}
              disabled={submitMutation.isPending || resubmitMutation.isPending}
            />
          </Col>

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
