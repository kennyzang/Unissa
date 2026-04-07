import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, CheckCircle, Clock, Users, Copy, Check, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Form, Input, Select, DatePicker } from 'antd'
import type { Dayjs } from 'dayjs'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import StatCard from '@/components/ui/StatCard'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import styles from './HrOnboardingPage.module.scss'

const { Option } = Select

interface OnboardingRequest {
  id: string
  staffId: string
  initiatedById: string
  status: string
  hrDirectorApprovedAt: string | null
  loginCreated: boolean
  lmsProvisioned: boolean
  payrollCreated: boolean
  appointmentLetterGenerated: boolean
  completedAt: string | null
  createdAt: string
  staff: {
    staffId: string
    fullName: string
    designation: string
    department: { name: string }
    user: { displayName: string; email: string }
  }
}

interface StaffOption {
  id: string
  staffId: string
  fullName: string
  designation: string
  department: { name: string }
}

interface Department {
  id: string
  code: string
  name: string
}

interface Credentials {
  username: string
  temporaryPassword: string
  staffId: string
  fullName: string
  email: string
}

const STEP_LABELS = [
  { key: 'loginCreated',               icon: '🔑', label: 'Login account + credentials email' },
  { key: 'lmsProvisioned',             icon: '🎓', label: 'LMS Instructor account provisioned' },
  { key: 'payrollCreated',             icon: '💰', label: 'Payroll record created' },
  { key: 'appointmentLetterGenerated', icon: '📄', label: 'Appointment letter PDF generated' },
]

