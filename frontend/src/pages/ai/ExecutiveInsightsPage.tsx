import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Lightbulb } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import Badge from '@/components/ui/Badge'
import styles from './RiskDashboardPage.module.scss'

interface InsightItem {
  id: string
  category: string
  headline: string
  body: string
  severity: 'info' | 'warning' | 'critical' | 'positive'
  generatedAt: string
}

const SEVERITY_MAP: Record<string, { color: 'blue' | 'green' | 'red' | 'orange' | 'gray'; label: string }> = {
  info:     { color: 'blue',   label: 'Info' },
  positive: { color: 'green',  label: 'Positive' },
  warning:  { color: 'orange', label: 'Warning' },
  critical: { color: 'red',    label: 'Critical' },
}

const ExecutiveInsightsPage: React.FC = () => {
  const { t } = useTranslation()

  const { data: insights = [], isLoading, refetch, isFetching } = useQuery<InsightItem[]>({
    queryKey: ['dashboard', 'insights'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/insights')
      return data.data as InsightItem[]
    },
    refetchInterval: 60_000,
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('dashboard.aiInsights', { defaultValue: 'AI Executive Insights' })}</h1>
          <p className={styles.pageSub}>
            {t('dashboard.aiInsightsSub', { defaultValue: 'Data-driven observations generated from live institutional data.' })}
          </p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={14} className={isFetching ? styles.spinning : ''} />
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </button>
      </div>

      {isLoading ? (
        <p className={styles.empty}>Loading insights…</p>
      ) : insights.length === 0 ? (
        <div className={styles.emptyState}>
          <Lightbulb size={40} style={{ color: '#8c8c8c', margin: '0 auto 12px' }} />
          <p>{t('dashboard.noInsights', { defaultValue: 'No active insights at this time.' })}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {insights.map(item => {
            const cfg = SEVERITY_MAP[item.severity] ?? SEVERITY_MAP.info
            return (
              <div
                key={item.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e6eb',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Badge color={cfg.color} size="sm">{cfg.label}</Badge>
                  <Badge color="gray" size="sm">{item.category}</Badge>
                  <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: 'auto' }}>
                    {new Date(item.generatedAt).toLocaleString()}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1d1d1d' }}>{item.headline}</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#4e5969', lineHeight: 1.6 }}>{item.body}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ExecutiveInsightsPage
