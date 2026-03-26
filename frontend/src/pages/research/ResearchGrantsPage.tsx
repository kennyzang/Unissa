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

const STATUS_BADGE: Record<string, { color: 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple'; label: string }> = {
  proposal_submitted: { color: 'blue',   label: 'Submitted' },
  dept_approved:      { color: 'orange', label: 'Dept Approved' },
  under_review:       { color: 'purple', label: 'Under Review' },
  approved:           { color: 'green',  label: 'Approved' },
  rejected:           { color: 'red',    label: 'Rejected' },
  completed:          { color: 'gray',   label: 'Completed' },
}

const ResearchGrantsPage: React.FC = () => {
  const { t } = useTranslation()
  const [search,      setSearch]      = useState('')
  const [submitModal, setSubmitModal] = useState(false)
  const [detailModal, setDetailModal] = useState<Grant | null>(null)
  const [reviewModal, setReviewModal] = useState<{ grant: Grant; type: 'dept' | 'finance'; action: string } | null>(null)
  const [remarks,     setRemarks]     = useState('')

  const { user }      = useAuthStore()
  const addToast      = useUIStore(s => s.addToast)
  const qc            = useQueryClient()
  const isManager     = user?.role === 'manager' || user?.role === 'admin'
  const isFinance     = user?.role === 'finance'  || user?.role === 'admin'
  const isLecturer    = user?.role === 'lecturer'

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
      addToast({ type: 'success', message: `Grant submitted: ${res.data.data.referenceNo}` })
      qc.invalidateQueries({ queryKey: ['research'] })
      setSubmitModal(false)
      reset()
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Submission failed' }),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, type, action, remarks }: { id: string; type: string; action: string; remarks: string }) => {
      if (type === 'dept') return apiClient.patch(`/research/grants/${id}/review`,  { action, remarks })
      return                       apiClient.patch(`/research/grants/${id}/finance`, { action, remarks })
    },
    onSuccess: (_, vars) => {
      addToast({ type: 'success', message: `Grant ${vars.action}` })
      qc.invalidateQueries({ queryKey: ['research'] })
      setReviewModal(null)
      setRemarks('')
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Action failed' }),
  })

  const filtered = grants.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.referenceNo.toLowerCase().includes(search.toLowerCase()) ||
    g.pi.fullName.toLowerCase().includes(search.toLowerCase())
  )

  const columns: ColumnDef<Grant>[] = [
    { key: 'referenceNo', title: 'Reference', render: v => <span className={styles.ref}>{v.referenceNo}</span> },
    { key: 'title', title: 'Title', render: v => (
      <div>
        <div className={styles.grantTitle}>{v.title}</div>
        <div className={styles.sub}>{v.pi.fullName} · {v.department.code}</div>
      </div>
    )},
    { key: 'totalBudget', title: 'Budget', render: v => (
      <div>
        <div>BND {v.totalBudget.toLocaleString()}</div>
        {v.amountUtilised > 0 && <div className={styles.sub}>Used: {v.amountUtilised.toLocaleString()}</div>}
      </div>
    )},
    { key: 'durationMonths', title: 'Duration', render: v => `${v.durationMonths} months` },
    { key: 'status', title: 'Status', render: v => {
      const s = STATUS_BADGE[v.status] ?? STATUS_BADGE.proposal_submitted
      return <Badge color={s.color}>{s.label}</Badge>
    }},
    { key: 'submittedAt', title: 'Submitted', render: v => new Date(v.submittedAt).toLocaleDateString('en-GB') },
    { key: 'actions', title: '', render: v => (
      <div className={styles.actionBtns}>
        <Button size="sm" variant="ghost" onClick={() => setDetailModal(v)}>Details</Button>
        {isManager && v.status === 'proposal_submitted' && (
          <>
            <Button size="sm" variant="ghost" icon={<CheckCircle size={13} />}
              onClick={() => { setReviewModal({ grant: v, type: 'dept', action: 'dept_approved' }); setRemarks('') }}>
              Approve
            </Button>
            <Button size="sm" variant="danger" icon={<XCircle size={13} />}
              onClick={() => { setReviewModal({ grant: v, type: 'dept', action: 'rejected' }); setRemarks('') }}>
              Reject
            </Button>
          </>
        )}
        {isFinance && v.status === 'dept_approved' && (
          <>
            <Button size="sm" variant="ghost" icon={<CheckCircle size={13} />}
              onClick={() => { setReviewModal({ grant: v, type: 'finance', action: 'approved' }); setRemarks('') }}>
              Fund
            </Button>
            <Button size="sm" variant="danger" icon={<XCircle size={13} />}
              onClick={() => { setReviewModal({ grant: v, type: 'finance', action: 'rejected' }); setRemarks('') }}>
              Reject
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
          <Button icon={<Plus size={14} />} onClick={() => setSubmitModal(true)}>Submit Proposal</Button>
        )}
      </div>

      {/* Stats (managers/finance) */}
      {stats && (
        <div className={styles.statsRow}>
          <StatCard title="Total Grants"  value={stats.total}    sub="All proposals"       icon={<FlaskConical size={16} />} color="blue" />
          <StatCard title="Pending"       value={stats.submitted} sub="Awaiting review"    icon={<Clock size={16} />}        color="orange" />
          <StatCard title="Approved"      value={stats.approved} sub="Funded grants"       icon={<CheckCircle size={16} />}  color="green" />
          <StatCard title="Approved Budget" value={`BND ${(stats.approvedBudget ?? 0).toLocaleString()}`} sub="Total funded" icon={<DollarSign size={16} />} color="purple" />
        </div>
      )}

      {/* Approval Workflow Hint */}
      <div className={styles.workflowBanner}>
        <div className={styles.wfStep}><span className={styles.wfNum}>1</span><span>Submit Proposal</span></div>
        <div className={styles.wfArrow}>→</div>
        <div className={styles.wfStep}><span className={styles.wfNum}>2</span><span>Dept Head Review</span></div>
        <div className={styles.wfArrow}>→</div>
        <div className={styles.wfStep}><span className={styles.wfNum}>3</span><span>Finance Approval</span></div>
        <div className={styles.wfArrow}>→</div>
        <div className={styles.wfStep}><span className={`${styles.wfNum} ${styles.wfNumGreen}`}>✓</span><span>Funded</span></div>
      </div>

      {/* Table */}
      <Card
        title="Grant Proposals"
        extra={
          <AntInput
            className={styles.searchInput}
            placeholder="Search by title, reference, PI name..."
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
          emptyText="No grant proposals found"
        />
      </Card>

      {/* Submit Proposal Modal */}
      <Modal
        open={submitModal}
        title="Submit Research Grant Proposal"
        onClose={() => { setSubmitModal(false); reset() }}
        okText="Submit Proposal"
        onOk={handleSubmit(d => submitMutation.mutate(d))}
        okLoading={submitMutation.isPending}
      >
        <form className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Research Title *</label>
            <AntInput
              className={styles.input}
              placeholder="Enter the full title of your research"
              {...register('title', { required: 'Title is required' })}
            />
            {errors.title && <span className={styles.error}>{errors.title.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Abstract *</label>
            <textarea
              className={styles.textarea}
              rows={5}
              placeholder="Provide a concise overview of your research objectives, methodology, and expected outcomes..."
              {...register('abstract', { required: 'Abstract is required', minLength: { value: 50, message: 'Abstract must be at least 50 characters' } })}
            />
            {errors.abstract && <span className={styles.error}>{errors.abstract.message}</span>}
          </div>

          <div className={styles.twoCol}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Duration (months) *</label>
              <AntInput
                type="number"
                className={styles.input}
                placeholder="e.g. 24"
                {...register('durationMonths', { required: 'Duration is required', min: 1, max: 60 })}
              />
              {errors.durationMonths && <span className={styles.error}>1–60 months required</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Total Budget (BND) *</label>
              <AntInput
                type="number"
                className={styles.input}
                placeholder="e.g. 25000"
                {...register('totalBudget', { required: 'Budget is required', min: 100 })}
              />
              {errors.totalBudget && <span className={styles.error}>Minimum BND 100</span>}
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
          footer={<Button variant="ghost" onClick={() => setDetailModal(null)}>Close</Button>}
        >
          <div className={styles.detailBlock}>
            <div className={styles.detailTitle}>{detailModal.title}</div>
            <div className={styles.detailMeta}>
              <span>{detailModal.pi.fullName}</span>
              <span>·</span>
              <span>{detailModal.department.name}</span>
              <span>·</span>
              <Badge color={STATUS_BADGE[detailModal.status]?.color ?? 'gray'}>
                {STATUS_BADGE[detailModal.status]?.label ?? detailModal.status}
              </Badge>
            </div>
          </div>
          <div className={styles.detailGrid}>
            <DetailRow label="Budget"    value={`BND ${detailModal.totalBudget.toLocaleString()}`} />
            <DetailRow label="Duration"  value={`${detailModal.durationMonths} months`} />
            <DetailRow label="Utilised"  value={`BND ${detailModal.amountUtilised.toLocaleString()}`} />
            <DetailRow label="Submitted" value={new Date(detailModal.submittedAt).toLocaleDateString('en-GB')} />
            {detailModal.l1ActedAt  && <DetailRow label="Dept Review"    value={`${new Date(detailModal.l1ActedAt).toLocaleDateString('en-GB')}${detailModal.l1Remarks ? ` – ${detailModal.l1Remarks}` : ''}`} />}
            {detailModal.l3ActedAt  && <DetailRow label="Finance Review" value={`${new Date(detailModal.l3ActedAt).toLocaleDateString('en-GB')}${detailModal.l3Remarks ? ` – ${detailModal.l3Remarks}` : ''}`} />}
          </div>
          <div className={styles.abstractBox}>
            <div className={styles.abstractLabel}>Abstract</div>
            <p className={styles.abstractText}>{detailModal.abstract}</p>
          </div>
        </Modal>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <Modal
          open
          title={`${reviewModal.action === 'rejected' ? 'Reject' : reviewModal.type === 'finance' ? 'Approve Funding' : 'Approve'} Grant`}
          onClose={() => setReviewModal(null)}
          okDanger={reviewModal.action === 'rejected'}
          okText={reviewModal.action === 'rejected' ? 'Reject' : reviewModal.type === 'finance' ? 'Approve Funding' : 'Approve'}
          onOk={() => reviewMutation.mutate({ id: reviewModal.grant.id, type: reviewModal.type, action: reviewModal.action, remarks })}
          okLoading={reviewMutation.isPending}
        >
          <p className={styles.reviewText}>
            {reviewModal.action === 'rejected'
              ? `Rejecting grant proposal "${reviewModal.grant.title}". Please provide a reason.`
              : reviewModal.type === 'finance'
              ? `Approving funding of BND ${reviewModal.grant.totalBudget.toLocaleString()} for "${reviewModal.grant.title}".`
              : `Approving grant proposal "${reviewModal.grant.title}" for committee review.`}
          </p>
          <div className={styles.formGroup} style={{ marginTop: 12 }}>
            <label className={styles.label}>Remarks {reviewModal.action === 'rejected' ? '(required)' : '(optional)'}</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="Add review notes..."
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
