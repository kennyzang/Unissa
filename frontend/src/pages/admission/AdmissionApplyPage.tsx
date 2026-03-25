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
  fullName:    z.string().min(3, 'Full name required'),
  icPassport:  z.string().min(6, 'IC/Passport required'),
  dateOfBirth: z.string().min(1, 'Date of birth required'),
  gender:      z.enum(['male', 'female'], { required_error: 'Gender required' }),
  nationality: z.string().min(2, 'Nationality required'),
  email:       z.string().email('Valid email required'),
  mobile:      z.string().min(7, 'Mobile required'),
  homeAddress: z.string().min(5, 'Address required'),
})

const step2Schema = z.object({
  highestQualification: z.string().min(1, 'Qualification required'),
  previousInstitution:  z.string().min(2, 'Institution required'),
  yearOfCompletion:     z.string().min(4, 'Year required'),
  cgpa:                 z.string().optional(),
})

const step3Schema = z.object({
  programmeId:        z.string().min(1, 'Programme required'),
  intakeId:           z.string().min(1, 'Intake required'),
  modeOfStudy:        z.enum(['full_time', 'part_time'], { required_error: 'Mode required' }),
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

const STEPS = [
  { title: 'Personal Info',       icon: <UserOutlined /> },
  { title: 'Academic Background', icon: <BookOutlined /> },
  { title: 'Programme Choice',    icon: <TrophyOutlined /> },
  { title: 'Review & Submit',     icon: <FileTextOutlined /> },
]

const QUAL_OPTIONS = [
  { value: 'O_LEVEL', label: 'O-Level / BGCE' },
  { value: 'A_LEVEL', label: 'A-Level / STPM' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'DEGREE',  label: 'Bachelor Degree' },
  { value: 'MASTERS', label: 'Masters Degree' },
]

// Helper: antd Form.Item status/help from error message
const fe = (msg?: string) => ({
  validateStatus: msg ? ('error' as const) : ('' as const),
  help: msg ?? '',
})

const AdmissionApplyPage: React.FC = () => {
  const [step, setStep]           = useState(0)
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
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Submission failed' }),
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
          <Title level={3} style={{ margin: 0 }}>Application Submitted!</Title>
          <Text type="secondary">Your application reference number is:</Text>
          <div className={styles.refNo}>{submitted.applicationRef}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            We will review your application within 5–7 working days.
            You will receive an email at <strong>{formData.email}</strong>.
          </Text>
          <Button type="primary" onClick={() => { setStep(0); setSubmitted(null); setFormData({}) }}>
            Submit Another Application
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Student Admission Application</h1>
        <p className={styles.pageSub}>UNISSA Online Admission Portal — AY 2026/2027</p>
      </div>

      {/* Steps indicator */}
      <Card className={styles.stepperCard} size="small">
        <Steps current={step} items={STEPS} responsive={false} size="small" labelPlacement="vertical" />
      </Card>

      {/* ── Step 1: Personal Info ─────────────────────────────── */}
      {step === 0 && (
        <Card title="Step 1 – Personal Information">
          <Form layout="vertical" onFinish={handleNext1} requiredMark="optional">
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label="Full Name (as per IC/Passport)" required {...fe(form1.formState.errors.fullName?.message)}>
                  <Controller name="fullName" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder="Your full legal name" size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="IC / Passport Number" required {...fe(form1.formState.errors.icPassport?.message)}>
                  <Controller name="icPassport" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder="e.g. 00-123456" size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Date of Birth" required {...fe(form1.formState.errors.dateOfBirth?.message)}>
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
                <Form.Item label="Gender" required {...fe(form1.formState.errors.gender?.message)}>
                  <Controller name="gender" control={form1.control}
                    render={({ field }) => (
                      <Select {...field} size="large" placeholder="Select gender"
                        options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Nationality" required {...fe(form1.formState.errors.nationality?.message)}>
                  <Controller name="nationality" control={form1.control}
                    render={({ field }) => <Input {...field} size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Email Address" required {...fe(form1.formState.errors.email?.message)}>
                  <Controller name="email" control={form1.control}
                    render={({ field }) => <Input {...field} type="email" placeholder="your@email.com" size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Mobile Number" required {...fe(form1.formState.errors.mobile?.message)}>
                  <Controller name="mobile" control={form1.control}
                    render={({ field }) => <Input {...field} placeholder="+673 xxxxxxx" size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="Home Address" required {...fe(form1.formState.errors.homeAddress?.message)}>
                  <Controller name="homeAddress" control={form1.control}
                    render={({ field }) => <Input.TextArea {...field} rows={2} placeholder="Full home address" />}
                  />
                </Form.Item>
              </Col>
            </Row>
            <div className={styles.formActions}>
              <Button type="primary" htmlType="submit" size="large">
                Next: Academic Background →
              </Button>
            </div>
          </Form>
        </Card>
      )}

      {/* ── Step 2: Academic Background ──────────────────────── */}
      {step === 1 && (
        <Card title="Step 2 – Academic Background">
          <Form layout="vertical" onFinish={handleNext2} requiredMark="optional">
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label="Highest Qualification" required {...fe(form2.formState.errors.highestQualification?.message)}>
                  <Controller name="highestQualification" control={form2.control}
                    render={({ field }) => (
                      <Select {...field} size="large" options={QUAL_OPTIONS} placeholder="Select qualification" />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Previous Institution" required {...fe(form2.formState.errors.previousInstitution?.message)}>
                  <Controller name="previousInstitution" control={form2.control}
                    render={({ field }) => <Input {...field} placeholder="Name of institution" size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Year of Completion" required {...fe(form2.formState.errors.yearOfCompletion?.message)}>
                  <Controller name="yearOfCompletion" control={form2.control}
                    render={({ field }) => <Input {...field} type="number" placeholder="e.g. 2024" size="large" />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="CGPA / Grade (if applicable)" {...fe(form2.formState.errors.cgpa?.message)}>
                  <Controller name="cgpa" control={form2.control}
                    render={({ field }) => <Input {...field} placeholder="e.g. 3.75" size="large" />}
                  />
                </Form.Item>
              </Col>
            </Row>
            <div className={styles.formActions}>
              <Space>
                <Button size="large" onClick={() => setStep(0)}>← Back</Button>
                <Button type="primary" htmlType="submit" size="large">Next: Programme Choice →</Button>
              </Space>
            </div>
          </Form>
        </Card>
      )}

      {/* ── Step 3: Programme Choice ──────────────────────────── */}
      {step === 2 && (
        <Card title="Step 3 – Programme & Intake">
          <Form layout="vertical" onFinish={handleNext3} requiredMark="optional">
            <Row gutter={[16, 0]}>
              <Col xs={24}>
                <Form.Item label="Select Intake" required {...fe(form3.formState.errors.intakeId?.message)}>
                  <Controller name="intakeId" control={form3.control}
                    render={({ field }) => (
                      <Select {...field} size="large" showSearch optionFilterProp="label"
                        placeholder="Select a programme and intake"
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
                <Form.Item label="Mode of Study" required {...fe(form3.formState.errors.modeOfStudy?.message)}>
                  <Controller name="modeOfStudy" control={form3.control}
                    render={({ field }) => (
                      <Select {...field} size="large" placeholder="Select mode"
                        options={[{ value: 'full_time', label: 'Full Time' }, { value: 'part_time', label: 'Part Time' }]}
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
                        Apply for scholarship / financial aid
                      </Checkbox>
                    )}
                  />
                </Form.Item>
              </Col>
              {form3.watch('scholarshipApplied') && (
                <Col xs={24} md={12}>
                  <Form.Item label="Scholarship Type">
                    <Controller name="scholarshipType" control={form3.control}
                      render={({ field }) => <Input {...field} placeholder="e.g. BIBD Scholarship" size="large" />}
                    />
                  </Form.Item>
                </Col>
              )}
            </Row>
            <div className={styles.formActions}>
              <Space>
                <Button size="large" onClick={() => setStep(1)}>← Back</Button>
                <Button type="primary" htmlType="submit" size="large">Review & Submit →</Button>
              </Space>
            </div>
          </Form>
        </Card>
      )}

      {/* ── Step 4: Review ────────────────────────────────────── */}
      {step === 3 && (
        <Card title="Step 4 – Review & Submit">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Descriptions title="Personal Information" column={1} size="small" bordered>
                <Descriptions.Item label="Full Name">{formData.fullName}</Descriptions.Item>
                <Descriptions.Item label="IC / Passport">{formData.icPassport}</Descriptions.Item>
                <Descriptions.Item label="Date of Birth">{formData.dateOfBirth}</Descriptions.Item>
                <Descriptions.Item label="Gender">{formData.gender}</Descriptions.Item>
                <Descriptions.Item label="Nationality">{formData.nationality}</Descriptions.Item>
                <Descriptions.Item label="Email">{formData.email}</Descriptions.Item>
                <Descriptions.Item label="Mobile">{formData.mobile}</Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Descriptions title="Academic Background" column={1} size="small" bordered>
                <Descriptions.Item label="Qualification">
                  {QUAL_OPTIONS.find(q => q.value === formData.highestQualification)?.label}
                </Descriptions.Item>
                <Descriptions.Item label="Institution">{formData.previousInstitution}</Descriptions.Item>
                <Descriptions.Item label="Year">{formData.yearOfCompletion}</Descriptions.Item>
                {formData.cgpa && <Descriptions.Item label="CGPA">{formData.cgpa}</Descriptions.Item>}
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Descriptions title="Programme" column={1} size="small" bordered>
                <Descriptions.Item label="Intake">
                  {selectedIntake ? `${selectedIntake.programme.name} — ${selectedIntake.semester.name}` : ''}
                </Descriptions.Item>
                <Descriptions.Item label="Mode">
                  {formData.modeOfStudy === 'full_time' ? 'Full Time' : 'Part Time'}
                </Descriptions.Item>
                {formData.scholarshipApplied && (
                  <Descriptions.Item label="Scholarship">{formData.scholarshipType ?? 'Applied'}</Descriptions.Item>
                )}
              </Descriptions>
            </Col>
          </Row>
          <Alert
            style={{ margin: '20px 0 16px' }}
            type="info"
            message="Declaration"
            description="I declare that all information provided is true and accurate. I understand that false information will result in immediate disqualification."
            showIcon
          />
          <div className={styles.formActions}>
            <Space>
              <Button size="large" onClick={() => setStep(2)}>← Back</Button>
              <Button type="primary" size="large" loading={submitMutation.isPending}
                icon={<CheckCircleOutlined />} onClick={handleSubmit}>
                Submit Application
              </Button>
            </Space>
          </div>
        </Card>
      )}
    </div>
  )
}

export default AdmissionApplyPage
