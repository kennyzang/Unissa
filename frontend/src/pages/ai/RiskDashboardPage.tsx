import { useTranslation } from 'react-i18next'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts'
import { AlertTriangle, TrendingDown, Users, BookOpen, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import Button from '@/components/ui/Button'
import styles from './RiskDashboardPage.module.scss'

interface RiskScore {
  id: string
  studentId: string
  offeringId: string
  attendancePct: number
  quizAvg: number
  submissionRate: number
  riskScore: number
  predictedOutcome: 'pass' | 'fail' | 'at_risk'
  confidence: number
  advisorNotifiedAt?: string
  computedAt: string
  student?: { user: { displayName: string }; studentId: string }
}

interface Offering {
  id: string
  course: { code: string; name: string }
  _count: { enrolments: number }
}

const OUTCOME_COLOR: Record<string, string> = {
  pass: '#00B42A',
  at_risk: '#FF7D00',
  fail: '#F53F3F',
}

const RiskDashboardPage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null)

  // Fetch the lecturer's real course offerings
  const { data: offerings = [] } = useQuery<Offering[]>({
    queryKey: ['lms', 'lecturer-offerings', user?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/offerings/lecturer/${user!.id}`)
      return data.data
    },
    enabled: !!user,
  })

  // Auto-select first offering once loaded
  useEffect(() => {
    if (offerings.length > 0 && !selectedOfferingId) {
      setSelectedOfferingId(offerings[0].id)
    }
  }, [offerings, selectedOfferingId])

  // Fetch risk scores for the selected offering
  const { data: scores = [], isLoading: scoresLoading } = useQuery<RiskScore[]>({
    queryKey: ['ai', 'risk', selectedOfferingId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/ai/risk-dashboard/${selectedOfferingId}`)
      return data.data
    },
    enabled: !!selectedOfferingId,
  })

  // Compute / refresh risk scores mutation
  const computeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/ai/risk-scores/compute/${selectedOfferingId}`)
      return data.data as RiskScore[]
    },
    onSuccess: () => {
      addToast({ type: 'success', message: t('aiRisk.scoresComputed', { defaultValue: 'Risk scores computed successfully' }) })
      qc.invalidateQueries({ queryKey: ['ai', 'risk', selectedOfferingId] })
    },
    onError: () => {
      addToast({ type: 'error', message: t('aiRisk.computeFailed', { defaultValue: 'Failed to compute risk scores' }) })
    },
  })

  const selectedOffering = offerings.find(o => o.id === selectedOfferingId)

  const failCount = scores.filter(s => s.predictedOutcome === 'fail').length
  const atRiskCount = scores.filter(s => s.predictedOutcome === 'at_risk').length
  const passCount = scores.filter(s => s.predictedOutcome === 'pass').length

  const distributionData = [
    { label: 'Pass', count: passCount, fill: '#00B42A' },
    { label: 'At Risk', count: atRiskCount, fill: '#FF7D00' },
    { label: 'Fail', count: failCount, fill: '#F53F3F' },
  ]

  const scatterData = scores.map(s => ({
    attendance: s.attendancePct,
    quiz: s.quizAvg,
    risk: Math.round(s.riskScore * 100),
    name: s.student?.user?.displayName,
    outcome: s.predictedOutcome,
  }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('aiRisk.title')}</h1>
          <p className={styles.pageSub}>{t('aiRisk.subtitle')}</p>
        </div>
        <div className={styles.courseSelector}>
          {offerings.map(o => (
            <button
              key={o.id}
              className={`${styles.courseBtn} ${selectedOfferingId === o.id ? styles.activeBtn : ''}`}
              onClick={() => setSelectedOfferingId(o.id)}
            >
              {o.course.code} – {o.course.name}
            </button>
          ))}
          {selectedOfferingId && (
            <Button
              size="sm"
              variant="secondary"
              loading={computeMutation.isPending}
              onClick={() => computeMutation.mutate()}
            >
              <RefreshCw size={14} />
              {t('aiRisk.refreshScores', { defaultValue: 'Refresh Risk Scores' })}
            </Button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <StatCard title={t('aiRisk.totalStudents')} value={scores.length} sub={t('aiRisk.inSelectedCourse')} icon={<Users size={16} />} color="blue" />
        <StatCard title={t('aiRisk.atRisk')} value={atRiskCount} sub={scores.length > 0 ? `${Math.round(atRiskCount / scores.length * 100)}% ${t('aiRisk.ofClass')}` : '—'} icon={<AlertTriangle size={16} />} color="orange" />
        <StatCard title={t('aiRisk.predictedFail')} value={failCount} sub={t('aiRisk.immediateIntervention')} icon={<TrendingDown size={16} />} color="red" />
        <StatCard title={t('aiRisk.onTrack')} value={passCount} sub={t('aiRisk.likelyToPass')} icon={<BookOpen size={16} />} color="green" />
      </div>

      {scoresLoading ? (
        <Card>
          <div className={styles.emptyState}>
            <p>{t('common.loading', { defaultValue: 'Loading…' })}</p>
          </div>
        </Card>
      ) : scores.length === 0 ? (
        <Card>
          <div className={styles.emptyState}>
            <AlertTriangle size={40} />
            <h3>{t('aiRisk.noScores', { defaultValue: 'No risk scores yet' })}</h3>
            <p>{t('aiRisk.noScoresHint', { defaultValue: 'Click Calculate to compute risk scores from real attendance and submission data.' })}</p>
            <Button
              loading={computeMutation.isPending}
              disabled={!selectedOfferingId}
              onClick={() => computeMutation.mutate()}
            >
              <RefreshCw size={14} />
              {t('aiRisk.calculateScores', { defaultValue: 'Calculate Risk Scores' })}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className={styles.chartsRow}>
            {/* Outcome distribution */}
            <Card title={t('aiRisk.outcomeDistribution')}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={distributionData} barSize={28} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#86909C' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#86909C' }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #E5E6EB' }} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {distributionData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Attendance vs Quiz scatter */}
            <Card title={t('aiRisk.attendanceVsQuiz')} extra={<span className={styles.scatterLegend}><span style={{ color: '#F53F3F' }}>● {t('aiRisk.predictedFail').toLowerCase()}</span> <span style={{ color: '#FF7D00' }}>● {t('aiRisk.atRisk').toLowerCase()}</span> <span style={{ color: '#00B42A' }}>● {t('aiRisk.onTrack').toLowerCase()}</span></span>}>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                  <XAxis type="number" dataKey="attendance" name="Attendance %" domain={[0, 100]} tick={{ fontSize: 11, fill: '#86909C' }} axisLine={false} tickLine={false} label={{ value: 'Attendance %', position: 'insideBottom', offset: -4, fontSize: 10, fill: '#86909C' }} />
                  <YAxis type="number" dataKey="quiz" name="Quiz Avg" domain={[0, 100]} tick={{ fontSize: 11, fill: '#86909C' }} axisLine={false} tickLine={false} width={26} />
                  <ZAxis type="number" dataKey="risk" range={[20, 80]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#E5E6EB' }} contentStyle={{ fontSize: 11, borderRadius: 4, border: '1px solid #E5E6EB' }} formatter={(v: any, n: string) => [v, n]} />
                  <Scatter
                    data={scatterData}
                    fill="#165DFF"
                    shape={(props: any) => {
                      const { cx, cy, payload } = props
                      return <circle cx={cx} cy={cy} r={5} fill={OUTCOME_COLOR[payload.outcome] ?? '#ccc'} fillOpacity={0.85} stroke="white" strokeWidth={1} />
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Student risk table */}
          <Card title={`${t('aiRisk.studentRiskScores')}${selectedOffering ? ` — ${selectedOffering.course.code}` : ''}`}>
            <div className={styles.riskTable}>
              <div className={styles.riskTableHeader}>
                <span>{t('aiRisk.student')}</span>
                <span>{t('aiRisk.attendance')}</span>
                <span>{t('aiRisk.quizAvg')}</span>
                <span>{t('aiRisk.submission')}</span>
                <span>{t('aiRisk.riskScore')}</span>
                <span>{t('aiRisk.prediction')}</span>
                <span>{t('aiRisk.confidence')}</span>
                <span>{t('aiRisk.notified')}</span>
              </div>
              {scores.map(s => (
                <div key={s.id} className={`${styles.riskRow} ${s.predictedOutcome === 'fail' ? styles.failRow : s.predictedOutcome === 'at_risk' ? styles.riskRowWarning : ''}`}>
                  <div>
                    <div className={styles.studentName}>{s.student?.user?.displayName ?? 'Unknown'}</div>
                    <div className={styles.studentId}>{s.student?.studentId}</div>
                  </div>
                  <div>
                    <div className={`${styles.metricBar} ${s.attendancePct < 60 ? styles.metricDanger : s.attendancePct < 75 ? styles.metricWarning : styles.metricGood}`}>
                      <div className={styles.metricFill} style={{ width: `${s.attendancePct}%` }} />
                    </div>
                    <span className={styles.metricValue}>{s.attendancePct}%</span>
                  </div>
                  <div>
                    <div className={`${styles.metricBar} ${s.quizAvg < 40 ? styles.metricDanger : s.quizAvg < 60 ? styles.metricWarning : styles.metricGood}`}>
                      <div className={styles.metricFill} style={{ width: `${s.quizAvg}%` }} />
                    </div>
                    <span className={styles.metricValue}>{s.quizAvg}</span>
                  </div>
                  <div>
                    <span className={styles.metricValue}>{s.submissionRate}%</span>
                  </div>
                  <div>
                    <div className={styles.riskGauge}>
                      <div className={styles.riskFill} style={{ width: `${s.riskScore * 100}%`, background: s.riskScore > 0.7 ? '#F53F3F' : s.riskScore > 0.4 ? '#FF7D00' : '#00B42A' }} />
                    </div>
                    <span className={styles.metricValue} style={{ color: s.riskScore > 0.7 ? '#F53F3F' : s.riskScore > 0.4 ? '#FF7D00' : '#00B42A' }}>
                      {Math.round(s.riskScore * 100)}%
                    </span>
                  </div>
                  <Badge color={s.predictedOutcome === 'fail' ? 'red' : s.predictedOutcome === 'at_risk' ? 'orange' : 'green'} size="sm">
                    {s.predictedOutcome.replace('_', ' ')}
                  </Badge>
                  <span className={styles.confidence}>{Math.round(s.confidence * 100)}%</span>
                  <span className={styles.notified}>
                    {s.advisorNotifiedAt
                      ? <Badge color="green" size="sm">✓ Notified</Badge>
                      : s.predictedOutcome !== 'pass'
                      ? <Badge color="orange" size="sm">Pending</Badge>
                      : '—'
                    }
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export default RiskDashboardPage
