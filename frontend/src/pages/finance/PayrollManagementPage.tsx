import { useTranslation } from 'react-i18next'
import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Users, CheckCircle, Clock, Edit2, CreditCard, RefreshCw, Search } from 'lucide-react'
import { Input as AntInput, DatePicker, Checkbox, message as antMessage } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { apiClient } from '@/lib/apiClient'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import styles from './PayrollManagementPage.module.scss'

// ── Types ─────────────────────────────────────────────────────

interface PayrollRecord {
  id: string
  staffId: string
  payrollMonth: string
  basicSalary: number
  allowances: number
  deductions: number
  netSalary: number
  status: 'draft' | 'paid'
  paidAt: string | null
  staff: {
    staffId: string
    fullName: string
    designation: string
    department: { name: string; code: string }
    user: { displayName: string }
  }
}

interface PayrollSummary {
  totalRecords: number
  totalBasic: number
  totalAllowances: number
  totalDeductions: number
  totalNetSalary: number
  paidCount: number
  draftCount: number
  totalStaff: number
}

// ── Helpers ───────────────────────────────────────────────────

const fmtBND = (v: number) =>
  `BND ${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

// ── Component ─────────────────────────────────────────────────

const PayrollManagementPage: React.FC = () => {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs().startOf('month'))
  const [statusFilter, setStatusFilter]   = useState<'all' | 'draft' | 'paid'>('all')
  const [search, setSearch]               = useState('')
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [editRecord, setEditRecord]       = useState<PayrollRecord | null>(null)
  const [editAllowances, setEditAllowances] = useState('')
  const [editDeductions, setEditDeductions] = useState('')

  const monthParam = selectedMonth.format('YYYY-MM-DD')

  // ── Queries ─────────────────────────────────────────────────

  const { data: records = [], isLoading } = useQuery<PayrollRecord[]>({
    queryKey: ['finance', 'payroll', monthParam, statusFilter],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/payroll', {
        params: { month: monthParam, status: statusFilter },
      })
      return data.data
    },
  })

  const { data: summary } = useQuery<PayrollSummary>({
    queryKey: ['finance', 'payroll-summary', monthParam],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/payroll/summary', {
        params: { month: monthParam },
      })
      return data.data
    },
  })

  // ── Mutations ────────────────────────────────────────────────

  const generateMut = useMutation({
    mutationFn: () => apiClient.post('/finance/payroll/generate', { month: monthParam }),
    onSuccess: (res) => {
      antMessage.success(res.data.message)
      qc.invalidateQueries({ queryKey: ['finance', 'payroll'] })
      qc.invalidateQueries({ queryKey: ['finance', 'payroll-summary'] })
    },
    onError: (e: any) => antMessage.error(e.response?.data?.message ?? t('payroll.generateError')),
  })

  const editMut = useMutation({
    mutationFn: ({ id, allowances, deductions }: { id: string; allowances: number; deductions: number }) =>
      apiClient.put(`/finance/payroll/${id}`, { allowances, deductions }),
    onSuccess: () => {
      antMessage.success(t('payroll.updateSuccess'))
      setEditRecord(null)
      qc.invalidateQueries({ queryKey: ['finance', 'payroll'] })
      qc.invalidateQueries({ queryKey: ['finance', 'payroll-summary'] })
    },
    onError: (e: any) => antMessage.error(e.response?.data?.message ?? t('payroll.updateError')),
  })

  const payOneMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/finance/payroll/${id}/pay`),
    onSuccess: () => {
      antMessage.success(t('payroll.markedPaid'))
      qc.invalidateQueries({ queryKey: ['finance', 'payroll'] })
      qc.invalidateQueries({ queryKey: ['finance', 'payroll-summary'] })
    },
    onError: (e: any) => antMessage.error(e.response?.data?.message ?? t('payroll.payError')),
  })

  const bulkPayMut = useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/finance/payroll/bulk-pay', { ids }),
    onSuccess: (res) => {
      antMessage.success(res.data.message)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['finance', 'payroll'] })
      qc.invalidateQueries({ queryKey: ['finance', 'payroll-summary'] })
    },
    onError: (e: any) => antMessage.error(e.response?.data?.message ?? t('payroll.payError')),
  })

  // ── Derived ──────────────────────────────────────────────────

  const filtered = useMemo(() =>
    records.filter(r =>
      r.staff.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.staff.staffId.toLowerCase().includes(search.toLowerCase()) ||
      r.staff.department.name.toLowerCase().includes(search.toLowerCase())
    ), [records, search])

  const draftIds = filtered.filter(r => r.status === 'draft').map(r => r.id)
  const allDraftSelected = draftIds.length > 0 && draftIds.every(id => selected.has(id))

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleAllDraft = () =>
    setSelected(prev => {
      if (allDraftSelected) {
        const n = new Set(prev)
        draftIds.forEach(id => n.delete(id))
        return n
      }
      return new Set([...prev, ...draftIds])
    })

  const openEdit = (r: PayrollRecord) => {
    setEditRecord(r)
    setEditAllowances(String(r.allowances))
    setEditDeductions(String(r.deductions))
  }

  const submitEdit = () => {
    if (!editRecord) return
    const a = parseFloat(editAllowances)
    const d = parseFloat(editDeductions)
    if (isNaN(a) || isNaN(d) || a < 0 || d < 0) {
      antMessage.error(t('payroll.invalidAmount'))
      return
    }
    editMut.mutate({ id: editRecord.id, allowances: a, deductions: d })
  }

  const previewNet = editRecord
    ? editRecord.basicSalary + (parseFloat(editAllowances) || 0) - (parseFloat(editDeductions) || 0)
    : 0

  // ── Columns ──────────────────────────────────────────────────

  const columns: ColumnDef<PayrollRecord>[] = [
    {
      key: 'select',
      title: (
        <Checkbox
          checked={allDraftSelected}
          onChange={toggleAllDraft}
          title={t('payroll.selectAllDraft')}
        />
      ) as any,
      render: r => r.status === 'draft'
        ? <Checkbox checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
        : null,
    },
    {
      key: 'staff',
      title: t('payroll.colStaff'),
      render: r => (
        <div>
          <div className={styles.staffName}>{r.staff.fullName}</div>
          <div className={styles.staffMeta}>{r.staff.staffId} · {r.staff.department.name}</div>
        </div>
      ),
    },
    {
      key: 'month',
      title: t('payroll.colMonth'),
      render: r => <span className={styles.mono}>{fmtMonth(r.payrollMonth)}</span>,
    },
    {
      key: 'basicSalary',
      title: t('payroll.colBasic'),
      render: r => <span className={styles.amount}>{fmtBND(r.basicSalary)}</span>,
    },
    {
      key: 'allowances',
      title: t('payroll.colAllowances'),
      render: r => <span className={styles.positive}>{fmtBND(r.allowances)}</span>,
    },
    {
      key: 'deductions',
      title: t('payroll.colDeductions'),
      render: r => (
        <div>
          <span className={styles.negative}>{fmtBND(r.deductions)}</span>
          <div className={styles.deductNote}>{t('payroll.tapScp')}</div>
        </div>
      ),
    },
    {
      key: 'netSalary',
      title: t('payroll.colNet'),
      render: r => <strong className={styles.net}>{fmtBND(r.netSalary)}</strong>,
    },
    {
      key: 'status',
      title: t('common.status'),
      render: r => (
        <Badge color={r.status === 'paid' ? 'green' : 'orange'}>
          {r.status === 'paid' ? t('payroll.paid') : t('payroll.draft')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: '',
      render: r => (
        <div className={styles.actions}>
          {r.status === 'draft' && (
            <>
              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                <Edit2 size={13} />
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => payOneMut.mutate(r.id)}
                loading={payOneMut.isPending}
              >
                {t('payroll.pay')}
              </Button>
            </>
          )}
          {r.status === 'paid' && r.paidAt && (
            <span className={styles.paidDate}>
              {new Date(r.paidAt).toLocaleDateString('en-GB')}
            </span>
          )}
        </div>
      ),
    },
  ]

  const selectedDraftIds = [...selected].filter(id => filtered.find(r => r.id === id && r.status === 'draft'))

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('payroll.title')}</h1>
          <p className={styles.pageSub}>{t('payroll.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={v => v && setSelectedMonth(v.startOf('month'))}
            allowClear={false}
            format="MMMM YYYY"
            className={styles.monthPicker}
          />
          <Button
            variant="primary"
            onClick={() => generateMut.mutate()}
            loading={generateMut.isPending}
          >
            <RefreshCw size={14} />
            {t('payroll.generate')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className={styles.kpiRow}>
          <StatCard
            title={t('payroll.kpiTotalPayroll')}
            value={`BND ${(summary.totalNetSalary / 1000).toFixed(1)}K`}
            sub={`${summary.totalRecords} ${t('payroll.records')}`}
            icon={<DollarSign size={16} />}
            color="blue"
          />
          <StatCard
            title={t('payroll.kpiPaid')}
            value={summary.paidCount}
            sub={t('payroll.kpiPaidSub')}
            icon={<CheckCircle size={16} />}
            color="green"
          />
          <StatCard
            title={t('payroll.kpiPending')}
            value={summary.draftCount}
            sub={t('payroll.kpiPendingSub')}
            icon={<Clock size={16} />}
            color="orange"
          />
          <StatCard
            title={t('payroll.kpiDeductions')}
            value={`BND ${summary.totalDeductions.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}
            sub={t('payroll.kpiDeductionsSub')}
            icon={<Users size={16} />}
            color="purple"
          />
        </div>
      )}

      {/* Deduction breakdown info */}
      <div className={styles.deductionInfo}>
        <CreditCard size={14} />
        <span>{t('payroll.deductionRule')}</span>
      </div>

      {/* Filters + Bulk Actions */}
      <Card
        title={`${t('payroll.tableTitle')} — ${selectedMonth.format('MMMM YYYY')}`}
        extra={
          <div className={styles.tableControls}>
            <AntInput
              placeholder={t('payroll.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              prefix={<Search size={13} />}
              allowClear
              style={{ width: 220 }}
            />
            <div className={styles.filterBtns}>
              {(['all', 'draft', 'paid'] as const).map(s => (
                <button
                  key={s}
                  className={`${styles.filterBtn} ${statusFilter === s ? styles.active : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {t(`payroll.filter${s.charAt(0).toUpperCase() + s.slice(1)}`)}
                </button>
              ))}
            </div>
            {selectedDraftIds.length > 0 && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => bulkPayMut.mutate(selectedDraftIds)}
                loading={bulkPayMut.isPending}
              >
                {t('payroll.bulkPay', { count: selectedDraftIds.length })}
              </Button>
            )}
          </div>
        }
        noPadding
      >
        <Table<PayrollRecord>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText={t('payroll.noRecords')}
        />
      </Card>

      {/* Edit Modal */}
      {editRecord && (
        <Modal
          open
          title={t('payroll.editTitle')}
          onClose={() => setEditRecord(null)}
          footer={
            <div className={styles.modalFooter}>
              <Button variant="ghost" onClick={() => setEditRecord(null)}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={submitEdit} loading={editMut.isPending}>
                {t('common.save')}
              </Button>
            </div>
          }
        >
          <div className={styles.editForm}>
            <div className={styles.editStaff}>
              <strong>{editRecord.staff.fullName}</strong>
              <span>{fmtMonth(editRecord.payrollMonth)}</span>
            </div>

            <div className={styles.editRow}>
              <label>{t('payroll.colBasic')}</label>
              <span className={styles.readOnly}>{fmtBND(editRecord.basicSalary)}</span>
            </div>

            <div className={styles.editRow}>
              <label>{t('payroll.colAllowances')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editAllowances}
                onChange={e => setEditAllowances(e.target.value)}
                className={styles.editInput}
              />
            </div>

            <div className={styles.editRow}>
              <label>{t('payroll.colDeductions')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editDeductions}
                onChange={e => setEditDeductions(e.target.value)}
                className={styles.editInput}
              />
            </div>

            <div className={styles.editDivider} />

            <div className={styles.editRow}>
              <label><strong>{t('payroll.colNet')}</strong></label>
              <strong className={styles.net}>{fmtBND(previewNet)}</strong>
            </div>

            <div className={styles.tapNote}>{t('payroll.tapNote')}</div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default PayrollManagementPage
