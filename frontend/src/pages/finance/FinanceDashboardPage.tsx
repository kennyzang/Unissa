import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { DollarSign, TrendingUp, AlertCircle, CreditCard, Wallet, X } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import styles from './FinanceDashboardPage.module.scss'

interface BudgetSummary {
  totalBudget: number
  committed: number
  spent: number
  glCodes: GlCodeRow[]
}

interface RevenueSummary {
  totalRevenue: number
  tuitionRevenue: number
  campusCardRevenue: number
  tuitionPaymentCount: number
  campusCardTopUpCount: number
  recentTuitionPayments: Array<{
    id: string
    transactionRef: string
    amount: number
    method: string
    paidAt: string
    studentName: string
  }>
  recentCampusCardTopUps: Array<{
    id: string
    amount: number
    description: string
    createdAt: string
    studentName: string
  }>
}

interface GlCodeRow {
  id: string
  code: string
  description: string
  totalBudget: number
  committedAmount: number
  spentAmount: number
  availableBalance: number
  department?: { name: string }
}

interface PrRow {
  id: string
  title: string
  amount: number
  status: string
  requester: string
  submittedAt: string
}

const STATUS_COLOR: Record<string, 'blue' | 'green' | 'orange' | 'red' | 'gray'> = {
  PENDING:          'orange',
  FINANCE_APPROVED: 'blue',
  APPROVED:         'green',
  CONVERTED_TO_PO:  'green',
  REJECTED:         'red',
}

