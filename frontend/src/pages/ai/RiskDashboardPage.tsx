import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts'
import { AlertTriangle, TrendingDown, Users, BookOpen } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
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

const OUTCOME_COLOR: Record<string, string> = {
  pass: '#00B42A',
  at_risk: '#FF7D00',
  fail: '#F53F3F',
}

const DEMO_OFFERING_ID = 'offering-demo'

// Demo risk scores since we don't have the right offeringId
const DEMO_SCORES: RiskScore[] = [
  { id: '1', studentId: 's1', offeringId: DEMO_OFFERING_ID, attendancePct: 45, quizAvg: 38, submissionRate: 60, riskScore: 0.82, predictedOutcome: 'fail', confidence: 0.89, computedAt: new Date().toISOString(), student: { user: { displayName: 'Ahmad bin Hassan' }, studentId: '2026002' } },
  { id: '2', studentId: 's2', offeringId: DEMO_OFFERING_ID, attendancePct: 55, quizAvg: 48, submissionRate: 72, riskScore: 0.71, predictedOutcome: 'fail', confidence: 0.78, computedAt: new Date().toISOString(), student: { user: { displayName: 'Zara binti Malik' }, studentId: '2026003' } },
  { id: '3', studentId: 's3', offeringId: DEMO_OFFERING_ID, attendancePct: 65, quizAvg: 55, submissionRate: 80, riskScore: 0.58, predictedOutcome: 'at_risk', confidence: 0.72, computedAt: new Date().toISOString(), student: { user: { displayName: 'Raj Kumar' }, studentId: '2026004' } },
  { id: '4', studentId: 's4', offeringId: DEMO_OFFERING_ID, attendancePct: 72, quizAvg: 62, submissionRate: 88, riskScore: 0.44, predictedOutcome: 'at_risk', confidence: 0.65, computedAt: new Date().toISOString(), student: { user: { displayName: 'Sarah Wong' }, studentId: '2026005' } },
  { id: '5', studentId: 's5', offeringId: DEMO_OFFERING_ID, attendancePct: 85, quizAvg: 74, submissionRate: 95, riskScore: 0.22, predictedOutcome: 'pass', confidence: 0.91, computedAt: new Date().toISOString(), student: { user: { displayName: 'Noor binti Abdullah' }, studentId: '2026001' } },
  { id: '6', studentId: 's6', offeringId: DEMO_OFFERING_ID, attendancePct: 92, quizAvg: 81, submissionRate: 100, riskScore: 0.08, predictedOutcome: 'pass', confidence: 0.96, computedAt: new Date().toISOString(), student: { user: { displayName: 'Li Wei' }, studentId: '2026006' } },
  { id: '7', studentId: 's7', offeringId: DEMO_OFFERING_ID, attendancePct: 40, quizAvg: 32, submissionRate: 55, riskScore: 0.91, predictedOutcome: 'fail', confidence: 0.94, computedAt: new Date().toISOString(), student: { user: { displayName: 'Mohammed Al-Rashid' }, studentId: '2026007' } },
  { id: '8', studentId: 's8', offeringId: DEMO_OFFERING_ID, attendancePct: 78, quizAvg: 68, submissionRate: 90, riskScore: 0.31, predictedOutcome: 'pass', confidence: 0.83, computedAt: new Date().toISOString(), student: { user: { displayName: 'Priya Sharma' }, studentId: '2026008' } },
]

const DEMO_COURSES = [
  { id: 'off-demo-1', name: 'IFN101 – Introduction to Programming', offeringId: DEMO_OFFERING_ID },
  { id: 'off-demo-2', name: 'IFN102 – Data Structures', offeringId: 'off-demo-2' },
]

const RiskDashboardPage: React.FC = () => {
  const [selectedCourse, setSelectedCourse] = useState(DEMO_COURSES[0])
  const { t } = useTranslation()

  const { data: scores = DEMO_SCORES } = useQuery<RiskScore[]>({
    queryKey: ['ai', 'risk', selectedCourse.offeringId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/ai/risk-dashboard/${selectedCourse.offeringId}`)
      return data.data.length > 0 ? data.data : DEMO_SCORES
    },
  })

  const displayScores = scores.length > 0 ? scores : DEMO_SCORES
  const failCount = displayScores.filter(s => s.predictedOutcome === 'fail').length
  const atRiskCount = displayScores.filter(s => s.predictedOutcome === 'at_risk').length
  const passCount = displayScores.filter(s => s.predictedOutcome === 'pass').length

  const distributionData = [
    { label: 'Pass', count: passCount, fill: '#00B42A' },
    { label: 'At Risk', count: atRiskCount, fill: '#FF7D00' },
    { label: 'Fail', count: failCount, fill: '#F53F3F' },
  ]

  const scatterData = displayScores.map(s => ({
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
          {DEMO_COURSES.map(c => (
            <button
              key={c.id}
              className={`${styles.courseBtn} ${selectedCourse.id === c.id ? styles.activeBtn : ''}`}
              onClick={() => setSelectedCourse(c)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <StatCard title={t('aiRisk.totalStudents')} value={displayScores.length} sub={t('aiRisk.inSelectedCourse')} icon={<Users size={16} />} color="blue" />
        <StatCard title={t('aiRisk.atRisk')} value={atRiskCount} sub={`${Math.round(atRiskCount / displayScores.length * 100)}% ${t('aiRisk.ofClass')}`} icon={<AlertTriangle size={16} />} color="orange" trend={{ value: -8, label: t('aiRisk.vsLastWeek') }} />
        <StatCard title={t('aiRisk.predictedFail')} value={failCount} sub={t('aiRisk.immediateIntervention')} icon={<TrendingDown size={16} />} color="red" />
        <StatCard title={t('aiRisk.onTrack')} value={passCount} sub={t('aiRisk.likelyToPass')} icon={<BookOpen size={16} />} color="green" />
      </div>

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
      <Card title={t('aiRisk.studentRiskScores')}>
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
          {displayScores.map(s => (
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
    </div>
  )
}

export default RiskDashboardPage
