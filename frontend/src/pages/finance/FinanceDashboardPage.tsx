import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
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
  const { data, isLoading } = useQuery<BudgetSummary>({
    queryKey: ['finance', 'budget-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/budget-summary')
      return data.data
    },
  })

  if (isLoading || !data) return <div className={styles.loading}>Loading finance data…</div>

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
        <h1 className={styles.pageTitle}>Finance Dashboard</h1>
        <p className={styles.pageSub}>Budget overview and GL code utilisation</p>
      </div>

      <div className={styles.kpiRow}>
        <StatCard title="Total Budget" value={`BND ${(totalBudget / 1000).toFixed(0)}K`} sub="Fiscal Year 2026" icon={<DollarSign size={16} />} color="blue" />
        <StatCard title="Committed" value={`${committedPct}%`} sub={`BND ${committed.toLocaleString()}`} icon={<TrendingUp size={16} />} color="orange" trend={{ value: 3.2, label: 'vs last month' }} />
        <StatCard title="Spent" value={`BND ${spent.toLocaleString()}`} sub={`${Math.round(spent / totalBudget * 100)}% of total`} icon={<DollarSign size={16} />} color="green" />
        <StatCard title="Available" value={`BND ${available.toLocaleString()}`} sub="Remaining budget" icon={<AlertCircle size={16} />} color={available < 50000 ? 'red' : 'blue'} />
      </div>

      <Card title="GL Code Budget Utilisation">
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

      <Card title="GL Code Details" noPadding>
        <table className={styles.glTable}>
          <thead>
            <tr>
              <th>Code</th><th>Description</th><th>Department</th>
              <th>Budget</th><th>Committed</th><th>Spent</th><th>Available</th><th>Status</th>
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
                    <Badge color={utilPct >= 90 ? 'red' : utilPct >= 70 ? 'orange' : 'green'} size="sm">{utilPct}% used</Badge>
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
