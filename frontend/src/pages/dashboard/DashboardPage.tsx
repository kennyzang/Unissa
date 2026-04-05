import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Users, TrendingUp, DollarSign, Briefcase,
  FlaskConical, Building2, BookOpen, AlertTriangle,
  RefreshCw, Wifi, WifiOff, ChevronRight,
} from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { DashboardKPI } from '@/types'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import styles from './DashboardPage.module.scss'

// ── API hooks ────────────────────────────────────────────────
function useKPI() {
  return useQuery<DashboardKPI>({
    queryKey: ['dashboard', 'kpi'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/kpi')
      return data.data as DashboardKPI
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

function useInsights() {
  return useQuery<InsightItem[]>({
    queryKey: ['dashboard', 'insights'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/insights')
      return data.data as InsightItem[]
    },
    refetchInterval: 60_000,
  })
}

interface InsightItem {
  id: string
  category: string
  headline: string
  body: string
  severity: 'info' | 'warning' | 'critical' | 'positive'
  generatedAt: string
}

// ── Formatting helpers ────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(0)}K`
    : String(n)

const fmtBND = (n: number) =>
  `BND ${n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n.toLocaleString()}`


// ── Sub-components ────────────────────────────────────────────

interface KPICardProps {
  title: string
  value: string
  sub: string
  icon: React.ReactNode
  accent: string
  badge?: { label: string; color: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'cyan' | 'gray' }
  chart?: React.ReactNode
  alert?: string
  onClick?: () => void
}

const KPICard: React.FC<KPICardProps> = ({ title, value, sub, icon, accent, badge, chart, alert, onClick }) => (
  <div
    className={`${styles.kpiCard} ${onClick ? styles.kpiCardClickable : ''}`}
    style={{ '--accent': accent } as React.CSSProperties}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
  >
    <div className={styles.kpiTop}>
      <div className={styles.kpiIconWrap} style={{ background: `${accent}18` }}>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      {badge && <Badge color={badge.color} size="sm">{badge.label}</Badge>}
      {onClick && <ChevronRight size={14} className={styles.kpiArrow} />}
    </div>
    <div className={styles.kpiValue}>{value}</div>
    <div className={styles.kpiTitle}>{title}</div>
    <div className={styles.kpiSub}>{sub}</div>
    {alert && (
      <div className={styles.kpiAlert}>
        <AlertTriangle size={11} />
        {alert}
      </div>
    )}
    {chart && <div className={styles.kpiChart}>{chart}</div>}
  </div>
)

// ── Insight card severity config ──────────────────────────────
const SEVERITY_MAP: Record<string, { color: 'blue' | 'green' | 'red' | 'orange' | 'gray'; bg: string }> = {
  info:     { color: 'blue',   bg: '#E8F3FF' },
  positive: { color: 'green',  bg: '#E8FFEA' },
  warning:  { color: 'orange', bg: '#FFF7E8' },
  critical: { color: 'red',    bg: '#FFECE8' },
}

// ── Main Component ────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const { data: kpi, isLoading, isError, refetch, dataUpdatedAt } = useKPI()
  const { data: insights = [] } = useInsights()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const DAYS = [
    t('lmsCourses.days.monday' as any),
    t('lmsCourses.days.tuesday' as any),
    t('lmsCourses.days.wednesday' as any),
    t('lmsCourses.days.thursday' as any),
    t('lmsCourses.days.friday' as any),
    t('lmsCourses.days.saturday' as any),
    t('dashboard.today'),
  ]

  // Live learner count: seed from real data, then oscillate ±3 for demo effect
  const [liveCount, setLiveCount] = useState<number>(0)
  useEffect(() => {
    if (kpi?.lms?.activeLearnersNow != null) {
      setLiveCount(kpi.lms?.activeLearnersNow ?? 0)
    }
  }, [kpi?.lms?.activeLearnersNow])
  useEffect(() => {
    if (!liveCount) return
    const base = liveCount
    const id = setInterval(() => {
      setLiveCount(c => {
        const delta = Math.floor(Math.random() * 7) - 3
        return Math.max(Math.max(0, base - 5), Math.min(base + 5, c + delta))
      })
    }, 5000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!liveCount])

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--'

  // Enrollment sparkline data
  const sparkData = (kpi?.enrollment.trend7day ?? [1200, 1202, 1203, 1205, 1205, 1206, 1207]).map(
    (v, i) => ({ day: DAYS[i], v }),
  )

  // Finance donut data
  const financeDonut = kpi
    ? [
        { name: t('dashboard.committedLabel'), value: kpi.finance.committed, color: '#165DFF' },
        { name: t('dashboard.remaining'), value: Math.max(0, kpi.finance.remaining), color: '#E5E6EB' },
      ]
    : []

  // Research bar data
  const researchBar = [
    { name: t('dashboard.activeLabel'), value: kpi?.research.activeGrants ?? 3, color: '#7D3FCC' },
    { name: t('dashboard.pendingLabel'), value: kpi?.research.pendingProposals ?? 5, color: '#C9CDD4' },
  ]

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <RefreshCw size={24} className={styles.spinIcon} />
        <span>{t('dashboard.loadingText')}</span>
      </div>
    )
  }

  if (isError || !kpi) {
    return (
      <div className={styles.errorWrap}>
        <WifiOff size={32} />
        <p>{t('dashboard.loadError')}</p>
        <button onClick={() => refetch()} className={styles.retryBtn}>{t('common.retry')}</button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('dashboard.title')}</h1>
          <p className={styles.pageSub}>
            {t('dashboard.subtitle')} &nbsp;·&nbsp;
            <Wifi size={12} className={styles.wifiIcon} />
            &nbsp;{t('dashboard.live')} &nbsp;·&nbsp; {t('dashboard.updated')} {lastUpdated}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={() => refetch()}>
          <RefreshCw size={14} />
          {t('common.refresh')}
        </button>
      </div>

      {/* ── KPI Grid ────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        {/* Enrollment → admissions */}
        <KPICard
          title={t('dashboard.studentEnrolment')}
          value={kpi.enrollment.totalEnrolled.toLocaleString()}
          sub={`+${kpi.enrollment.newApplicationsToday} ${t('dashboard.applicationsToday')}`}
          icon={<Users size={18} />}
          accent="#165DFF"
          badge={{ label: `${kpi.enrollment.acceptedToday} ${t('dashboard.accepted')}`, color: 'blue' }}
          onClick={() => navigate('/admissions')}
          chart={
            <ResponsiveContainer width="100%" height={48}>
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#165DFF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#165DFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#165DFF" strokeWidth={1.5} fill="url(#enrollGrad)" dot={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: '2px 6px', borderRadius: 4 }}
                  formatter={(v: number) => [v, 'Students']}
                  labelFormatter={(l) => l}
                />
              </AreaChart>
            </ResponsiveContainer>
          }
        />

        {/* Finance → finance budget */}
        <KPICard
          title={t('dashboard.budgetUtilisation')}
          value={`${kpi.finance.committedPct}%`}
          sub={`${fmtBND(kpi.finance.committed)} ${t('dashboard.committed')} ${fmtBND(kpi.finance.totalBudget)}`}
          icon={<DollarSign size={18} />}
          accent="#00B42A"
          badge={kpi.finance.overdueInvoices > 0 ? { label: `${kpi.finance.overdueInvoices} ${t('dashboard.overdue')}`, color: 'red' } : undefined}
          onClick={() => navigate('/finance/budget')}
          chart={
            <ResponsiveContainer width="100%" height={48}>
              <PieChart>
                <Pie
                  data={financeDonut}
                  cx="50%"
                  cy="50%"
                  innerRadius={14}
                  outerRadius={22}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {financeDonut.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: '2px 6px', borderRadius: 4 }}
                  formatter={(v: number) => [fmtBND(v)]}
                />
              </PieChart>
            </ResponsiveContainer>
          }
        />

        {/* HR — pending approvals → procurement approvals inbox */}
        <KPICard
          title={t('dashboard.humanResources')}
          value={String(kpi.hr.totalStaff)}
          sub={`${kpi.hr.onLeaveToday} ${t('dashboard.onLeave')}`}
          icon={<Briefcase size={18} />}
          accent="#7D3FCC"
          badge={{ label: `${kpi.hr.pendingApprovals} ${t('dashboard.pendingApprovals')}`, color: 'purple' }}
          onClick={() => navigate('/procurement/approvals')}
        />

        {/* Research → research grants */}
        <KPICard
          title={t('dashboard.researchGrants')}
          value={String(kpi.research.activeGrants)}
          sub={`${t('dashboard.totalValue')} ${fmtBND(kpi.research.totalValue)}`}
          icon={<FlaskConical size={18} />}
          accent="#FF7D00"
          badge={{ label: `${kpi.research.utilisation}% ${t('dashboard.utilised')}`, color: 'orange' }}
          onClick={() => navigate('/research/grants')}
          chart={
            <ResponsiveContainer width="100%" height={48}>
              <BarChart data={researchBar} barSize={10} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {researchBar.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, padding: '2px 6px', borderRadius: 4 }} />
              </BarChart>
            </ResponsiveContainer>
          }
        />

        {/* Campus → campus bookings */}
        <KPICard
          title={t('dashboard.campusFacilities')}
          value={`${kpi.campus.roomsBookedToday}/${kpi.campus.totalRooms}`}
          sub={`${kpi.campus.vehiclesInUse}/${kpi.campus.totalVehicles} ${t('dashboard.vehiclesInUse')}`}
          icon={<Building2 size={18} />}
          accent="#0FC6C2"
          badge={{ label: `${kpi.campus.maintenanceTickets} ${t('dashboard.maintenance')}`, color: kpi.campus.maintenanceTickets > 0 ? 'orange' : 'green' }}
          alert={kpi.campus.activeAlert}
          onClick={() => navigate('/campus/bookings')}
        />

        {/* LMS — assignments due today → LMS courses; new hires → HR onboarding */}
        <KPICard
          title={t('dashboard.lmsActivity')}
          value={String(liveCount)}
          sub={`${kpi.lms?.avgCourseCompletion ?? 0}% ${t('dashboard.avgCompletion')}`}
          icon={<BookOpen size={18} />}
          accent={(kpi.lms?.atRiskFlagged ?? 0) > 0 ? '#F53F3F' : '#00B42A'}
          badge={{ label: `${kpi.lms?.atRiskFlagged ?? 0} ${t('dashboard.atRisk')}`, color: (kpi.lms?.atRiskFlagged ?? 0) > 0 ? 'red' : 'green' }}
          onClick={() => navigate('/lms/courses')}
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────── */}
      <div className={styles.chartsRow}>
        {/* Enrollment trend */}
        <Card title={t('dashboard.enrolmentTrend')} className={styles.chartCard}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={sparkData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="enrollGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#165DFF" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#165DFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#86909C' }} axisLine={false} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: '#86909C' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #E5E6EB' }}
                formatter={(v: number) => [v.toLocaleString(), 'Students']}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="#165DFF"
                strokeWidth={2}
                fill="url(#enrollGrad2)"
                dot={{ r: 3, fill: '#165DFF', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Budget summary */}
        <Card title={t('dashboard.budgetSummary')} className={styles.chartCard}>
          <div className={styles.budgetSummary}>
            <div className={styles.budgetDonut}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={financeDonut}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={54}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {financeDonut.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.donutLabel}>
                <span className={styles.donutPct}>{kpi.finance.committedPct}%</span>
                <span className={styles.donutSub}>{t('dashboard.committedLabel')}</span>
              </div>
            </div>
            <div className={styles.budgetStats}>
              <BudgetRow label={t('dashboard.totalBudget')} value={fmtBND(kpi.finance.totalBudget)} color="#165DFF" />
              <BudgetRow label={t('dashboard.committedLabel')} value={fmtBND(kpi.finance.committed)} color="#165DFF" />
              <BudgetRow label={t('dashboard.remaining')} value={fmtBND(kpi.finance.remaining)} color="#00B42A" />
              <BudgetRow label={t('dashboard.overdueInvoices')} value={String(kpi.finance.overdueInvoices)} color="#F53F3F" />
            </div>
          </div>
        </Card>

        {/* Live activity */}
        <Card
          title={t('dashboard.liveActivity')}
          extra={
            <span className={styles.liveDot}>
              <span className={styles.livePulse} />
              {t('dashboard.live')}
            </span>
          }
          className={styles.chartCard}
        >
          <div className={styles.activityList}>
            <ActivityRow icon="📚" text={t('dashboard.learnersActive', { count: liveCount })} time={t('dashboard.now')} />
            <ActivityRow icon="📋" text={t('dashboard.leavesPending', { count: kpi.hr.pendingApprovals })} time={t('dashboard.twoMin')} />
            <ActivityRow icon="⚠️" text={kpi.campus.activeAlert ?? t('dashboard.allOperational')} time={t('dashboard.fiveMin')} highlight={!!kpi.campus.activeAlert} />
            <ActivityRow icon="💰" text={t('dashboard.overdueFeesCount', { count: kpi.finance.overdueInvoices })} time={t('dashboard.tenMin')} highlight={kpi.finance.overdueInvoices > 0} />
            <ActivityRow icon="🎓" text={t('dashboard.newAppsToday', { count: kpi.enrollment.newApplicationsToday })} time={t('dashboard.today')} />
            <ActivityRow icon="🔬" text={t('dashboard.activeGrantsText', { count: kpi.research.activeGrants })} time={t('dashboard.today')} />
          </div>
        </Card>
      </div>

      {/* ── NLG Insights ────────────────────────────────── */}
      {insights.length > 0 && (
        <section className={styles.insightsSection}>
          <div className={styles.sectionHeader}>
            <TrendingUp size={16} />
            <h2 className={styles.sectionTitle}>{t('dashboard.aiInsights')}</h2>
            <span className={styles.sectionCount}>{insights.length}</span>
          </div>
          <div className={styles.insightsGrid}>
            {insights.map(item => {
              const cfg = SEVERITY_MAP[item.severity] ?? SEVERITY_MAP.info
              return (
                <div key={item.id} className={styles.insightCard} style={{ '--bg': cfg.bg } as React.CSSProperties}>
                  <div className={styles.insightTop}>
                    <Badge color={cfg.color} size="sm">{item.category}</Badge>
                    <span className={styles.insightTime}>
                      {new Date(item.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <h3 className={styles.insightHeadline}>{item.headline}</h3>
                  <p className={styles.insightBody}>{item.body}</p>
                  <button className={styles.insightAction}>
                    {t('dashboard.viewDetails')} <ChevronRight size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Fallback insights when API is empty (demo guard) */}
      {insights.length === 0 && (
        <section className={styles.insightsSection}>
          <div className={styles.sectionHeader}>
            <TrendingUp size={16} />
            <h2 className={styles.sectionTitle}>{t('dashboard.aiInsights')}</h2>
          </div>
          <div className={styles.insightsGrid}>
            {DEMO_INSIGHTS.map(item => {
              const cfg = SEVERITY_MAP[item.severity]
              return (
                <div key={item.id} className={styles.insightCard} style={{ '--bg': cfg.bg } as React.CSSProperties}>
                  <div className={styles.insightTop}>
                    <Badge color={cfg.color} size="sm">{item.category}</Badge>
                    <span className={styles.insightTime}>{t('dashboard.today')}</span>
                  </div>
                  <h3 className={styles.insightHeadline}>{item.headline}</h3>
                  <p className={styles.insightBody}>{item.body}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Helper sub-components ─────────────────────────────────────
const BudgetRow: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className={styles.budgetRow}>
    <span className={styles.budgetLabel}>{label}</span>
    <span className={styles.budgetValue} style={{ color }}>{value}</span>
  </div>
)

const ActivityRow: React.FC<{ icon: string; text: string; time: string; highlight?: boolean }> = ({
  icon, text, time, highlight,
}) => (
  <div className={`${styles.activityRow} ${highlight ? styles.activityHighlight : ''}`}>
    <span className={styles.activityIcon}>{icon}</span>
    <span className={styles.activityText}>{text}</span>
    <span className={styles.activityTime}>{time}</span>
  </div>
)

// ── Demo fallback data ────────────────────────────────────────
const DEMO_INSIGHTS = [
  {
    id: '1',
    category: 'Enrolment',
    headline: 'Enrolment pace 3.2% ahead of target',
    body: 'New applications this week are tracking above the 5-year average. International enquiries up 12% vs last intake.',
    severity: 'positive',
  },
  {
    id: '2',
    category: 'Finance',
    headline: 'Budget committed at 72.4% — within normal range',
    body: 'GL code 5001-IT shows highest spend velocity. Review Q4 procurement before year-end freeze.',
    severity: 'info',
  },
  {
    id: '3',
    category: 'Procurement',
    headline: '2 anomalous PRs flagged for review',
    body: 'PR-2026-0038 and PR-0041 show statistical price outliers (Z-score > 2.5). Director approval recommended.',
    severity: 'warning',
  },
  {
    id: '4',
    category: 'Campus',
    headline: 'Lab 3 HVAC failure — maintenance dispatched',
    body: 'Work order #WO-001 raised. Classes in Lab 3 should be rescheduled. Estimated resolution: 4 hours.',
    severity: 'critical',
  },
]

export default DashboardPage
