import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { FlaskConical, Plus, CheckCircle, XCircle, Clock, DollarSign, Search } from 'lucide-react'
import { Input as AntInput } from 'antd'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatCard from '@/components/ui/StatCard'
import styles from './ResearchGrantsPage.module.scss'

interface Grant {
  id: string
  referenceNo: string
  title: string
  abstract: string
  durationMonths: number
  totalBudget: number
  amountUtilised: number
  status: string
  submittedAt: string
  l1ActedAt?: string
  l1Remarks?: string
  l3ActedAt?: string
  l3Remarks?: string
  pi: { fullName: string; designation: string; user: { displayName: string } }
  department: { name: string; code: string }
}

interface GrantForm {
  title: string
  abstract: string
  durationMonths: number
  totalBudget: number
}

const STATUS_COLOR: Record<string, 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple'> = {
  proposal_submitted: 'blue',
  dept_approved:      'orange',
  under_review:       'purple',
  approved:           'green',
  rejected:           'red',
  completed:          'gray',
}

const STATUS_KEY: Record<string, string> = {
  proposal_submitted: 'researchGrants.submitted',
  dept_approved:      'researchGrants.deptApproved',
  under_review:       'researchGrants.underReview',
  approved:           'researchGrants.approved',
  rejected:           'researchGrants.rejected',
  completed:          'researchGrants.completed',
}

