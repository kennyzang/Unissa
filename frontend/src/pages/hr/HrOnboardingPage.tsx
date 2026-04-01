import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, CheckCircle, Clock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

interface Staff {
  id: string
  staffId: string
  fullName: string
  designation: string
  department: { name: string }
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

  const [showNewModal,    setShowNewModal]    = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [approvingId,     setApprovingId]     = useState<string | null>(null)
  const [justApproved,    setJustApproved]    = useState<string | null>(null)

  // Onboarding requests
  const { data: requests = [], isLoading } = useQuery<OnboardingRequest[]>({
    queryKey: ['hr', 'onboarding'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/onboarding')
      return data.data
    },
  })

  // All staff (for "new onboarding" dropdown)
  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ['hr', 'staff'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/staff')
      return data.data
    },
  })

  // Staff without an existing request
  const onboardedStaffIds = new Set(requests.map(r => r.staff.staffId))
  const availableStaff = staffList.filter(s => !onboardedStaffIds.has(s.staffId))

  const pending   = requests.filter(r => r.status === 'pending_approval').length
  const completed = requests.filter(r => r.status === 'completed').length

  // Create onboarding request
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
        <Button variant="primary" size="sm" onClick={() => setShowNewModal(true)}>
          <UserPlus size={14} style={{ marginRight: 6 }} />
          {t('onboarding.newRequest')}
        </Button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <StatCard title={t('onboarding.totalRequests')} value={requests.length} sub={t('onboarding.allTime')}      icon={<Users size={16} />}     color="blue" />
        <StatCard title={t('onboarding.pending')}       value={pending}          sub={t('onboarding.awaitingApproval')} icon={<Clock size={16} />}      color="orange" />
        <StatCard title={t('onboarding.completed')}     value={completed}        sub={t('onboarding.fullyProvisioned')} icon={<CheckCircle size={16} />} color="green" />
      </div>

      {/* Table */}
      <Card title={t('onboarding.requests')} noPadding>
        <Table<OnboardingRequest>
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText={t('onboarding.noRequests')}
        />
      </Card>

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

      {/* New Onboarding Modal */}
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
              <select
                className={styles.select}
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
              >
                <option value="">{t('onboarding.selectStaffPlaceholder')}</option>
                {availableStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.staffId} — {s.fullName} ({s.designation})
                  </option>
                ))}
              </select>
            )}
            <p className={styles.formHint}>{t('onboarding.formHint')}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default HrOnboardingPage
