import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, UserCheck, Calendar, Briefcase } from 'lucide-react'
import { Input as AntInput } from 'antd'
import { apiClient } from '@/lib/apiClient'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatCard from '@/components/ui/StatCard'
import styles from './HrStaffPage.module.scss'

interface Staff {
  id: string
  staffId: string
  fullName: string
  designation: string
  employmentType: string
  status: string
  joinDate: string
  leaveBalanceAnnual: number
  leaveBalanceMedical: number
  payrollBasicSalary: number
  department: { name: string; code: string }
  user: { displayName: string; email: string; isActive: boolean }
}

interface Stats {
  total: number
  active: number
  onLeave: number
  departments: { name: string; _count: { staff: number } }[]
}

const STATUS_COLOR: Record<string, 'green' | 'orange' | 'red' | 'gray'> = {
  active:     'green',
  on_leave:   'orange',
  terminated: 'red',
  inactive:   'gray',
}

const STATUS_KEY: Record<string, string> = {
  active:     'hrStaff.statusActive',
  on_leave:   'hrStaff.statusOnLeave',
  terminated: 'hrStaff.statusTerminated',
  inactive:   'hrStaff.statusInactive',
}

const EMPLOYMENT_COLOR: Record<string, 'blue' | 'purple' | 'gray'> = {
  permanent: 'blue',
  contract:  'purple',
  part_time: 'gray',
}

const EMPLOYMENT_KEY: Record<string, string> = {
  permanent: 'hrStaff.permanent',
  contract:  'hrStaff.contract',
  part_time: 'hrStaff.partTime',
}

