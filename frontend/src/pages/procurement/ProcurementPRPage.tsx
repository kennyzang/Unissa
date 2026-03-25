import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, AlertTriangle, Eye, FileText, CheckCircle } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import styles from './ProcurementPRPage.module.scss'

interface PR {
  id: string
  prNumber: string
  itemDescription: string
  quantity: number
  estimatedUnitPrice: number
  totalAmount: number
  quoteTrafficLight: string
  status: string
  submittedAt?: string
  requiredByDate: string
  requestor?: { user: { displayName: string } }
  department?: { name: string }
  glCode?: { code: string; description: string }
  quotes?: { id: string; vendorName: string; quotedPrice: number; quoteNumber: number }[]
  anomalies?: { id: string; anomalyType: string; severity: string; description: string }[]
  approvals?: { level: number; action: string; approver: { displayName: string }; actedAt: string; remarks?: string }[]
}

interface GlCode { id: string; code: string; description: string; availableBalance: number }

const prSchema = z.object({
  itemDescription: z.string().min(5, 'Description required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  estimatedUnitPrice: z.coerce.number().min(0.01, 'Price required'),
  glCodeId: z.string().min(1, 'GL code required'),
  requiredByDate: z.string().min(1, 'Required date needed'),
  departmentId: z.string().optional(),
})
type PRForm = z.infer<typeof prSchema>

const STATUS_BADGE: Record<string, { color: 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple'; label: string }> = {
  draft:            { color: 'gray',   label: 'Draft' },
  submitted:        { color: 'blue',   label: 'Submitted' },
  dept_approved:    { color: 'blue',   label: 'Dept Approved' },
  finance_approved: { color: 'purple', label: 'Finance Approved' },
  rector_approved:  { color: 'purple', label: 'Rector Approved' },
  converted_to_po:  { color: 'green',  label: 'Converted to PO' },
  rejected:         { color: 'red',    label: 'Rejected' },
}

const TRAFFIC_COLORS: Record<string, string> = { red: '#F53F3F', amber: '#FF7D00', green: '#00B42A' }

const ProcurementPRPage: React.FC = () => {
  const user = useAuthStore(s => s.user)
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [viewPR, setViewPR] = useState<PR | null>(null)

  const { data: prs = [], isLoading } = useQuery<PR[]>({
    queryKey: ['procurement', 'pr'],
    queryFn: async () => {
      const { data } = await apiClient.get('/procurement/pr')
      return data.data
    },
  })

  const { data: glCodes = [] } = useQuery<GlCode[]>({
    queryKey: ['finance', 'gl-codes'],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/gl-codes')
      return data.data
    },
  })

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<PRForm>({
    resolver: zodResolver(prSchema),
  })

  const qty = watch('quantity') ?? 0
  const price = watch('estimatedUnitPrice') ?? 0
  const total = qty * price

  const createMutation = useMutation({
    mutationFn: (form: PRForm) => apiClient.post('/procurement/pr', form),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message ?? 'PR submitted' })
      setCreateModal(false)
      reset()
      qc.invalidateQueries({ queryKey: ['procurement'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Failed to create PR' })
    },
  })

  const columns: ColumnDef<PR>[] = [
    { key: 'prNumber', title: 'PR No.', render: v => <span className={styles.prNo}>{v.prNumber}</span> },
    { key: 'itemDescription', title: 'Description', render: v => (
      <div>
        <div className={styles.prDesc}>{v.itemDescription}</div>
        <div className={styles.prDept}>{v.department?.name ?? '—'}</div>
      </div>
    )},
    { key: 'totalAmount', title: 'Amount', render: v => (
      <div className={styles.amountCell}>
        <span>BND {v.totalAmount.toLocaleString()}</span>
        <span className={styles.trafficLight} style={{ background: TRAFFIC_COLORS[v.quoteTrafficLight] ?? '#ccc' }} />
      </div>
    )},
    { key: 'glCode', title: 'GL Code', render: v => <span className={styles.glCode}>{v.glCode?.code ?? '—'}</span> },
    { key: 'status', title: 'Status', render: v => {
      const s = STATUS_BADGE[v.status] ?? STATUS_BADGE.draft
      return <Badge color={s.color}>{s.label}</Badge>
    }},
    { key: 'anomalies', title: '', render: v => (
      v.anomalies && v.anomalies.length > 0
        ? <Badge color="red" size="sm"><AlertTriangle size={11} /> {v.anomalies.length}</Badge>
        : null
    )},
    { key: 'submittedAt', title: 'Submitted', render: v => v.submittedAt ? new Date(v.submittedAt).toLocaleDateString('en-GB') : '—' },
    { key: 'actions', title: '', render: v => (
      <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setViewPR(v)}>View</Button>
    )},
  ]

  const canCreate = user?.role === 'manager' || user?.role === 'admin'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Purchase Requests</h1>
          <p className={styles.pageSub}>Manage and track procurement requests</p>
        </div>
        {canCreate && (
          <Button icon={<Plus size={16} />} onClick={() => setCreateModal(true)}>
            New PR
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className={styles.summaryRow}>
        {(['submitted', 'dept_approved', 'finance_approved', 'converted_to_po'] as const).map(status => {
          const count = prs.filter(p => p.status === status).length
          const s = STATUS_BADGE[status]
          return (
            <div key={status} className={styles.summaryCard}>
              <div className={styles.summaryCount}>{count}</div>
              <Badge color={s.color}>{s.label}</Badge>
            </div>
          )
        })}
      </div>

      <Card noPadding>
        <Table<PR> columns={columns} dataSource={prs} rowKey="id" loading={isLoading} size="sm" emptyText="No purchase requests found" />
      </Card>

      {/* Create PR Modal */}
      <Modal
        open={createModal}
        title="Create Purchase Request"
        onClose={() => { setCreateModal(false); reset() }}
        footer={null}
      >
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className={styles.prForm}>
          <Input label="Item Description" required {...register('itemDescription')} error={errors.itemDescription?.message} />
          <div className={styles.formRow}>
            <Input label="Quantity" type="number" required {...register('quantity')} error={errors.quantity?.message} />
            <Input label="Unit Price (BND)" type="number" step="0.01" required {...register('estimatedUnitPrice')} error={errors.estimatedUnitPrice?.message} />
          </div>
          {total > 0 && (
            <div className={styles.totalPreview}>
              Total: <strong>BND {total.toLocaleString()}</strong>
              {total >= 2000 && <span className={styles.tenderNote}> ⚠ Amount ≥ BND 2,000 requires tender process</span>}
            </div>
          )}
          <Select
            label="GL Code"
            required
            {...register('glCodeId')}
            error={errors.glCodeId?.message}
            options={glCodes.map(g => ({
              value: g.id,
              label: `${g.code} – ${g.description} (BND ${g.availableBalance?.toLocaleString()} available)`,
            }))}
          />
          <Input label="Required By Date" type="date" required {...register('requiredByDate')} error={errors.requiredByDate?.message} />
          <div className={styles.formActions}>
            <Button variant="secondary" type="button" onClick={() => { setCreateModal(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending} icon={<FileText size={14} />}>Submit PR</Button>
          </div>
        </form>
      </Modal>

      {/* View PR Modal */}
      {viewPR && (
        <Modal
          open
          title={`PR: ${viewPR.prNumber}`}
          onClose={() => setViewPR(null)}
          footer={<Button onClick={() => setViewPR(null)}>Close</Button>}
        >
          <div className={styles.prDetail}>
            <div className={styles.prDetailGrid}>
              <DetailRow label="Description" value={viewPR.itemDescription} />
              <DetailRow label="Requestor" value={viewPR.requestor?.user?.displayName ?? '—'} />
              <DetailRow label="Department" value={viewPR.department?.name ?? '—'} />
              <DetailRow label="GL Code" value={`${viewPR.glCode?.code} – ${viewPR.glCode?.description}`} />
              <DetailRow label="Quantity" value={String(viewPR.quantity)} />
              <DetailRow label="Unit Price" value={`BND ${viewPR.estimatedUnitPrice.toLocaleString()}`} />
              <DetailRow label="Total Amount" value={`BND ${viewPR.totalAmount.toLocaleString()}`} />
              <DetailRow label="Required By" value={new Date(viewPR.requiredByDate).toLocaleDateString('en-GB')} />
              <DetailRow label="Status" value={<Badge color={STATUS_BADGE[viewPR.status]?.color ?? 'gray'}>{STATUS_BADGE[viewPR.status]?.label ?? viewPR.status}</Badge>} />
            </div>

            {viewPR.anomalies && viewPR.anomalies.length > 0 && (
              <div className={styles.anomalyWarn}>
                <AlertTriangle size={16} />
                <div>
                  <strong>Anomaly Detected</strong>
                  {viewPR.anomalies.map(a => (
                    <div key={a.id} className={styles.anomalyItem}>
                      <Badge color={a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'orange' : 'gray'} size="sm">{a.severity}</Badge>
                      {a.description}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewPR.quotes && viewPR.quotes.length > 0 && (
              <div className={styles.quotesSection}>
                <h4 className={styles.sectionTitle}>Vendor Quotes</h4>
                {viewPR.quotes.map(q => (
                  <div key={q.id} className={styles.quoteRow}>
                    <span>Quote #{q.quoteNumber}</span>
                    <span>{q.vendorName}</span>
                    <span>BND {q.quotedPrice.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {viewPR.approvals && viewPR.approvals.length > 0 && (
              <div className={styles.approvalsSection}>
                <h4 className={styles.sectionTitle}>Approval Trail</h4>
                {viewPR.approvals.map((a, i) => (
                  <div key={i} className={styles.approvalRow}>
                    <CheckCircle size={14} className={a.action === 'approved' ? styles.approved : styles.rejected} />
                    <span>Level {a.level}</span>
                    <span>{a.approver?.displayName}</span>
                    <Badge color={a.action === 'approved' ? 'green' : 'red'} size="sm">{a.action}</Badge>
                    <span className={styles.approvalDate}>{new Date(a.actedAt).toLocaleDateString('en-GB')}</span>
                  </div>
                ))}
              </div>
            )}
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

export default ProcurementPRPage