const FinanceDashboardPage: React.FC = () => {
  const { t } = useTranslation()
  const [drillGl, setDrillGl] = useState<GlCodeRow | null>(null)

  const { data, isLoading } = useQuery<BudgetSummary>({
    queryKey: ['finance', 'budget-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/budget-summary')
      return data.data
    },
  })

  const { data: revenueData } = useQuery<RevenueSummary>({
    queryKey: ['finance', 'revenue-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/revenue-summary')
      return data.data
    },
  })

  const { data: drillPrs = [], isLoading: drillLoading } = useQuery<PrRow[]>({
    queryKey: ['finance', 'gl-prs', drillGl?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/finance/gl-codes/${drillGl!.id}/purchase-requests`)
      return data.data
    },
    enabled: !!drillGl,
  })

  if (isLoading || !data) return <div className={styles.loading}>{t('financeDashboard.loading')}</div>

  const { totalBudget, committed, spent, glCodes } = data
  const available = totalBudget - committed - spent
  const committedPct = totalBudget > 0 ? Math.round((committed / totalBudget) * 100) : 0

  const chartData = glCodes.slice(0, 6).map(g => ({
    code: g.code,
    budget: g.totalBudget,
    committed: g.committedAmount,
    spent: g.spentAmount,
    available: g.availableBalance,
  }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('financeDashboard.title')}</h1>
        <p className={styles.pageSub}>{t('financeDashboard.subtitle')}</p>
      </div>

      <div className={styles.kpiRow}>
        <StatCard title={t('financeDashboard.totalBudget')} value={`BND ${(totalBudget / 1000).toFixed(0)}K`} sub={t('financeDashboard.fiscalYear')} icon={<DollarSign size={16} />} color="blue" />
        <StatCard title={t('financeDashboard.committed')} value={`${committedPct}%`} sub={`BND ${committed.toLocaleString()}`} icon={<TrendingUp size={16} />} color="orange" trend={{ value: 3.2, label: t('financeDashboard.vsLastMonth') }} />
        <StatCard title={t('financeDashboard.spent')} value={`BND ${spent.toLocaleString()}`} sub={`${Math.round(spent / totalBudget * 100)}% ${t('financeDashboard.ofTotal')}`} icon={<DollarSign size={16} />} color="green" />
        <StatCard title={t('financeDashboard.available')} value={`BND ${available.toLocaleString()}`} sub={t('financeDashboard.remainingBudget')} icon={<AlertCircle size={16} />} color={available < 50000 ? 'red' : 'blue'} />
      </div>

      {revenueData && (
        <div className={styles.kpiRow}>
          <StatCard title={t('financeDashboard.totalRevenue')} value={`BND ${revenueData.totalRevenue.toLocaleString()}`} sub={`${revenueData.tuitionPaymentCount + revenueData.campusCardTopUpCount} transactions`} icon={<DollarSign size={16} />} color="green" />
          <StatCard title={t('financeDashboard.tuitionRevenue')} value={`BND ${revenueData.tuitionRevenue.toLocaleString()}`} sub={`${revenueData.tuitionPaymentCount} payments`} icon={<CreditCard size={16} />} color="blue" />
          <StatCard title={t('financeDashboard.campusCardRevenue')} value={`BND ${revenueData.campusCardRevenue.toLocaleString()}`} sub={`${revenueData.campusCardTopUpCount} top-ups`} icon={<Wallet size={16} />} color="purple" />
        </div>
      )}

      <Card title={t('financeDashboard.glUtilisation')}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="code" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(v: number) => [`BND ${v.toLocaleString()}`]} />
            <Bar dataKey="budget" fill="#E5E6EB" radius={[4, 4, 0, 0]} barSize={32} name="Budget" />
            <Bar dataKey="committed" fill="#165DFF" radius={[4, 4, 0, 0]} barSize={20} name="Committed" />
            <Bar dataKey="spent" fill="#00B42A" radius={[4, 4, 0, 0]} barSize={10} name="Spent" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title={t('financeDashboard.glCodeDetails')} noPadding>
        <table className={styles.glTable}>
          <thead>
            <tr>
              <th>{t('financeDashboard.code')}</th><th>{t('financeDashboard.description')}</th><th>{t('financeDashboard.department')}</th>
              <th>{t('financeDashboard.budget')}</th><th>{t('financeDashboard.committed')}</th><th>{t('financeDashboard.spent')}</th><th>{t('financeDashboard.available')}</th><th>{t('financeDashboard.status')}</th>
            </tr>
          </thead>
          <tbody>
            {glCodes.map(g => {
              const utilPct = g.totalBudget > 0 ? Math.round(((g.committedAmount + g.spentAmount) / g.totalBudget) * 100) : 0
              return (
                <tr
                  key={g.id}
                  onClick={() => setDrillGl(g)}
                  style={{ cursor: 'pointer' }}
                  title={t('financeDashboard.clickToViewPRs', { defaultValue: 'Click to view purchase requests' })}
                >
                  <td className={styles.glCode}>{g.code}</td>
                  <td>{g.description}</td>
                  <td className={styles.dept}>{g.department?.name ?? '—'}</td>
                  <td>BND {g.totalBudget.toLocaleString()}</td>
                  <td>BND {g.committedAmount.toLocaleString()}</td>
                  <td>BND {g.spentAmount.toLocaleString()}</td>
                  <td className={g.availableBalance < 10000 ? styles.lowBalance : ''}><strong>BND {g.availableBalance.toLocaleString()}</strong></td>
                  <td>
                    <Badge color={utilPct >= 90 ? 'red' : utilPct >= 70 ? 'orange' : 'green'} size="sm">{utilPct}% {t('financeDashboard.used')}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {/* GL Code Drill-Down Modal */}
      {drillGl && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDrillGl(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '16px', padding: '28px 32px',
              minWidth: '640px', maxWidth: '90vw', maxHeight: '80vh',
              overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{drillGl.code}</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{drillGl.description}</p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px' }}>
                  <span>Budget: <strong>BND {drillGl.totalBudget.toLocaleString()}</strong></span>
                  <span>Committed: <strong>BND {drillGl.committedAmount.toLocaleString()}</strong></span>
                  <span>Available: <strong>BND {drillGl.availableBalance.toLocaleString()}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setDrillGl(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666' }}
              >
                <X size={20} />
              </button>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px', color: '#333' }}>
              {t('financeDashboard.purchaseRequests', { defaultValue: 'Purchase Requests' })}
            </h3>

            {drillLoading ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '24px' }}>Loading…</p>
            ) : drillPrs.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '24px' }}>
                {t('financeDashboard.noPRs', { defaultValue: 'No purchase requests against this GL code.' })}
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e6eb' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#666' }}>Title</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#666' }}>Requester</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: '#666' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#666' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#666' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {drillPrs.map(pr => (
                    <tr key={pr.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 12px' }}>{pr.title}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{pr.requester}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>BND {pr.amount.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge color={STATUS_COLOR[pr.status] ?? 'gray'} size="sm">
                          {pr.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#888' }}>
                        {new Date(pr.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FinanceDashboardPage
