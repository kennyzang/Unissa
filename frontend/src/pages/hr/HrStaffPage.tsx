import { useTranslation } from 'react-i18next'
import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, UserCheck, Calendar, Briefcase, Eye, EyeOff, WifiOff, RefreshCw } from 'lucide-react'
import { Input as AntInput, Select, Table as AntTable } from 'antd'
import type { TableColumnsType } from 'antd'
import { apiClient } from '@/lib/apiClient'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
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
  tempPassword: string | null
  credentialsIssuedAt: string | null
  department: { name: string; code: string }
  user: { displayName: string; email: string; isActive: boolean; username: string }
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

// Maps display filter value → raw DB value
const EMP_TYPE_VALUES: Record<string, string> = {
  full_time: 'permanent',
  part_time: 'part_time',
  contract:  'contract',
}

const STATUS_VALUES: Record<string, string> = {
  active:   'active',
  inactive: 'inactive',
  on_leave: 'on_leave',
}

const HrStaffPage: React.FC = () => {
  const { t } = useTranslation()
  const [search,      setSearch]      = useState('')
  const [filterDept,  setFilterDept]  = useState<string | null>(null)
  const [filterEmp,   setFilterEmp]   = useState<string | null>(null)
  const [filterStatus,setFilterStatus]= useState<string | null>(null)
  const [selected,    setSelected]    = useState<Staff | null>(null)
  const [showPassword,setShowPassword]= useState(false)

  const { data: staffList = [], isLoading, isError, refetch } = useQuery<Staff[]>({
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

  const deptOptions = useMemo(() => {
    const names = Array.from(new Set(staffList.map(s => s.department.name))).sort()
    return names.map(n => ({ label: n, value: n }))
  }, [staffList])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return staffList.filter(s => {
      if (q && !(
        s.fullName.toLowerCase().includes(q) ||
        s.staffId.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q) ||
        s.department.name.toLowerCase().includes(q)
      )) return false
      if (filterDept   && s.department.name !== filterDept)           return false
      if (filterEmp    && s.employmentType  !== EMP_TYPE_VALUES[filterEmp])    return false
      if (filterStatus && s.status          !== STATUS_VALUES[filterStatus])   return false
      return true
    })
  }, [staffList, search, filterDept, filterEmp, filterStatus])

  const clearFilters = () => {
    setSearch('')
    setFilterDept(null)
    setFilterEmp(null)
    setFilterStatus(null)
  }

  const hasFilters = search || filterDept || filterEmp || filterStatus

  const employmentLabel = (type: string) => t(EMPLOYMENT_KEY[type] as any ?? type, { defaultValue: type.replace('_', ' ') })
  const statusLabel     = (status: string) => t(STATUS_KEY[status] as any ?? status, { defaultValue: status })

  const columns: TableColumnsType<Staff> = [
    {
      title:     t('hrStaff.staffId'),
      key:       'staffId',
      dataIndex: 'staffId',
      width:     110,
      sorter:    (a, b) => a.staffId.localeCompare(b.staffId),
      render:    (val: string) => <span className={styles.staffId}>{val}</span>,
    },
    {
      title:  t('hrStaff.name'),
      key:    'fullName',
      sorter: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (_: any, v: Staff) => (
        <div>
          <div className={styles.name}>{v.fullName}</div>
          <div className={styles.email}>{v.user.email}</div>
        </div>
      ),
    },
    {
      title:  t('hrStaff.designation'),
      key:    'designation',
      sorter: (a, b) => a.designation.localeCompare(b.designation),
      render: (_: any, v: Staff) => (
        <div>
          <div>{v.designation}</div>
          <div className={styles.email}>{v.department.name}</div>
        </div>
      ),
    },
    {
      title:  t('hrStaff.department'),
      key:    'department',
      sorter: (a, b) => a.department.name.localeCompare(b.department.name),
      render: (_: any, v: Staff) => v.department.name,
    },
    {
      title:  t('hrStaff.type'),
      key:    'employmentType',
      sorter: (a, b) => a.employmentType.localeCompare(b.employmentType),
      render: (_: any, v: Staff) => (
        <Badge color={EMPLOYMENT_COLOR[v.employmentType] ?? 'gray'}>
          {employmentLabel(v.employmentType)}
        </Badge>
      ),
    },
    {
      title:  t('common.status'),
      key:    'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (_: any, v: Staff) => (
        <Badge color={STATUS_COLOR[v.status] ?? 'gray'}>{statusLabel(v.status)}</Badge>
      ),
    },
    {
      title:  t('hrStaff.leaveBalance'),
      key:    'leaveBalance',
      render: (_: any, v: Staff) => (
        <div className={styles.leaveBalance}>
          <span title={t('hrStaff.annualLeave')}>A: {v.leaveBalanceAnnual}{t('hrStaff.days')}</span>
          <span title={t('hrStaff.medicalLeave')}>M: {v.leaveBalanceMedical}{t('hrStaff.days')}</span>
        </div>
      ),
    },
    {
      title:  '',
      key:    'actions',
      width:  70,
      render: (_: any, v: Staff) => (
        <Button size="sm" variant="ghost" onClick={() => setSelected(v)}>{t('hrStaff.viewBtn')}</Button>
      ),
    },
  ]

  if (isError) {
    return (
      <div className={styles.errorWrap}>
        <WifiOff size={32} color="#F53F3F" />
        <p>{t('hrStaff.loadError', { defaultValue: 'Failed to load staff data. Please check your connection and try again.' })}</p>
        <button className={styles.retryBtn} onClick={() => refetch()}>
          <RefreshCw size={14} /> {t('common.retry')}
        </button>
      </div>
    )
  }

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
      <Card title={t('hrStaff.staffDirectory')} noPadding>
        {/* Filter bar */}
        <div className={styles.filterBar}>
          <AntInput
            className={styles.searchInput}
            placeholder={t('hrStaff.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            prefix={<Search size={14} />}
            allowClear
          />
          <Select
            className={styles.filterSelect}
            placeholder={t('hrStaff.allDepts')}
            value={filterDept}
            onChange={v => setFilterDept(v)}
            options={deptOptions}
            allowClear
            onClear={() => setFilterDept(null)}
          />
          <Select
            className={styles.filterSelect}
            placeholder={t('hrStaff.allTypes')}
            value={filterEmp}
            onChange={v => setFilterEmp(v)}
            allowClear
            onClear={() => setFilterEmp(null)}
            options={[
              { label: t('hrStaff.permanent'), value: 'full_time' },
              { label: t('hrStaff.partTime'),  value: 'part_time' },
              { label: t('hrStaff.contract'),  value: 'contract'  },
            ]}
          />
          <Select
            className={styles.filterSelect}
            placeholder={t('hrStaff.allStatuses')}
            value={filterStatus}
            onChange={v => setFilterStatus(v)}
            allowClear
            onClear={() => setFilterStatus(null)}
            options={[
              { label: t('hrStaff.statusActive'),   value: 'active'   },
              { label: t('hrStaff.statusInactive'),  value: 'inactive' },
              { label: t('hrStaff.statusOnLeave'),   value: 'on_leave' },
            ]}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('hrStaff.clearFilters')}
            </Button>
          )}
        </div>

        <AntTable<Staff>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `${total} ${t('hrStaff.staffTotal')}` }}
          locale={{ emptyText: t('hrStaff.noStaff') }}
          className={styles.antTable}
        />
      </Card>

      {/* Detail Modal */}
      {selected && (
        <Modal
          open
          title={`${t('hrStaff.staffProfile')} ${selected.staffId}`}
          onClose={() => setSelected(null)}
          footer={<Button variant="ghost" onClick={() => { setSelected(null); setShowPassword(false) }}>{t('common.close')}</Button>}
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

          {/* Credentials section — shown when a temp password exists */}
          {selected.tempPassword && (
            <div className={styles.credentialsSection}>
              <div className={styles.credentialsSectionTitle}>{t('hrStaff.credentialsTitle')}</div>
              <div className={styles.credentialItem}>
                <span className={styles.credentialKey}>{t('hrStaff.credUsername')}</span>
                <span className={styles.credentialVal}>{selected.user.username}</span>
              </div>
              <div className={styles.credentialItem}>
                <span className={styles.credentialKey}>{t('hrStaff.credTempPassword')}</span>
                <span className={styles.credentialVal}>
                  {showPassword ? selected.tempPassword : '••••••••••••'}
                </span>
                <button
                  className={styles.credentialToggle}
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? t('hrStaff.hidePassword') : t('hrStaff.showPassword')}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {selected.credentialsIssuedAt && (
                <div className={styles.credentialItem}>
                  <span className={styles.credentialKey}>{t('hrStaff.credIssuedAt')}</span>
                  <span className={styles.credentialVal}>
                    {new Date(selected.credentialsIssuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
              <p className={styles.credentialsNote}>{t('hrStaff.credentialsNote')}</p>
            </div>
          )}
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
