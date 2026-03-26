import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, UserCheck, Calendar, Briefcase, Phone } from 'lucide-react'
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

const EMPLOYMENT_COLOR: Record<string, 'blue' | 'purple' | 'gray'> = {
  permanent:  'blue',
  contract:   'purple',
  part_time:  'gray',
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

  const columns: ColumnDef<Staff>[] = [
    { key: 'staffId', title: 'Staff ID', render: v => <span className={styles.staffId}>{v.staffId}</span> },
    { key: 'fullName', title: 'Name', render: v => (
      <div>
        <div className={styles.name}>{v.fullName}</div>
        <div className={styles.email}>{v.user.email}</div>
      </div>
    )},
    { key: 'designation', title: 'Designation', render: v => (
      <div>
        <div>{v.designation}</div>
        <div className={styles.email}>{v.department.name}</div>
      </div>
    )},
    { key: 'employmentType', title: 'Type', render: v => (
      <Badge color={EMPLOYMENT_COLOR[v.employmentType] ?? 'gray'}>
        {v.employmentType.replace('_', ' ')}
      </Badge>
    )},
    { key: 'status', title: 'Status', render: v => (
      <Badge color={STATUS_COLOR[v.status] ?? 'gray'}>{v.status}</Badge>
    )},
    { key: 'leaveBalanceAnnual', title: 'Leave Balance', render: v => (
      <div className={styles.leaveBalance}>
        <span title="Annual leave">A: {v.leaveBalanceAnnual}d</span>
        <span title="Medical leave">M: {v.leaveBalanceMedical}d</span>
      </div>
    )},
    { key: 'actions', title: '', render: v => (
      <Button size="sm" variant="ghost" onClick={() => setSelected(v)}>View</Button>
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
          <StatCard title="Total Staff" value={stats.total} sub="All departments" icon={<Users size={16} />} color="blue" />
          <StatCard title="Active" value={stats.active} sub="Currently working" icon={<UserCheck size={16} />} color="green" />
          <StatCard title="On Leave Today" value={stats.onLeave} sub="Approved leave" icon={<Calendar size={16} />} color="orange" />
          <StatCard title="Departments" value={stats.departments.length} sub="With staff" icon={<Briefcase size={16} />} color="purple" />
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
        title="Staff Directory"
        extra={
          <AntInput
            className={styles.searchInput}
            placeholder="Search by name, ID, designation..."
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
          emptyText="No staff found"
        />
      </Card>

      {/* Detail Modal */}
      {selected && (
        <Modal
          open
          title={`Staff Profile: ${selected.staffId}`}
          onClose={() => setSelected(null)}
          footer={<Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>}
        >
          <div className={styles.detailGrid}>
            <DetailRow label="Full Name"      value={selected.fullName} />
            <DetailRow label="Staff ID"       value={selected.staffId} />
            <DetailRow label="Email"          value={selected.user.email} />
            <DetailRow label="Department"     value={`${selected.department.name} (${selected.department.code})`} />
            <DetailRow label="Designation"    value={selected.designation} />
            <DetailRow label="Employment"     value={<Badge color={EMPLOYMENT_COLOR[selected.employmentType] ?? 'gray'}>{selected.employmentType.replace('_', ' ')}</Badge>} />
            <DetailRow label="Join Date"      value={new Date(selected.joinDate).toLocaleDateString('en-GB')} />
            <DetailRow label="Status"         value={<Badge color={STATUS_COLOR[selected.status] ?? 'gray'}>{selected.status}</Badge>} />
            <DetailRow label="Annual Leave"   value={`${selected.leaveBalanceAnnual} days remaining`} />
            <DetailRow label="Medical Leave"  value={`${selected.leaveBalanceMedical} days remaining`} />
            <DetailRow label="Basic Salary"   value={`BND ${selected.payrollBasicSalary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
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