const ResearchGrantsPage: React.FC = () => {
  const { t } = useTranslation()
  const [search,      setSearch]      = useState('')
  const [submitModal, setSubmitModal] = useState(false)
  const [detailModal, setDetailModal] = useState<Grant | null>(null)
  const [reviewModal, setReviewModal] = useState<{ grant: Grant; type: 'dept' | 'finance'; action: string } | null>(null)
  const [remarks,     setRemarks]     = useState('')

  const { user }   = useAuthStore()
  const addToast   = useUIStore(s => s.addToast)
  const qc         = useQueryClient()
  const isManager  = user?.role === 'manager' || user?.role === 'admin'
  const isFinance  = user?.role === 'finance'  || user?.role === 'admin'
  const isLecturer = user?.role === 'lecturer'

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GrantForm>()

  const { data: grants = [], isLoading } = useQuery<Grant[]>({
    queryKey: ['research', 'grants'],
    queryFn: async () => {
      const { data } = await apiClient.get('/research/grants')
      return data.data
    },
  })

  const { data: stats } = useQuery<any>({
    queryKey: ['research', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/research/stats')
      return data.data
    },
    enabled: isManager || isFinance,
  })

  const submitMutation = useMutation({
    mutationFn: (form: GrantForm) => apiClient.post('/research/grants', form),
    onSuccess: (res) => {
      addToast({ type: 'success', message: t('researchGrants.grantSubmitted', { ref: res.data.data.referenceNo }) })
      qc.invalidateQueries({ queryKey: ['research'] })
      setSubmitModal(false)
      reset()
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('researchGrants.actionFailed') }),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, type, action, remarks }: { id: string; type: string; action: string; remarks: string }) => {
      if (type === 'dept') return apiClient.patch(`/research/grants/${id}/review`,  { action, remarks })
      return                       apiClient.patch(`/research/grants/${id}/finance`, { action, remarks })
    },
    onSuccess: (_, vars) => {
      addToast({ type: 'success', message: t(STATUS_KEY[vars.action] as any ?? vars.action, { defaultValue: vars.action }) })
      qc.invalidateQueries({ queryKey: ['research'] })
      setReviewModal(null)
      setRemarks('')
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('researchGrants.actionFailed') }),
  })

  const statusLabel = (status: string) => t(STATUS_KEY[status] as any ?? status, { defaultValue: status })

  const filtered = grants.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.referenceNo.toLowerCase().includes(search.toLowerCase()) ||
    g.pi.fullName.toLowerCase().includes(search.toLowerCase())
  )

  const columns: ColumnDef<Grant>[] = [
    { key: 'referenceNo',    title: t('researchGrants.reference'), render: v => <span className={styles.ref}>{v.referenceNo}</span> },
    { key: 'title',          title: t('researchGrants.title2'),    render: v => (
      <div>
        <div className={styles.grantTitle}>{v.title}</div>
        <div className={styles.sub}>{v.pi.fullName} · {v.department.code}</div>
      </div>
    )},
    { key: 'totalBudget',    title: t('researchGrants.budget'),    render: v => (
      <div>
        <div>BND {v.totalBudget.toLocaleString()}</div>
        {v.amountUtilised > 0 && <div className={styles.sub}>{t('researchGrants.utilised')}: {v.amountUtilised.toLocaleString()}</div>}
      </div>
    )},
    { key: 'durationMonths', title: t('researchGrants.duration'),  render: v => `${v.durationMonths} ${t('researchGrants.months')}` },
    { key: 'status',         title: t('common.status'),            render: v => (
      <Badge color={STATUS_COLOR[v.status] ?? 'gray'}>{statusLabel(v.status)}</Badge>
    )},
    { key: 'submittedAt',    title: t('researchGrants.submitted'), render: v => new Date(v.submittedAt).toLocaleDateString('en-GB') },
    { key: 'actions',        title: '', render: v => (
      <div className={styles.actionBtns}>
        <Button size="sm" variant="ghost" onClick={() => setDetailModal(v)}>{t('researchGrants.detailsBtn')}</Button>
        {isManager && v.status === 'proposal_submitted' && (
          <>
            <Button size="sm" variant="ghost" icon={<CheckCircle size={13} />}
              onClick={() => { setReviewModal({ grant: v, type: 'dept', action: 'dept_approved' }); setRemarks('') }}>
              {t('researchGrants.approveBtn')}
            </Button>
            <Button size="sm" variant="danger" icon={<XCircle size={13} />}
              onClick={() => { setReviewModal({ grant: v, type: 'dept', action: 'rejected' }); setRemarks('') }}>
              {t('researchGrants.rejectBtn')}
            </Button>
          </>
        )}
        {isFinance && v.status === 'dept_approved' && (
          <>
            <Button size="sm" variant="ghost" icon={<CheckCircle size={13} />}
              onClick={() => { setReviewModal({ grant: v, type: 'finance', action: 'approved' }); setRemarks('') }}>
              {t('researchGrants.fundBtn')}
            </Button>
            <Button size="sm" variant="danger" icon={<XCircle size={13} />}
              onClick={() => { setReviewModal({ grant: v, type: 'finance', action: 'rejected' }); setRemarks('') }}>
              {t('researchGrants.rejectBtn')}
            </Button>
          </>
        )}
      </div>
    )},
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('researchGrants.title')}</h1>
          <p className={styles.pageSub}>{t('researchGrants.subtitle')}</p>
        </div>
        {isLecturer && (
          <Button icon={<Plus size={14} />} onClick={() => setSubmitModal(true)}>{t('researchGrants.submitProposal')}</Button>
        )}
      </div>

      {/* Stats (managers/finance) */}
      {stats && (
        <div className={styles.statsRow}>
          <StatCard title={t('researchGrants.totalGrants')}    value={stats.total}       sub={t('researchGrants.allProposals')}  icon={<FlaskConical size={16} />} color="blue" />
          <StatCard title={t('researchGrants.pending')}         value={stats.submitted}   sub={t('researchGrants.awaitingReview')} icon={<Clock size={16} />}        color="orange" />
          <StatCard title={t('researchGrants.approved')}        value={stats.approved}    sub={t('researchGrants.fundedGrants')}  icon={<CheckCircle size={16} />}  color="green" />
          <StatCard title={t('researchGrants.approvedBudget')} value={`BND ${(stats.approvedBudget ?? 0).toLocaleString()}`} sub={t('researchGrants.totalFunded')} icon={<DollarSign size={16} />} color="purple" />
        </div>
      )}

      {/* Approval Workflow Hint */}
      <div className={styles.workflowBanner}>
        <div className={styles.wfStep}><span className={styles.wfNum}>1</span><span>{t('researchGrants.submitProposal')}</span></div>
        <div className={styles.wfArrow}>→</div>
        <div className={styles.wfStep}><span className={styles.wfNum}>2</span><span>{t('researchGrants.deptHeadReview')}</span></div>
        <div className={styles.wfArrow}>→</div>
        <div className={styles.wfStep}><span className={styles.wfNum}>3</span><span>{t('researchGrants.financeApproval')}</span></div>
        <div className={styles.wfArrow}>→</div>
        <div className={styles.wfStep}><span className={`${styles.wfNum} ${styles.wfNumGreen}`}>✓</span><span>{t('researchGrants.funded')}</span></div>
      </div>

      {/* Table */}
      <Card
        title={t('researchGrants.grantProposals')}
        extra={
          <AntInput
            className={styles.searchInput}
            placeholder={t('researchGrants.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            prefix={<Search size={14} />}
            allowClear
          />
        }
        noPadding
      >
        <Table<Grant>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText={t('researchGrants.noProposals')}
        />
      </Card>

      {/* Submit Proposal Modal */}
      <Modal
        open={submitModal}
        title={t('researchGrants.submitTitle')}
        onClose={() => { setSubmitModal(false); reset() }}
        okText={t('researchGrants.submitProposal')}
        onOk={handleSubmit(d => submitMutation.mutate(d))}
        okLoading={submitMutation.isPending}
      >
        <form className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('researchGrants.researchTitle')}</label>
            <AntInput
              className={styles.input}
              placeholder={t('researchGrants.researchTitlePlaceholder')}
              {...register('title', { required: true })}
            />
            {errors.title && <span className={styles.error}>{t('researchGrants.researchTitle')}</span>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('researchGrants.abstract')}</label>
            <textarea
              className={styles.textarea}
              rows={5}
              placeholder={t('researchGrants.abstractPlaceholder')}
              {...register('abstract', { required: true, minLength: 50 })}
            />
            {errors.abstract && <span className={styles.error}>{t('researchGrants.abstract')}</span>}
          </div>

          <div className={styles.twoCol}>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t('researchGrants.durationMonths')}</label>
              <AntInput
                type="number"
                className={styles.input}
                placeholder="e.g. 24"
                {...register('durationMonths', { required: true, min: 1, max: 60 })}
              />
              {errors.durationMonths && <span className={styles.error}>{t('researchGrants.durationError')}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>{t('researchGrants.totalBudget')}</label>
              <AntInput
                type="number"
                className={styles.input}
                placeholder="e.g. 25000"
                {...register('totalBudget', { required: true, min: 100 })}
              />
              {errors.totalBudget && <span className={styles.error}>{t('researchGrants.budgetError')}</span>}
            </div>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {detailModal && (
        <Modal
          open
          title={detailModal.referenceNo}
          onClose={() => setDetailModal(null)}
          footer={<Button variant="ghost" onClick={() => setDetailModal(null)}>{t('common.close')}</Button>}
        >
          <div className={styles.detailBlock}>
            <div className={styles.detailTitle}>{detailModal.title}</div>
            <div className={styles.detailMeta}>
              <span>{detailModal.pi.fullName}</span>
              <span>·</span>
              <span>{detailModal.department.name}</span>
              <span>·</span>
              <Badge color={STATUS_COLOR[detailModal.status] ?? 'gray'}>
                {statusLabel(detailModal.status)}
              </Badge>
            </div>
          </div>
          <div className={styles.detailGrid}>
            <DetailRow label={t('researchGrants.budget')}      value={`BND ${detailModal.totalBudget.toLocaleString()}`} />
            <DetailRow label={t('researchGrants.duration')}    value={`${detailModal.durationMonths} ${t('researchGrants.months')}`} />
            <DetailRow label={t('researchGrants.utilised')}    value={`BND ${detailModal.amountUtilised.toLocaleString()}`} />
            <DetailRow label={t('researchGrants.submitted')}   value={new Date(detailModal.submittedAt).toLocaleDateString('en-GB')} />
            {detailModal.l1ActedAt && <DetailRow label={t('researchGrants.deptReview')}    value={`${new Date(detailModal.l1ActedAt).toLocaleDateString('en-GB')}${detailModal.l1Remarks ? ` – ${detailModal.l1Remarks}` : ''}`} />}
            {detailModal.l3ActedAt && <DetailRow label={t('researchGrants.financeReview')} value={`${new Date(detailModal.l3ActedAt).toLocaleDateString('en-GB')}${detailModal.l3Remarks ? ` – ${detailModal.l3Remarks}` : ''}`} />}
          </div>
          <div className={styles.abstractBox}>
            <div className={styles.abstractLabel}>{t('researchGrants.abstractLabel')}</div>
            <p className={styles.abstractText}>{detailModal.abstract}</p>
          </div>
        </Modal>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <Modal
          open
          title={reviewModal.action === 'rejected'
            ? t('researchGrants.rejectBtn')
            : reviewModal.type === 'finance'
            ? t('researchGrants.approveFunding')
            : t('researchGrants.approveBtn')}
          onClose={() => setReviewModal(null)}
          okDanger={reviewModal.action === 'rejected'}
          okText={reviewModal.action === 'rejected'
            ? t('researchGrants.rejectBtn')
            : reviewModal.type === 'finance'
            ? t('researchGrants.approveFunding')
            : t('researchGrants.approveBtn')}
          onOk={() => reviewMutation.mutate({ id: reviewModal.grant.id, type: reviewModal.type, action: reviewModal.action, remarks })}
          okLoading={reviewMutation.isPending}
        >
          <p className={styles.reviewText}>
            {reviewModal.action === 'rejected'
              ? t('researchGrants.rejectingText', { title: reviewModal.grant.title })
              : reviewModal.type === 'finance'
              ? t('researchGrants.approvingFundingText', { amount: reviewModal.grant.totalBudget.toLocaleString(), title: reviewModal.grant.title })
              : t('researchGrants.approvingReviewText', { title: reviewModal.grant.title })}
          </p>
          <div className={styles.formGroup} style={{ marginTop: 12 }}>
            <label className={styles.label}>
              {t('common.remarks')} {reviewModal.action === 'rejected' ? `(${t('common.required')})` : `(${t('common.optional')})`}
            </label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder={t('researchGrants.addNotes')}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className={styles.detailRow}>
    <span className={styles.detailLabel}>{label}</span>
    <span className={styles.detailValue}>{value}</span>
  </div>
)

export default ResearchGrantsPage