const HrStaffPage: React.FC = () => {
  const { t } = useTranslation()
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Staff | null>(null)

  const { data: staffList = [], isLoading } = useQuery<Staff[]>({
    queryKey: ['hr', 'staff'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/staff')
      return data.data
    },
  })

  const { data: stats } = useQuery<Stats>({
    queryKey: ['hr', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/stats')
      return data.data
    },
  })

  const filtered = staffList.filter(s =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.staffId.toLowerCase().includes(search.toLowerCase()) ||
    s.designation.toLowerCase().includes(search.toLowerCase()) ||
    s.department.name.toLowerCase().includes(search.toLowerCase())
  )

  const employmentLabel = (type: string) => t(EMPLOYMENT_KEY[type] as any ?? type, { defaultValue: type.replace('_', ' ') })
  const statusLabel     = (status: string) => t(STATUS_KEY[status] as any ?? status, { defaultValue: status })

  const columns: ColumnDef<Staff>[] = [
    { key: 'staffId',            title: t('hrStaff.staffId'),      render: v => <span className={styles.staffId}>{v.staffId}</span> },
    { key: 'fullName',           title: t('hrStaff.name'),         render: v => (
      <div>
        <div className={styles.name}>{v.fullName}</div>
        <div className={styles.email}>{v.user.email}</div>
      </div>
    )},
    { key: 'designation',        title: t('hrStaff.designation'),  render: v => (
      <div>
        <div>{v.designation}</div>
        <div className={styles.email}>{v.department.name}</div>
      </div>
    )},
    { key: 'employmentType',     title: t('hrStaff.type'),         render: v => (
      <Badge color={EMPLOYMENT_COLOR[v.employmentType] ?? 'gray'}>
        {employmentLabel(v.employmentType)}
      </Badge>
    )},
    { key: 'status',             title: t('common.status'),        render: v => (
      <Badge color={STATUS_COLOR[v.status] ?? 'gray'}>{statusLabel(v.status)}</Badge>
    )},
    { key: 'leaveBalanceAnnual', title: t('hrStaff.leaveBalance'), render: v => (
      <div className={styles.leaveBalance}>
        <span title={t('hrStaff.annualLeave')}>A: {v.leaveBalanceAnnual}{t('hrStaff.days')}</span>
        <span title={t('hrStaff.medicalLeave')}>M: {v.leaveBalanceMedical}{t('hrStaff.days')}</span>
      </div>
    )},
    { key: 'actions',            title: '', render: v => (
      <Button size="sm" variant="ghost" onClick={() => setSelected(v)}>{t('hrStaff.viewBtn')}</Button>
    )},
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('hrStaff.title')}</h1>
        <p className={styles.pageSub}>{t('hrStaff.subtitle')}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className={styles.statsRow}>
          <StatCard title={t('hrStaff.totalStaff')}    value={stats.total}              sub={t('hrStaff.allDepartments')}  icon={<Users size={16} />}     color="blue" />
          <StatCard title={t('hrStaff.active')}         value={stats.active}             sub={t('hrStaff.currentlyWorking')} icon={<UserCheck size={16} />} color="green" />
          <StatCard title={t('hrStaff.onLeaveToday')}  value={stats.onLeave}            sub={t('hrStaff.approvedLeave')}   icon={<Calendar size={16} />}  color="orange" />
          <StatCard title={t('hrStaff.departments')}   value={stats.departments.length} sub={t('hrStaff.withStaff')}       icon={<Briefcase size={16} />} color="purple" />
        </div>
      )}

      {/* Department breakdown */}
      {stats && stats.departments.length > 0 && (
        <div className={styles.deptRow}>
          {stats.departments.map(d => (
            <div key={d.name} className={styles.deptCard}>
              <div className={styles.deptCount}>{d._count.staff}</div>
              <div className={styles.deptName}>{d.name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <Card
        title={t('hrStaff.staffDirectory')}
        extra={
          <AntInput
            className={styles.searchInput}
            placeholder={t('hrStaff.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            prefix={<Search size={14} />}
            allowClear
          />
        }
        noPadding
      >
        <Table<Staff>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText={t('hrStaff.noStaff')}
        />
      </Card>

      {/* Detail Modal */}
      {selected && (
        <Modal
          open
          title={`${t('hrStaff.staffProfile')} ${selected.staffId}`}
          onClose={() => setSelected(null)}
          footer={<Button variant="ghost" onClick={() => setSelected(null)}>{t('common.close')}</Button>}
        >
          <div className={styles.detailGrid}>
            <DetailRow label={t('hrStaff.fullName')}       value={selected.fullName} />
            <DetailRow label={t('hrStaff.staffId')}        value={selected.staffId} />
            <DetailRow label={t('hrStaff.email')}          value={selected.user.email} />
            <DetailRow label={t('hrStaff.department')}     value={`${selected.department.name} (${selected.department.code})`} />
            <DetailRow label={t('hrStaff.departmentLabel')} value={selected.designation} />
            <DetailRow label={t('hrStaff.employment')}     value={<Badge color={EMPLOYMENT_COLOR[selected.employmentType] ?? 'gray'}>{employmentLabel(selected.employmentType)}</Badge>} />
            <DetailRow label={t('hrStaff.joinDate')}       value={new Date(selected.joinDate).toLocaleDateString('en-GB')} />
            <DetailRow label={t('common.status')}          value={<Badge color={STATUS_COLOR[selected.status] ?? 'gray'}>{statusLabel(selected.status)}</Badge>} />
            <DetailRow label={t('hrStaff.annualLeave')}    value={`${selected.leaveBalanceAnnual} ${t('hrStaff.daysRemaining')}`} />
            <DetailRow label={t('hrStaff.medicalLeave')}   value={`${selected.leaveBalanceMedical} ${t('hrStaff.daysRemaining')}`} />
            <DetailRow label={t('hrStaff.basicSalary')}    value={`BND ${selected.payrollBasicSalary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
          </div>
        </Modal>
      )}
    </div>
  )
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className={styles.detailRow}>
    <span className={styles.detailLabel}>{label}</span>
    <span className={styles.detailValue}>{value}</span>
  </div>
)

export default HrStaffPage
