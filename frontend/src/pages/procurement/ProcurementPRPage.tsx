import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
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
interface Product { id: string; code: string; name: string; unit: string; defaultUnitPrice: number; category?: { name: string } }

const STATUS_COLOR: Record<string, 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple'> = {
  draft:            'gray',
  submitted:        'blue',
  dept_approved:    'blue',
  finance_approved: 'purple',
  rector_approved:  'purple',
  converted_to_po:  'green',
  rejected:         'red',
}

const STATUS_KEY: Record<string, string> = {
  draft:            'procurementPR.draft',
  submitted:        'procurementPR.submitted',
  dept_approved:    'procurementPR.deptApproved',
  finance_approved: 'procurementPR.financeApproved',
  rector_approved:  'procurementPR.rectorApproved',
  converted_to_po:  'procurementPR.convertedToPO',
  rejected:         'procurementPR.rejected',
}

const TRAFFIC_COLORS: Record<string, string> = { red: '#F53F3F', amber: '#FF7D00', green: '#00B42A' }

const ProcurementPRPage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [viewPR, setViewPR] = useState<PR | null>(null)

  const prSchema = z.object({
    productId: z.string().min(1, t('procurementPR.validation.productRequired')),
    quantity: z.coerce
      .number({ invalid_type_error: t('procurementPR.validation.quantityNumber') })
      .int(t('procurementPR.validation.quantityInt'))
      .min(1, t('procurementPR.validation.quantityMin')),
    estimatedUnitPrice: z.coerce
      .number({ invalid_type_error: t('procurementPR.validation.priceNumber') })
      .min(0.01, t('procurementPR.validation.priceMin')),
    glCodeId: z.string().min(1, t('procurementPR.validation.glCodeRequired')),
    requiredByDate: z.string().min(1, t('procurementPR.validation.dateRequired')),
    departmentId: z.string().optional(),
  })
  type PRForm = z.infer<typeof prSchema>

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

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get('/products')
      return data.data
    },
  })

  const { handleSubmit, watch, reset, control, setValue, formState: { errors } } = useForm<PRForm>({
    resolver: zodResolver(prSchema),
  })

  const qty       = watch('quantity') ?? 0
  const price     = watch('estimatedUnitPrice') ?? 0
  const productId = watch('productId')
  const total     = qty * price

  // Group products by category for display
  const productOptions = products.map(p => ({
    value: p.id,
    label: `[${p.code}] ${p.name} — ${p.unit} (BND ${p.defaultUnitPrice.toLocaleString()})`,
  }))

  const handleProductChange = (id: string | number) => {
    const selected = products.find(p => p.id === String(id))
    if (selected) {
      setValue('estimatedUnitPrice', selected.defaultUnitPrice, { shouldValidate: true })
    }
  }

  const createMutation = useMutation({
    mutationFn: (form: PRForm) => {
      const selectedProduct = products.find(p => p.id === form.productId)
      return apiClient.post('/procurement/pr', {
        ...form,
        itemDescription: selectedProduct?.name ?? '',
        itemCategoryId: selectedProduct?.category ? undefined : undefined,
        productId: form.productId,
      })
    },
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message ?? t('procurementPR.prSubmitted') })
      setCreateModal(false)
      reset()
      qc.invalidateQueries({ queryKey: ['procurement'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? t('procurementPR.createFailed') })
    },
  })

  const statusLabel = (status: string) => t(STATUS_KEY[status] as any ?? status, { defaultValue: status })

  const columns: ColumnDef<PR>[] = [
    { key: 'prNumber',        title: t('procurementPR.prNo'),      render: v => <span className={styles.prNo}>{v.prNumber}</span> },
    { key: 'itemDescription', title: t('procurementPR.description'), render: v => (
      <div>
        <div className={styles.prDesc}>{v.itemDescription}</div>
        <div className={styles.prDept}>{v.department?.name ?? '—'}</div>
      </div>
    )},
    { key: 'totalAmount', title: t('procurementPR.amount'), render: v => (
      <div className={styles.amountCell}>
        <span>BND {v.totalAmount.toLocaleString()}</span>
        <span className={styles.trafficLight} style={{ background: TRAFFIC_COLORS[v.quoteTrafficLight] ?? '#ccc' }} />
      </div>
    )},
    { key: 'glCode',      title: t('procurementPR.glCode'),   render: v => <span className={styles.glCode}>{v.glCode?.code ?? '—'}</span> },
    { key: 'status',      title: t('procurementPR.status'),   render: v => (
      <Badge color={STATUS_COLOR[v.status] ?? 'gray'}>{statusLabel(v.status)}</Badge>
    )},
    { key: 'anomalies',   title: '', render: v => (
      v.anomalies && v.anomalies.length > 0
        ? <Badge color="red" size="sm"><AlertTriangle size={11} /> {v.anomalies.length}</Badge>
        : null
    )},
    { key: 'submittedAt', title: t('procurementPR.submitted'), render: v => v.submittedAt ? new Date(v.submittedAt).toLocaleDateString('en-GB') : '—' },
    { key: 'actions',     title: '', render: v => (
      <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setViewPR(v)}>{t('procurementPR.view')}</Button>
    )},
  ]

  const canCreate = user?.role === 'manager' || user?.role === 'admin'
  const SUMMARY_STATUSES = ['submitted', 'dept_approved', 'finance_approved', 'converted_to_po'] as const

  const selectedProduct = products.find(p => p.id === productId)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('procurementPR.title')}</h1>
          <p className={styles.pageSub}>{t('procurementPR.subtitle')}</p>
        </div>
        {canCreate && (
          <Button icon={<Plus size={16} />} onClick={() => setCreateModal(true)}>
            {t('procurementPR.newPR')}
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className={styles.summaryRow}>
        {SUMMARY_STATUSES.map(status => {
          const count = prs.filter(p => p.status === status).length
          return (
            <div key={status} className={styles.summaryCard}>
              <div className={styles.summaryCount}>{count}</div>
              <Badge color={STATUS_COLOR[status]}>{statusLabel(status)}</Badge>
            </div>
          )
        })}
      </div>

      <Card noPadding>
        <Table<PR> columns={columns} dataSource={prs} rowKey="id" loading={isLoading} size="sm" emptyText={t('procurementPR.noPRFound')} />
      </Card>

      {/* Create PR Modal */}
      <Modal
        open={createModal}
        title={t('procurementPR.createPR')}
        onClose={() => { setCreateModal(false); reset() }}
        footer={null}
      >
        {/* Validation rules banner */}
        <div className={styles.validationRules}>
          <div className={styles.rulesTitle}>{t('procurementPR.rulesTitle')}</div>
          <ul className={styles.rulesList}>
            <li><span className={styles.ruleField}>{t('procurementPR.product')}:</span> {t('procurementPR.rules.product')}</li>
            <li><span className={styles.ruleField}>{t('procurementPR.quantity')}:</span> {t('procurementPR.rules.quantity')}</li>
            <li><span className={styles.ruleField}>{t('procurementPR.unitPrice')}:</span> {t('procurementPR.rules.unitPrice')}</li>
            <li><span className={styles.ruleField}>{t('procurementPR.glCode')}:</span> {t('procurementPR.rules.glCode')}</li>
            <li><span className={styles.ruleField}>{t('procurementPR.requiredBy')}:</span> {t('procurementPR.rules.requiredBy')}</li>
            <li><span className={styles.ruleTender}>{t('procurementPR.rules.tenderLimit')}</span></li>
          </ul>
        </div>

        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className={styles.prForm}>
          {/* Product selector */}
          <Controller
            control={control}
            name="productId"
            render={({ field }) => (
              <Select
                label={t('procurementPR.product')}
                required
                value={field.value}
                onChange={val => { field.onChange(val); handleProductChange(val) }}
                error={errors.productId?.message}
                hint={t('procurementPR.hints.product')}
                placeholder={t('procurementPR.productPlaceholder')}
                options={productOptions}
              />
            )}
          />

          {/* Selected product info card */}
          {selectedProduct && (
            <div className={styles.productInfo}>
              <span className={styles.productCode}>{selectedProduct.code}</span>
              <span>{selectedProduct.name}</span>
              {selectedProduct.category && (
                <span className={styles.productCategory}>{selectedProduct.category.name}</span>
              )}
              <span className={styles.productUnit}>{t('procurementPR.unitLabel')}: {selectedProduct.unit}</span>
              <span className={styles.productPrice}>{t('procurementPR.defaultPrice')}: BND {selectedProduct.defaultUnitPrice.toLocaleString()}</span>
            </div>
          )}

          <div className={styles.formRow}>
            <Controller
              control={control}
              name="quantity"
              render={({ field }) => (
                <Input
                  label={t('procurementPR.quantity')}
                  type="number"
                  required
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.quantity?.message}
                  hint={t('procurementPR.hints.quantity')}
                />
              )}
            />
            <Controller
              control={control}
              name="estimatedUnitPrice"
              render={({ field }) => (
                <Input
                  label={t('procurementPR.unitPrice')}
                  type="number"
                  step="0.01"
                  required
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.estimatedUnitPrice?.message}
                  hint={t('procurementPR.hints.unitPrice')}
                />
              )}
            />
          </div>

          {total > 0 && (
            <div className={`${styles.totalPreview} ${total >= 2000 ? styles.totalWarning : ''}`}>
              {t('procurementPR.total')} <strong>BND {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              {total >= 2000 && <span className={styles.tenderNote}> ⚠ {t('procurementPR.tenderNote')}</span>}
            </div>
          )}

          <Controller
            control={control}
            name="glCodeId"
            render={({ field }) => (
              <Select
                label={t('procurementPR.glCode')}
                required
                value={field.value}
                onChange={val => field.onChange(val)}
                error={errors.glCodeId?.message}
                hint={t('procurementPR.hints.glCode')}
                placeholder={t('procurementPR.glCodePlaceholder')}
                options={glCodes.map(g => ({
                  value: g.id,
                  label: g.availableBalance <= 0
                    ? `${g.code} – ${g.description} (Budget Exhausted)`
                    : `${g.code} – ${g.description} (BND ${g.availableBalance?.toLocaleString()} ${t('procurementPR.available')})`,
                  disabled: g.availableBalance <= 0,
                }))}
              />
            )}
          />

          <Controller
            control={control}
            name="requiredByDate"
            render={({ field }) => (
              <Input
                label={t('procurementPR.requiredBy')}
                type="date"
                required
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.requiredByDate?.message}
                hint={t('procurementPR.hints.requiredBy')}
              />
            )}
          />

          <div className={styles.formActions}>
            <Button variant="secondary" type="button" onClick={() => { setCreateModal(false); reset() }}>{t('procurementPR.cancelBtn')}</Button>
            <Button type="submit" loading={createMutation.isPending} icon={<FileText size={14} />} disabled={total >= 2000}>{t('procurementPR.submitPR')}</Button>
          </div>
        </form>
      </Modal>

      {/* View PR Modal */}
      {viewPR && (
        <Modal
          open
          title={`PR: ${viewPR.prNumber}`}
          onClose={() => setViewPR(null)}
          footer={<Button onClick={() => setViewPR(null)}>{t('common.close')}</Button>}
        >
          <div className={styles.prDetail}>
            <div className={styles.prDetailGrid}>
              <DetailRow label={t('procurementPR.description')}   value={viewPR.itemDescription} />
              <DetailRow label={t('procurementPR.requestor')}     value={viewPR.requestor?.user?.displayName ?? '—'} />
              <DetailRow label={t('procurementPR.department')}    value={viewPR.department?.name ?? '—'} />
              <DetailRow label={t('procurementPR.glCode')}        value={`${viewPR.glCode?.code} – ${viewPR.glCode?.description}`} />
              <DetailRow label={t('procurementPR.quantity')}      value={String(viewPR.quantity)} />
              <DetailRow label={t('procurementPR.unitPriceLabel')} value={`BND ${viewPR.estimatedUnitPrice.toLocaleString()}`} />
              <DetailRow label={t('procurementPR.totalAmount')}   value={`BND ${viewPR.totalAmount.toLocaleString()}`} />
              <DetailRow label={t('procurementPR.requiredByLabel')} value={new Date(viewPR.requiredByDate).toLocaleDateString('en-GB')} />
              <DetailRow label={t('procurementPR.status')}        value={<Badge color={STATUS_COLOR[viewPR.status] ?? 'gray'}>{statusLabel(viewPR.status)}</Badge>} />
            </div>

            {viewPR.anomalies && viewPR.anomalies.length > 0 && (
              <div className={styles.anomalyWarn}>
                <AlertTriangle size={16} />
                <div>
                  <strong>{t('procurementPR.anomalyDetected')}</strong>
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
                <h4 className={styles.sectionTitle}>{t('procurementPR.vendorQuotes')}</h4>
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
                <h4 className={styles.sectionTitle}>{t('procurementPR.approvalTrail')}</h4>
                {viewPR.approvals.map((a, i) => (
                  <div key={i} className={styles.approvalRow}>
                    <CheckCircle size={14} className={a.action === 'approved' ? styles.approved : styles.rejected} />
                    <span>{t('procurementPR.level')} {a.level}</span>
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
