import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Steps, Form, Input, Select, DatePicker, Checkbox,
  Button, Card, Row, Col, Descriptions, Alert, Space,
} from 'antd'
import {
  CheckCircleOutlined, UserOutlined, BookOutlined,
  TrophyOutlined, FileTextOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { Typography } from 'antd'
import styles from './AdmissionApplyPage.module.scss'

const { Title, Text } = Typography

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
  cgpa:                 z.string().optional(),
})

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


// Helper: antd Form.Item status/help from error message
const fe = (msg?: string) => ({
  validateStatus: msg ? ('error' as const) : ('' as const),
  help: msg ?? '',
})

const AdmissionApplyPage: React.FC = () => {
  const { t } = useTranslation()
  const [step, setStep]           = useState(0)

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
  const [submitted, setSubmitted] = useState<{ applicationRef: string } | null>(null)
  const [formData, setFormData]   = useState<Partial<Step1 & Step2 & Step3>>({})
  const addToast                  = useUIStore(s => s.addToast)

  const { data: intakes = [] } = useQuery<IntakeOption[]>({
    queryKey: ['admissions', 'intakes'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admissions/intakes')
      return data.data
    },
  })

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiClient.post('/admissions/apply', payload),
    onSuccess: (res) => setSubmitted({ applicationRef: res.data.data.applicationRef }),
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('admissionApply.submissionFailed') }),
  })

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema), defaultValues: { ...formData as Step1, nationality: (formData as Step1)?.nationality || 'Brunei Darussalam' } })
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema), defaultValues: formData as Step2 })
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema), defaultValues: formData as Step3 })

  const handleNext1 = form1.handleSubmit(data => { setFormData(p => ({ ...p, ...data })); setStep(1) })
  const handleNext2 = form2.handleSubmit(data => { setFormData(p => ({ ...p, ...data })); setStep(2) })
  const handleNext3 = form3.handleSubmit(data => { setFormData(p => ({ ...p, ...data })); setStep(3) })
  const handleSubmit = () => submitMutation.mutate({ ...formData })

  const selectedIntake = intakes.find(i => i.id === formData.intakeId)

  if (submitted) {
    return (
      <div className={styles.successWrap}>
        <Card className={styles.successCard}>
          <div className={styles.successIcon}><CheckCircleOutlined style={{ fontSize: 48, color: '#00B42A' }} /></div>
          <Title level={3} style={{ margin: 0 }}>{t('admissionApply.successTitle')}</Title>
          <Text type="secondary">{t('admissionApply.successRef')}</Text>
          <div className={styles.refNo}>{submitted.applicationRef}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('admissionApply.successNote')} <strong>{formData.email}</strong>.
          </Text>
          <Button type="primary" onClick={() => { setStep(0); setSubmitted(null); setFormData({}) }}>
            {t('admissionApply.submitAnother')}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('admissionApply.title')}</h1>
        <p className={styles.pageSub}>{t('admissionApply.subtitle')}</p>
      </div>

      {/* Steps indicator */}
      <Card className={styles.stepperCard} size="small">
        <Steps current={step} items={STEPS} responsive={false} size="small" labelPlacement="vertical" />
      </Card>

      {/* ── Step 1: Personal Info ─────────────────────────────── */}
      {step === 0 && (
        <Card title={t('admissionApply.step1Title')}>
          <Form layout="vertical" onFinish={handleNext1} requiredMark="optional">
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.fullName')} required {...fe(form1.formState.errors.fullName?.message)}>
                  <Controller name="fullName" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.fullNamePlaceholder')} size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.icPassport')} required {...fe(form1.formState.errors.icPassport?.message)}>
                  <Controller name="icPassport" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.icPassportPlaceholder')} size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.dob')} required {...fe(form1.formState.errors.dateOfBirth?.message)}>
                  <Controller name="dateOfBirth" control={form1.control}
                    render={({ field }) => (
                      <DatePicker
                        style={{ width: '100%' }}
                        size="large"
                        value={field.value ? dayjs(field.value) : null}
                        onChange={d => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                        format="DD/MM/YYYY"
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.gender')} required {...fe(form1.formState.errors.gender?.message)}>
                  <Controller name="gender" control={form1.control}
                    render={({ field }) => (
                      <Select {...field} size="large" placeholder={t('admissionApply.selectGender')}
                        options={[{ value: 'male', label: t('admissionApply.male') }, { value: 'female', label: t('admissionApply.female') }]}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.nationality')} required {...fe(form1.formState.errors.nationality?.message)}>
                  <Controller name="nationality" control={form1.control}
                    render={({ field }) => <Input {...field} size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.email')} required {...fe(form1.formState.errors.email?.message)}>
                  <Controller name="email" control={form1.control}
                    render={({ field }) => <Input {...field} type="email" placeholder={t('admissionApply.emailPlaceholder')} size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.mobile')} required {...fe(form1.formState.errors.mobile?.message)}>
                  <Controller name="mobile" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.mobilePlaceholder')} size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label={t('admissionApply.address')} required {...fe(form1.formState.errors.homeAddress?.message)}>
                  <Controller name="homeAddress" control={form1.control}
                    render={({ field }) => <Input.TextArea {...field} rows={2} placeholder={t('admissionApply.addressPlaceholder')} />}
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
          <Form layout="vertical" onFinish={handleNext2} requiredMark="optional">
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.qualification')} required {...fe(form2.formState.errors.highestQualification?.message)}>
                  <Controller name="highestQualification" control={form2.control}
                    render={({ field }) => (
                      <Select {...field} size="large" options={QUAL_OPTIONS} placeholder={t('admissionApply.selectQualification')} />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.prevInstitution')} required {...fe(form2.formState.errors.previousInstitution?.message)}>
                  <Controller name="previousInstitution" control={form2.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.institutionPlaceholder')} size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.yearCompleted')} required {...fe(form2.formState.errors.yearOfCompletion?.message)}>
                  <Controller name="yearOfCompletion" control={form2.control}
                    render={({ field }) => <Input {...field} type="number" placeholder={t('admissionApply.yearPlaceholder')} size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.cgpa')} {...fe(form2.formState.errors.cgpa?.message)}>
                  <Controller name="cgpa" control={form2.control}
                    render={({ field }) => <Input {...field} placeholder={t('admissionApply.cgpaPlaceholder')} size="large" />}
                  />
                </Form.Item>
              </Col>
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
          <Form layout="vertical" onFinish={handleNext3} requiredMark="optional">
            <Row gutter={[16, 0]}>
              <Col xs={24}>
                <Form.Item label={t('admissionApply.selectIntake')} required {...fe(form3.formState.errors.intakeId?.message)}>
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
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('admissionApply.modeStudy')} required {...fe(form3.formState.errors.modeOfStudy?.message)}>
                  <Controller name="modeOfStudy" control={form3.control}
                    render={({ field }) => (
                      <Select {...field} size="large" placeholder={t('admissionApply.selectMode')}
                        options={[{ value: 'full_time', label: t('admissionApply.fullTime') }, { value: 'part_time', label: t('admissionApply.partTime') }]}
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
                      render={({ field }) => <Input {...field} placeholder={t('admissionApply.scholarshipPlaceholder')} size="large" />}
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