const HrOnboardingPage: React.FC = () => {
  const { t } = useTranslation()
  const qc    = useQueryClient()
  const { addToast } = useUIStore()
  const [form] = Form.useForm()

  const [activeTab,       setActiveTab]       = useState<'pending' | 'completed'>('pending')
  const [showNewModal,    setShowNewModal]    = useState(false)
  const [showNewHireModal,setShowNewHireModal]= useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [approvingId,     setApprovingId]     = useState<string | null>(null)
  const [justApproved,    setJustApproved]    = useState<string | null>(null)
  const [credentials,     setCredentials]     = useState<Credentials | null>(null)
  const [copiedField,     setCopiedField]     = useState<string | null>(null)

  // Onboarding requests
  const { data: requests = [], isLoading } = useQuery<OnboardingRequest[]>({
    queryKey: ['hr', 'onboarding'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/onboarding')
      return data.data
    },
  })

  // All staff (for "new onboarding" dropdown)
  const { data: staffList = [] } = useQuery<StaffOption[]>({
    queryKey: ['hr', 'staff'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/staff')
      return data.data
    },
  })

  // Departments (for new-hire form)
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['hr', 'departments'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/departments')
      return data.data
    },
    enabled: showNewHireModal,
  })

  // Staff without an existing request
  const onboardedStaffIds = new Set(requests.map(r => r.staff.staffId))
  const availableStaff = staffList.filter(s => !onboardedStaffIds.has(s.staffId))

  const pendingRequests   = requests.filter(r => r.status === 'pending_approval')
  const completedRequests = requests.filter(r => r.status === 'completed')
  const pending   = pendingRequests.length
  const completed = completedRequests.length

  // Create onboarding request (existing staff)
  const createMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { data } = await apiClient.post('/hr/onboarding', { staffId })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'onboarding'] })
      setShowNewModal(false)
      setSelectedStaffId('')
      addToast({ type: 'success', message: t('onboarding.createSuccess') })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e?.response?.data?.message ?? t('onboarding.createFailed') })
    },
  })

  // Register new hire
  const newHireMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        ...values,
        dateOfBirth: (values.dateOfBirth as Dayjs).format('YYYY-MM-DD'),
        startDate:   (values.startDate   as Dayjs).format('YYYY-MM-DD'),
      }
      const { data } = await apiClient.post('/hr/new-hire', payload)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['hr', 'onboarding'] })
      qc.invalidateQueries({ queryKey: ['hr', 'staff'] })
      setShowNewHireModal(false)
      form.resetFields()
      setCredentials({
        username:          data.data.credentials.username,
        temporaryPassword: data.data.credentials.temporaryPassword,
        staffId:           data.data.staff.staffId,
        fullName:          data.data.staff.fullName,
        email:             data.data.staff.user.email,
      })
      addToast({ type: 'success', message: t('onboarding.newHireSuccess') })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e?.response?.data?.message ?? t('onboarding.newHireFailed') })
    },
  })

  // Approve onboarding
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/hr/onboarding/${id}/approve`)
      return data
    },
    onSuccess: (_data, id) => {
      setJustApproved(id)
      qc.invalidateQueries({ queryKey: ['hr', 'onboarding'] })
      addToast({ type: 'success', message: t('onboarding.approveSuccess') })
      setTimeout(() => setJustApproved(null), 3000)
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e?.response?.data?.message ?? t('onboarding.approveFailed') })
    },
    onSettled: () => setApprovingId(null),
  })

  const handleApprove = (id: string) => {
    setApprovingId(id)
    approveMutation.mutate(id)
  }

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const completedColumns: ColumnDef<OnboardingRequest>[] = [
    {
      key: 'staff',
      title: t('onboarding.staff'),
      render: r => (
        <div>
          <div className={styles.staffName}>{r.staff.fullName}</div>
          <div className={styles.staffSub}>{r.staff.designation} · {r.staff.department.name}</div>
        </div>
      ),
    },
    {
      key: 'status',
      title: t('onboarding.colDecision'),
      render: () => (
        <Badge color="green"><CheckCircle size={12} style={{ marginRight: 4 }} />{t('onboarding.completed')}</Badge>
      ),
    },
    {
      key: 'steps',
      title: t('onboarding.automationSteps'),
      render: r => (
        <div className={styles.steps}>
          {STEP_LABELS.map(step => {
            const done = r[step.key as keyof OnboardingRequest] as boolean
            return (
              <div key={step.key} className={`${styles.step} ${done ? styles.stepDone : ''}`}>
                <span className={styles.stepIcon}>{done ? '✅' : '⬜'}</span>
                <span className={styles.stepLabel}>{step.icon} {step.label}</span>
              </div>
            )
          })}
        </div>
      ),
    },
    {
      key: 'completedAt',
      title: t('onboarding.colCompletedAt'),
      render: r => (
        <div className={styles.staffSub}>
          {r.completedAt
            ? new Date(r.completedAt).toLocaleDateString('en-GB')
            : '—'}
        </div>
      ),
    },
  ]

  const columns: ColumnDef<OnboardingRequest>[] = [
    {
      key: 'staff',
      title: t('onboarding.staff'),
      render: r => (
        <div>
          <div className={styles.staffName}>{r.staff.fullName}</div>
          <div className={styles.staffSub}>{r.staff.designation} · {r.staff.department.name}</div>
          <div className={styles.staffSub}>{r.staff.user.email}</div>
        </div>
      ),
    },
    {
      key: 'status',
      title: t('common.status'),
      render: r => (
        <Badge color={r.status === 'completed' ? 'green' : 'orange'}>
          {r.status === 'completed' ? t('onboarding.completed') : t('onboarding.pendingApproval')}
        </Badge>
      ),
    },
    {
      key: 'steps',
      title: t('onboarding.automationSteps'),
      render: r => {
        const isJustApproved = justApproved === r.id
        return (
          <div className={styles.steps}>
            {STEP_LABELS.map(step => {
              const done = r[step.key as keyof OnboardingRequest] as boolean
              return (
                <div
                  key={step.key}
                  className={`${styles.step} ${done ? styles.stepDone : ''} ${isJustApproved && done ? styles.stepPop : ''}`}
                >
                  <span className={styles.stepIcon}>{done ? '✅' : '⬜'}</span>
                  <span className={styles.stepLabel}>{step.icon} {step.label}</span>
                </div>
              )
            })}
          </div>
        )
      },
    },
    {
      key: 'createdAt',
      title: t('onboarding.submitted'),
      render: r => (
        <div className={styles.staffSub}>
          {new Date(r.createdAt).toLocaleDateString('en-GB')}
          {r.completedAt && (
            <div>{t('onboarding.approvedOn')} {new Date(r.completedAt).toLocaleDateString('en-GB')}</div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      title: '',
      render: r => r.status === 'pending_approval' ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => handleApprove(r.id)}
          disabled={approvingId === r.id}
        >
          {approvingId === r.id ? t('onboarding.approving') : t('common.approve')}
        </Button>
      ) : (
        <span className={styles.completedLabel}>
          <CheckCircle size={14} /> {t('onboarding.done')}
        </span>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('onboarding.title')}</h1>
          <p className={styles.pageSub}>{t('onboarding.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" size="sm" onClick={() => setShowNewHireModal(true)}>
            <UserPlus size={14} style={{ marginRight: 6 }} />
            {t('onboarding.registerNewHire')}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowNewModal(true)}>
            <UserPlus size={14} style={{ marginRight: 6 }} />
            {t('onboarding.newRequest')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <StatCard title={t('onboarding.totalRequests')} value={requests.length} sub={t('onboarding.allTime')}           icon={<Users size={16} />}     color="blue" />
        <StatCard title={t('onboarding.pending')}       value={pending}          sub={t('onboarding.awaitingApproval')} icon={<Clock size={16} />}      color="orange" />
        <StatCard title={t('onboarding.completed')}     value={completed}        sub={t('onboarding.fullyProvisioned')} icon={<CheckCircle size={16} />} color="green" />
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'pending' ? styles.active : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <Clock size={14} />
          {t('onboarding.tabPending')}
          {pending > 0 && <span className={styles.tabBadge}>{pending}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'completed' ? styles.active : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <History size={14} />
          {t('onboarding.tabCompleted')}
        </button>
      </div>

      {/* Table */}
      {activeTab === 'pending' && (
        <Card title={t('onboarding.requests')} noPadding>
          <Table<OnboardingRequest>
            columns={columns}
            dataSource={pendingRequests}
            rowKey="id"
            loading={isLoading}
            size="sm"
            emptyText={t('onboarding.noRequests')}
          />
        </Card>
      )}

      {activeTab === 'completed' && (
        <Card title={t('onboarding.tabCompleted')} noPadding>
          <Table<OnboardingRequest>
            columns={completedColumns}
            dataSource={completedRequests}
            rowKey="id"
            loading={isLoading}
            size="sm"
            emptyText={t('onboarding.noCompleted')}
          />
        </Card>
      )}

      {/* How it works */}
      <Card title={t('onboarding.howItWorks')}>
        <div className={styles.flowSteps}>
          <div className={styles.flowStep}>
            <div className={styles.flowNum}>1</div>
            <div className={styles.flowText}>
              <strong>{t('onboarding.flow1Title')}</strong>
              <span>{t('onboarding.flow1Desc')}</span>
            </div>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <div className={styles.flowNum}>2</div>
            <div className={styles.flowText}>
              <strong>{t('onboarding.flow2Title')}</strong>
              <span>{t('onboarding.flow2Desc')}</span>
            </div>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <div className={styles.flowNum}>3</div>
            <div className={styles.flowText}>
              <strong>{t('onboarding.flow3Title')}</strong>
              <span>{t('onboarding.flow3Desc')}</span>
            </div>
          </div>
        </div>
        <div className={styles.stepGrid}>
          {STEP_LABELS.map(s => (
            <div key={s.key} className={styles.stepCard}>
              <div className={styles.stepCardIcon}>{s.icon}</div>
              <div className={styles.stepCardLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── New Onboarding Modal (existing staff) ── */}
      {showNewModal && (
        <Modal
          open
          title={t('onboarding.newRequest')}
          onClose={() => { setShowNewModal(false); setSelectedStaffId('') }}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => { setShowNewModal(false); setSelectedStaffId('') }}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={!selectedStaffId || createMutation.isPending}
                onClick={() => selectedStaffId && createMutation.mutate(selectedStaffId)}
              >
                {createMutation.isPending ? t('common.loading') : t('onboarding.submitRequest')}
              </Button>
            </div>
          }
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('onboarding.selectStaff')}</label>
            {availableStaff.length === 0 ? (
              <p className={styles.noStaff}>{t('onboarding.allStaffOnboarded')}</p>
            ) : (
              <Select
                className={styles.select}
                value={selectedStaffId}
                onChange={value => setSelectedStaffId(value)}
              >
                <Option value="">{t('onboarding.selectStaffPlaceholder')}</Option>
                {availableStaff.map(s => (
                  <Option key={s.id} value={s.id}>
                    {s.staffId} — {s.fullName} ({s.designation})
                  </Option>
                ))}
              </Select>
            )}
            <p className={styles.formHint}>{t('onboarding.formHint')}</p>
          </div>
        </Modal>
      )}

      {/* ── Register New Hire Modal ── */}
      {showNewHireModal && (
        <Modal
          open
          title={t('onboarding.registerNewHire')}
          onClose={() => { setShowNewHireModal(false); form.resetFields() }}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => { setShowNewHireModal(false); form.resetFields() }}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={newHireMutation.isPending}
                onClick={() => form.submit()}
              >
                {newHireMutation.isPending ? t('common.loading') : t('onboarding.registerAndOnboard')}
              </Button>
            </div>
          }
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={values => newHireMutation.mutate(values)}
            className={styles.newHireForm}
          >
            <div className={styles.formRow}>
              <Form.Item name="fullName" label={t('onboarding.fieldFullName')} rules={[{ required: true }]}>
                <Input placeholder="e.g. Nurul Ain Binti Haji Omar" />
              </Form.Item>
              <Form.Item name="icPassport" label={t('onboarding.fieldIcPassport')} rules={[{ required: true }]}>
                <Input placeholder="e.g. IC-2002031501" />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item name="dateOfBirth" label={t('onboarding.fieldDob')} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="gender" label={t('onboarding.fieldGender')} rules={[{ required: true }]} initialValue="male">
                <Select options={[
                  { label: t('onboarding.genderMale'),   value: 'male'   },
                  { label: t('onboarding.genderFemale'), value: 'female' },
                ]} />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item name="personalEmail" label={t('onboarding.fieldEmail')} rules={[{ required: true, type: 'email' }]}>
                <Input placeholder="e.g. nurul.ain@email.com" />
              </Form.Item>
              <Form.Item name="phone" label={t('onboarding.fieldPhone')}>
                <Input placeholder="+673-7xxxxxx" />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item name="designation" label={t('onboarding.fieldDesignation')} rules={[{ required: true }]}>
                <Input placeholder="e.g. Lecturer" />
              </Form.Item>
              <Form.Item name="departmentId" label={t('onboarding.fieldDepartment')} rules={[{ required: true }]}>
                <Select
                  placeholder={t('onboarding.selectDeptPlaceholder')}
                  options={departments.map(d => ({ label: d.name, value: d.id }))}
                  loading={departments.length === 0}
                />
              </Form.Item>
            </div>
            <div className={styles.formRow}>
              <Form.Item name="employmentType" label={t('onboarding.fieldEmploymentType')} rules={[{ required: true }]}>
                <Select options={[
                  { label: t('hrStaff.permanent'), value: 'permanent'  },
                  { label: t('hrStaff.partTime'),  value: 'part_time'  },
                  { label: t('hrStaff.contract'),  value: 'contract'   },
                ]} />
              </Form.Item>
              <Form.Item name="startDate" label={t('onboarding.fieldStartDate')} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </div>
            <Form.Item name="salary" label={t('onboarding.fieldSalary')} rules={[{ required: true }]}>
              <Input type="number" prefix="BND" placeholder="e.g. 3500" />
            </Form.Item>
          </Form>
          <p className={styles.formHint}>{t('onboarding.newHireHint')}</p>
        </Modal>
      )}

      {/* ── Credentials Display Modal ── */}
      {credentials && (
        <Modal
          open
          title={t('onboarding.credentialsTitle')}
          onClose={() => setCredentials(null)}
          footer={
            <Button variant="primary" onClick={() => setCredentials(null)}>
              {t('onboarding.credentialsDone')}
            </Button>
          }
        >
          <div className={styles.credentialsBanner}>
            <p className={styles.credentialsInfo}>{t('onboarding.credentialsInfo', { name: credentials.fullName })}</p>
            <div className={styles.credentialRow}>
              <span className={styles.credentialLabel}>{t('onboarding.credStaffId')}</span>
              <span className={styles.credentialValue}>{credentials.staffId}</span>
            </div>
            <div className={styles.credentialRow}>
              <span className={styles.credentialLabel}>{t('onboarding.credEmail')}</span>
              <span className={styles.credentialValue}>{credentials.email}</span>
            </div>
            <div className={styles.credentialRow}>
              <span className={styles.credentialLabel}>{t('onboarding.credUsername')}</span>
              <span className={styles.credentialValue}>{credentials.username}</span>
              <button className={styles.copyBtn} onClick={() => copyToClipboard(credentials.username, 'username')}>
                {copiedField === 'username' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <div className={styles.credentialRow}>
              <span className={styles.credentialLabel}>{t('onboarding.credTempPassword')}</span>
              <span className={`${styles.credentialValue} ${styles.credentialPassword}`}>{credentials.temporaryPassword}</span>
              <button className={styles.copyBtn} onClick={() => copyToClipboard(credentials.temporaryPassword, 'password')}>
                {copiedField === 'password' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
          <p className={styles.credentialsWarning}>{t('onboarding.credentialsWarning')}</p>
        </Modal>
      )}
    </div>
  )
}

export default HrOnboardingPage
