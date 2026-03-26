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

const TYPE_KEY: Record<string, string> = {
  price_outlier: 'procurementAnomalies.priceOutlier',
  split_billing:  'procurementAnomalies.splitBilling',
  frequent_vendor: 'procurementAnomalies.frequentVendor',
  other:          'procurementAnomalies.other',
}

const SEVERITY_KEY: Record<string, string> = {
  high:   'procurementAnomalies.severityHigh',
  medium: 'procurementAnomalies.severityMedium',
  low:    'procurementAnomalies.severityLow',
}

const STATUS_KEY: Record<string, string> = {
  open:          'procurementAnomalies.statusOpen',
  investigating: 'procurementAnomalies.investigating',
  resolved:      'procurementAnomalies.statusResolved',
  dismissed:     'procurementAnomalies.statusDismissed',
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
  const highCount    = display.filter(a => a.severity === 'high').length
  const openCount    = display.filter(a => a.status === 'open').length
  const investigating = display.filter(a => a.status === 'investigating').length

  const typeData = Object.keys(TYPE_KEY).map(k => ({
    type: t(TYPE_KEY[k] as any),
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
          {t('procurementAnomalies.modelLabel')}
        </div>
      </div>

      <div className={styles.kpiRow}>
        <StatCard title={t('procurementAnomalies.totalAnomalies')} value={display.length} sub={t('procurementAnomalies.detectedThisMonth')} icon={<AlertTriangle size={16} />} color="red" />
        <StatCard title={t('procurementAnomalies.highSeverity')}   value={highCount}       sub={t('procurementAnomalies.requiresReview')}   icon={<ShieldAlert size={16} />}  color="red" />
        <StatCard title={t('procurementAnomalies.openCases')}      value={openCount}       sub={t('procurementAnomalies.awaitingAction')}   icon={<Eye size={16} />}          color="orange" />
        <StatCard title={t('procurementAnomalies.investigating')}  value={investigating}   sub={t('procurementAnomalies.underReview')}      icon={<TrendingUp size={16} />}   color="blue" />
      </div>

      <div className={styles.chartsRow}>
        <Card title={t('procurementAnomalies.anomaliesByType')}>
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

        <Card title={t('procurementAnomalies.statisticalContext')}>
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
                  <div className={styles.anomalyType}>{t(TYPE_KEY[anomaly.anomalyType] as any, { defaultValue: anomaly.anomalyType })}</div>
                  <div className={styles.anomalyPR}>{anomaly.pr?.prNumber} · {anomaly.pr?.itemDescription}</div>
                </div>
              </div>
              <div className={styles.anomalyBadges}>
                <Badge color={SEVERITY_COLOR[anomaly.severity]} size="sm">{t(SEVERITY_KEY[anomaly.severity] as any, { defaultValue: anomaly.severity.toUpperCase() })}</Badge>
                <Badge color={STATUS_COLOR[anomaly.status]} size="sm">{t(STATUS_KEY[anomaly.status] as any, { defaultValue: anomaly.status })}</Badge>
                {anomaly.zScore && (
                  <span className={styles.zScore}>Z = {anomaly.zScore.toFixed(1)}σ</span>
                )}
              </div>
            </div>

            <p className={styles.anomalyDesc}>{anomaly.description}</p>

            <div className={styles.anomalyMeta}>
              <span>{t('procurementAnomalies.requestorLabel')} <strong>{anomaly.pr?.requestor?.user?.displayName ?? '—'}</strong></span>
              <span>{t('procurementAnomalies.departmentLabel')} <strong>{anomaly.pr?.department?.name ?? '—'}</strong></span>
              <span>{t('procurementAnomalies.amountLabel')} <strong>BND {anomaly.pr?.totalAmount?.toLocaleString() ?? '—'}</strong></span>
              <span>{t('procurementAnomalies.detectedLabel')} <strong>{new Date(anomaly.detectedAt).toLocaleDateString('en-GB')}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProcurementAnomaliesPage
