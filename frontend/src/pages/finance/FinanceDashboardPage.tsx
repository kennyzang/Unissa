import { useTranslation } from 'react-i18next'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { DollarSign, TrendingUp, AlertCircle, CreditCard, Wallet } from 'lucide-react'
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

const FinanceDashboardPage: React.FC = () => {
  const { t } = useTranslation()
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
                <tr key={g.id}>
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
    </div>
  )
}

export default FinanceDashboardPage
