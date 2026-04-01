import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BookOpen, Calendar, DollarSign, Clock, User } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import styles from './StaffPortalPage.module.scss'

interface CourseOffering {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  seatsTaken: number
  course: { code: string; name: string; creditHours: number }
  semester: { name: string; isActive: boolean }
}

interface PayrollRecord {
  id: string
  payrollMonth: string
  basicSalary: number
  allowances: number
  deductions: number
  netSalary: number
  status: string
  paidAt: string | null
}

interface StaffPortal {
  id: string
  staffId: string
  fullName: string
  designation: string
  employmentType: string
  leaveBalanceAnnual: number
  leaveBalanceMedical: number
  payrollBasicSalary: number
  lmsInstructorActive: boolean
  department: { name: string; code: string }
  user: { displayName: string; email: string }
  courseOfferings: CourseOffering[]
  payrollRecords: PayrollRecord[]
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const StaffPortalPage: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: portal, isLoading, isError } = useQuery<StaffPortal>({
    queryKey: ['hr', 'staff', 'portal'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/staff/portal')
      return data.data
    },
  })

  if (isLoading) {
    return <div className={styles.loading}>{t('common.loading')}</div>
  }

  if (isError || !portal) {
    return <div className={styles.error}>{t('staffPortal.noRecord')}</div>
  }

  const activeOfferings = portal.courseOfferings.filter(o => o.semester.isActive)
  const sortedOfferings = [...activeOfferings].sort((a, b) =>
    DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
  )
  const totalCH = activeOfferings.reduce((sum, o) => sum + o.course.creditHours, 0)
  const latestPayroll = portal.payrollRecords[0]

  return (
    <div className={styles.page}>
      {/* Welcome header */}
      <div className={styles.welcomeBar}>
        <div className={styles.avatarCircle}>{portal.fullName.charAt(0)}</div>
        <div>
          <h1 className={styles.welcomeTitle}>
            {t('staffPortal.welcome', { name: portal.fullName })}
          </h1>
          <p className={styles.welcomeSub}>
            {portal.designation} · {portal.department.name}
            {portal.lmsInstructorActive && (
              <Badge color="green" style={{ marginLeft: 8 }}>LMS Active</Badge>
            )}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statsRow}>
        <StatCard
          title={t('staffPortal.annualLeave')}
          value={portal.leaveBalanceAnnual}
          sub={t('staffPortal.daysRemaining')}
          icon={<Calendar size={16} />}
          color="blue"
        />
        <StatCard
          title={t('staffPortal.medicalLeave')}
          value={portal.leaveBalanceMedical}
          sub={t('staffPortal.daysRemaining')}
          icon={<User size={16} />}
          color="purple"
        />
        <StatCard
          title={t('staffPortal.teachingLoad')}
          value={activeOfferings.length}
          sub={`${totalCH} ${t('staffPortal.creditHours')}`}
          icon={<BookOpen size={16} />}
          color="green"
        />
        {latestPayroll && (
          <StatCard
            title={t('staffPortal.latestPayslip')}
            value={`BND ${latestPayroll.netSalary.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`}
            sub={new Date(latestPayroll.payrollMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            icon={<DollarSign size={16} />}
            color="orange"
          />
        )}
      </div>

      {/* Teaching schedule */}
      <Card title={t('staffPortal.teachingSchedule')}>
        {sortedOfferings.length === 0 ? (
          <p className={styles.empty}>{t('staffPortal.noSchedule')}</p>
        ) : (
          <div className={styles.scheduleGrid}>
            {sortedOfferings.map(o => (
              <div key={o.id} className={styles.scheduleCard}>
                <div className={styles.scheduleDay}>{o.dayOfWeek}</div>
                <div className={styles.scheduleCourse}>
                  <span className={styles.courseCode}>{o.course.code}</span>
                  <span className={styles.courseName}>{o.course.name}</span>
                </div>
                <div className={styles.scheduleMeta}>
                  <span><Clock size={12} /> {o.startTime} – {o.endTime}</span>
                  <span>📍 {o.room}</span>
                  <span>👥 {o.seatsTaken} {t('staffPortal.enrolled')}</span>
                  <span>📚 {o.course.creditHours} CH</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payslip summary */}
      {portal.payrollRecords.length > 0 && (
        <Card title={t('staffPortal.payslipHistory')}>
          <div className={styles.payrollList}>
            {portal.payrollRecords.map(pr => (
              <div key={pr.id} className={styles.payrollRow}>
                <div className={styles.payrollMonth}>
                  {new Date(pr.payrollMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </div>
                <div className={styles.payrollBreakdown}>
                  <span>{t('staffPortal.basic')}: BND {pr.basicSalary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                  {pr.allowances > 0 && <span>{t('staffPortal.allowances')}: +BND {pr.allowances.toFixed(2)}</span>}
                  {pr.deductions > 0 && <span>{t('staffPortal.deductions')}: -BND {pr.deductions.toFixed(2)}</span>}
                </div>
                <div className={styles.payrollNet}>
                  BND {pr.netSalary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
                <Badge color={pr.status === 'paid' ? 'green' : 'orange'}>
                  {pr.status === 'paid' ? t('staffPortal.paid') : t('staffPortal.draft')}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Staff info */}
      <Card title={t('staffPortal.myInfo')}>
        <div className={styles.infoGrid}>
          <InfoRow label={t('hrStaff.staffId')}     value={portal.staffId} />
          <InfoRow label={t('hrStaff.email')}        value={portal.user.email} />
          <InfoRow label={t('hrStaff.department')}   value={`${portal.department.name} (${portal.department.code})`} />
          <InfoRow label={t('hrStaff.departmentLabel')} value={portal.designation} />
          <InfoRow label={t('hrStaff.employment')}   value={portal.employmentType.replace('_', ' ')} />
          <InfoRow label={t('hrStaff.basicSalary')}  value={`BND ${portal.payrollBasicSalary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
        </div>
      </Card>
    </div>
  )
}

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={styles.infoRow}>
    <span className={styles.infoLabel}>{label}</span>
    <span className={styles.infoValue}>{value}</span>
  </div>
)

export default StaffPortalPage
