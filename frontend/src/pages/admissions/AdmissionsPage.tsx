import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, ChevronRight, ArrowRight } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import styles from './AdmissionsPage.module.scss'

interface Applicant {
  id: string
  fullName: string
  status: string
  createdAt: string
  programme?: { name: string; code: string } | null
  intake?: { name: string } | null
}

interface FunnelData {
  funnel: { applied: number; offered: number; accepted: number; enrolled: number }
  recent: Applicant[]
}

const STATUS_COLOR: Record<string, 'blue' | 'green' | 'orange' | 'gray' | 'purple' | 'red'> = {
  submitted: 'blue',
  under_review: 'blue',
  offered:   'purple',
  accepted:  'green',
  rejected:  'red',
  withdrawn: 'gray',
  enrolled:  'green',
}

const FUNNEL_STEPS = [
  { key: 'applied',  label: 'Applied',  color: '#165DFF', bg: '#E8F3FF' },
  { key: 'offered',  label: 'Offered',  color: '#7D3FCC', bg: '#F5EEFF' },
  { key: 'accepted', label: 'Accepted', color: '#00B42A', bg: '#E8FFEA' },
  { key: 'enrolled', label: 'Enrolled', color: '#0FC6C2', bg: '#E8FFFB' },
] as const

export default function AdmissionsPage() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<FunnelData>({
    queryKey: ['admissions', 'funnel'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admissions/funnel')
      return data.data
    },
  })

  if (isLoading) {
    return <div className={styles.loading}>Loading enrollment data…</div>
  }

  const funnel = data?.funnel ?? { applied: 0, offered: 0, accepted: 0, enrolled: 0 }
  const maxVal = Math.max(funnel.applied, 1)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Student Enrollment Pipeline</h1>
          <p className={styles.sub}>End-to-end applicant funnel · real-time counts</p>
        </div>
        <button className={styles.reviewBtn} onClick={() => navigate('/admission/review')}>
          Review Applications <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Funnel ── */}
      <Card title="Enrollment Funnel" className={styles.funnelCard}>
        <div className={styles.funnel}>
          {FUNNEL_STEPS.map((step, i) => {
            const val = funnel[step.key]
            const pct = Math.round((val / maxVal) * 100)
            const convPct = i > 0
              ? funnel[FUNNEL_STEPS[i - 1].key] > 0
                ? Math.round((val / funnel[FUNNEL_STEPS[i - 1].key]) * 100)
                : 0
              : 100

            return (
              <React.Fragment key={step.key}>
                <div className={styles.funnelStep} style={{ '--accent': step.color, '--bg': step.bg } as React.CSSProperties}>
                  <div className={styles.funnelBar}>
                    <div
                      className={styles.funnelFill}
                      style={{ width: `${pct}%`, background: step.color }}
                    />
                  </div>
                  <div className={styles.funnelMeta}>
                    <span className={styles.funnelLabel}>{step.label}</span>
                    <span className={styles.funnelCount} style={{ color: step.color }}>{val.toLocaleString()}</span>
                    {i > 0 && (
                      <span className={styles.funnelConv}>{convPct}% conversion</span>
                    )}
                  </div>
                </div>
                {i < FUNNEL_STEPS.length - 1 && (
                  <div className={styles.funnelArrow}>
                    <ArrowRight size={14} style={{ color: '#C9CDD4' }} />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </Card>

      {/* ── KPI summary row ── */}
      <div className={styles.kpiRow}>
        {FUNNEL_STEPS.map(step => (
          <div key={step.key} className={styles.kpiCard} style={{ '--accent': step.color } as React.CSSProperties}>
            <div className={styles.kpiIcon} style={{ background: step.bg }}>
              <Users size={16} style={{ color: step.color }} />
            </div>
            <div className={styles.kpiVal} style={{ color: step.color }}>{funnel[step.key].toLocaleString()}</div>
            <div className={styles.kpiLabel}>{step.label}</div>
          </div>
        ))}
      </div>

      {/* ── Recent applicants ── */}
      <Card title="Recent Applications" className={styles.tableCard}>
        {(!data?.recent || data.recent.length === 0) ? (
          <div className={styles.empty}>No applications yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Programme</th>
                <th>Intake</th>
                <th>Status</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map(app => (
                <tr key={app.id} className={styles.row} onClick={() => navigate('/admission/review')}>
                  <td><strong>{app.fullName}</strong></td>
                  <td>
                    {app.programme
                      ? <><span className={styles.code}>{app.programme.code}</span> {app.programme.name}</>
                      : '—'}
                  </td>
                  <td>{app.intake?.name ?? '—'}</td>
                  <td>
                    <Badge color={STATUS_COLOR[app.status] ?? 'gray'} size="sm">
                      {app.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className={styles.date}>
                    {new Date(app.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
