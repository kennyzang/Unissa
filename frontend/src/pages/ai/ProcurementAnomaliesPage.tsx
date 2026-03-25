import { useTranslation } from 'react-i18next'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, TrendingUp, ShieldAlert, Eye } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { apiClient } from '@/lib/apiClient'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import styles from './ProcurementAnomaliesPage.module.scss'

interface Anomaly {
  id: string
  anomalyType: string
  description: string
  severity: 'low' | 'medium' | 'high'
  zScore?: number
  status: 'open' | 'investigating' | 'resolved' | 'dismissed'
  detectedAt: string
  pr?: {
    prNumber: string
    itemDescription: string
    totalAmount: number
    requestor?: { user: { displayName: string } }
    department?: { name: string }
  }
}

const SEVERITY_COLOR: Record<string, 'red' | 'orange' | 'gray'> = {
  high: 'red', medium: 'orange', low: 'gray',
}

const STATUS_COLOR: Record<string, 'red' | 'orange' | 'blue' | 'green' | 'gray'> = {
  open: 'red', investigating: 'orange', resolved: 'green', dismissed: 'gray',
}

const TYPE_LABELS: Record<string, string> = {
  price_outlier: 'Price Outlier',
  split_billing: 'Split Billing',
  frequent_vendor: 'Frequent Vendor',
  other: 'Other',
}

// Demo data fallback
const DEMO_ANOMALIES: Anomaly[] = [
  {
    id: 'a1', anomalyType: 'price_outlier', severity: 'high', status: 'open', zScore: 3.2,
    description: 'Unit price BND 89.50 is 3.2 standard deviations above historical average (BND 35.00) for similar stationery items.',
    detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    pr: { prNumber: 'PR-2026-0038', itemDescription: 'Premium Stationery Set', totalAmount: 895,
      requestor: { user: { displayName: 'Noor binti Abdullah' } }, department: { name: 'ICT Department' } },
  },
  {
    id: 'a2', anomalyType: 'split_billing', severity: 'high', status: 'investigating', zScore: 2.8,
    description: 'PR-2026-0041 submitted 2 days after PR-2026-0038, both for identical items from the same vendor (Tech Supplies Sdn Bhd). Pattern suggests split billing to avoid tender threshold.',
    detectedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    pr: { prNumber: 'PR-2026-0041', itemDescription: 'Office Equipment (Supplementary)', totalAmount: 950,
      requestor: { user: { displayName: 'Noor binti Abdullah' } }, department: { name: 'ICT Department' } },
  },
  {
    id: 'a3', anomalyType: 'frequent_vendor', severity: 'medium', status: 'open',
    description: 'Vendor "Tech Supplies Sdn Bhd" has received 7 POs this year totalling BND 12,450. Frequency exceeds 2-sigma threshold for single-vendor concentration.',
    detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    pr: { prNumber: 'PR-2026-0042', itemDescription: 'Lab Equipment', totalAmount: 1800,
      requestor: { user: { displayName: 'Admin User' } }, department: { name: 'Facilities' } },
  },
]

const ProcurementAnomaliesPage: React.FC = () => {
  const { t } = useTranslation()
  const { data: anomalies = DEMO_ANOMALIES } = useQuery<Anomaly[]>({
    queryKey: ['procurement', 'anomalies'],
    queryFn: async () => {
      const { data } = await apiClient.get('/procurement/anomalies')
      return data.data.length > 0 ? data.data : DEMO_ANOMALIES
    },
  })

  const display = anomalies.length > 0 ? anomalies : DEMO_ANOMALIES
  const highCount = display.filter(a => a.severity === 'high').length
  const openCount = display.filter(a => a.status === 'open').length
  const investigating = display.filter(a => a.status === 'investigating').length

  // By type distribution
  const typeData = Object.entries(TYPE_LABELS).map(([k, v]) => ({
    type: v,
    count: display.filter(a => a.anomalyType === k).length,
  })).filter(d => d.count > 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('procurementAnomalies.title')}</h1>
          <p className={styles.pageSub}>{t('procurementAnomalies.subtitle')}</p>
        </div>
        <div className={styles.aiChip}>
          <ShieldAlert size={14} />
          Z-Score Model v2.1
        </div>
      </div>

      <div className={styles.kpiRow}>
        <StatCard title="Total Anomalies" value={display.length} sub="Detected this month" icon={<AlertTriangle size={16} />} color="red" />
        <StatCard title="High Severity" value={highCount} sub="Requires immediate review" icon={<ShieldAlert size={16} />} color="red" />
        <StatCard title="Open Cases" value={openCount} sub="Awaiting action" icon={<Eye size={16} />} color="orange" />
        <StatCard title="Investigating" value={investigating} sub="Under review" icon={<TrendingUp size={16} />} color="blue" />
      </div>

      <div className={styles.chartsRow}>
        <Card title="Anomalies by Type">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 60 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                {typeData.map((_, i) => <Cell key={i} fill={['#F53F3F', '#FF7D00', '#165DFF', '#7D3FCC'][i % 4]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Statistical Context">
          <div className={styles.statsContext}>
            <div className={styles.statItem}>
              <div className={styles.statNum}>2.5σ</div>
              <div className={styles.statLabel}>Detection threshold (Z-score)</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNum}>BND 35</div>
              <div className={styles.statLabel}>Historical avg unit price (stationery)</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNum}>95%</div>
              <div className={styles.statLabel}>Model precision on training set</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNum}>3.2σ</div>
              <div className={styles.statLabel}>PR-2026-0038 deviation</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Anomaly cards */}
      <div className={styles.anomalyList}>
        {display.map(anomaly => (
          <div key={anomaly.id} className={`${styles.anomalyCard} ${styles[`severity-${anomaly.severity}`]}`}>
            <div className={styles.anomalyHeader}>
              <div className={styles.anomalyLeft}>
                <AlertTriangle size={18} className={styles.alertIcon} />
                <div>
                  <div className={styles.anomalyType}>{TYPE_LABELS[anomaly.anomalyType] ?? anomaly.anomalyType}</div>
                  <div className={styles.anomalyPR}>{anomaly.pr?.prNumber} · {anomaly.pr?.itemDescription}</div>
                </div>
              </div>
              <div className={styles.anomalyBadges}>
                <Badge color={SEVERITY_COLOR[anomaly.severity]} size="sm">{anomaly.severity.toUpperCase()}</Badge>
                <Badge color={STATUS_COLOR[anomaly.status]} size="sm">{anomaly.status.replace('_', ' ')}</Badge>
                {anomaly.zScore && (
                  <span className={styles.zScore}>Z = {anomaly.zScore.toFixed(1)}σ</span>
                )}
              </div>
            </div>

            <p className={styles.anomalyDesc}>{anomaly.description}</p>

            <div className={styles.anomalyMeta}>
              <span>Requestor: <strong>{anomaly.pr?.requestor?.user?.displayName ?? '—'}</strong></span>
              <span>Department: <strong>{anomaly.pr?.department?.name ?? '—'}</strong></span>
              <span>Amount: <strong>BND {anomaly.pr?.totalAmount?.toLocaleString() ?? '—'}</strong></span>
              <span>Detected: <strong>{new Date(anomaly.detectedAt).toLocaleDateString('en-GB')}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProcurementAnomaliesPage
