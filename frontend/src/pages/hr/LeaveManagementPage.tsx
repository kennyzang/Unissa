import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Modal, Form, Select, DatePicker, Input } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import StatCard from '@/components/ui/StatCard'
import styles from './LeaveManagementPage.module.scss'

interface LeaveRequest {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  durationDays: number
  reason: string
  status: string
  submittedAt: string
  rejectRemarks?: string
  coveringOfficerId?: string
  staff: {
    staffId: string
    fullName: string
    user: { displayName: string }
    department: { name: string }
  }
}

interface LeaveFormValues {
  leaveType: string
  dateRange: [Dayjs, Dayjs]
  reason: string
  coveringOfficerId?: string
}

const STATUS_COLOR: Record<string, 'blue' | 'green' | 'red' | 'orange' | 'gray'> = {
  pending:         'orange',
  pending_hr:      'blue',
  pending_manager: 'purple',
  approved:        'green',
  rejected:        'red',
  cancelled:       'gray',
}

const LEAVE_TYPE_KEYS = ['annual', 'medical', 'unpaid', 'maternity', 'paternity', 'emergency']

const LeaveManagementPage: React.FC = () => {
  const { t } = useTranslation()
  const [applyModal,  setApplyModal]  = useState(false)
  const [reviewModal, setReviewModal] = useState<{ leave: LeaveRequest; action: 'approved' | 'rejected' } | null>(null)
  const [remarks,     setRemarks]     = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { user }  = useAuthStore()
  const addToast  = useUIStore(s => s.addToast)
  const qc        = useQueryClient()
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'hradmin'

  const [applyForm] = Form.useForm<LeaveFormValues>()
  const dateRange = Form.useWatch('dateRange', applyForm)
  const days = dateRange?.[0] && dateRange?.[1]
    ? Math.max(1, dateRange[1].diff(dateRange[0], 'day') + 1)
    : 0

  const leaveTypeOptions = LEAVE_TYPE_KEYS.map(v => ({ value: v, label: t(`leaveManagement.${v}` as any) }))
  const leaveTypeLabel = (type: string) => t(`leaveManagement.${type}` as any, { defaultValue: type })

  const { data: leaves = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['hr', 'leave'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/leave')
      return data.data
    },
  })

  const applyMutation = useMutation({
    mutationFn: (values: LeaveFormValues) =>
      apiClient.post('/hr/leave', {
        leaveType: values.leaveType,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate:   values.dateRange[1].format('YYYY-MM-DD'),
        reason:    values.reason,
        coveringOfficerId: values.coveringOfficerId || 'N/A',
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: t('leaveManagement.submitSuccess') })
      qc.invalidateQueries({ queryKey: ['hr', 'leave'] })
      setApplyModal(false)
      applyForm.resetFields()
      setErrorMessage(null)
    },
    onError: (e: any) => setErrorMessage(e.response?.data?.message ?? t('leaveManagement.submitFailed')),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, action, remarks }: { id: string; action: string; remarks: string }) =>
      apiClient.patch(`/hr/leave/${id}/approve`, { action, remarks }),
    onSuccess: (_, vars) => {
      addToast({ type: 'success', message: t(`leaveManagement.${vars.action}` as any) })
      qc.invalidateQueries({ queryKey: ['hr', 'leave'] })
      setReviewModal(null)
      setRemarks('')
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('leaveManagement.actionFailed') }),
  })

  const handleApplyOk = () => {
    applyForm.validateFields().then(values => applyMutation.mutate(values))
  }

  const pending  = leaves.filter(l => ['pending', 'pending_hr', 'pending_manager'].includes(l.status)).length
  const approved = leaves.filter(l => l.status === 'approved').length
  const rejected = leaves.filter(l => l.status === 'rejected').length

  const columns: ColumnDef<LeaveRequest>[] = [
    ...(isManager ? [{
      key: 'staff' as keyof LeaveRequest,
      title: t('leaveManagement.staffCol'),
      render: (v: LeaveRequest) => (
        <div>
          <div className={styles.name}>{v.staff.fullName}</div>
          <div className={styles.sub}>{v.staff.department.name}</div>
        </div>
      ),
    }] : []),
    { key: 'leaveType', title: t('leaveManagement.leaveTypeCol'), render: v => leaveTypeLabel(v.leaveType) },
    { key: 'startDate', title: t('leaveManagement.period'), render: v => (
      <div>
        <div>{new Date(v.startDate).toLocaleDateString('en-GB')} – {new Date(v.endDate).toLocaleDateString('en-GB')}</div>
        <div className={styles.sub}>{v.durationDays} {t('leaveManagement.daysUnit')}</div>
      </div>
    )},
    { key: 'reason', title: t('leaveManagement.reasonCol'), render: v => <span className={styles.reason}>{v.reason}</span> },
    { key: 'coveringOfficerId', title: t('leaveManagement.coveringOfficer'), render: v => v.coveringOfficerId || '-' },
    { key: 'status', title: t('common.status'), render: v => {
      const color = STATUS_COLOR[v.status] ?? 'gray'
      const label = t(`leaveManagement.${v.status}` as any, { defaultValue: v.status })
      return <Badge color={color}>{label}</Badge>
    }},
    { key: 'submittedAt', title: t('leaveManagement.submittedCol'), render: v => new Date(v.submittedAt).toLocaleDateString('en-GB') },
    ...(isManager ? [{
      key: 'actions' as keyof LeaveRequest,
      title: '',
      render: (v: LeaveRequest) => ['pending', 'pending_hr', 'pending_manager'].includes(v.status) ? (
        <div className={styles.actionBtns}>
          <Button size="sm" variant="ghost" icon={<CheckCircle size={14} />}
            onClick={() => { setReviewModal({ leave: v, action: 'approved' }); setRemarks('') }}>
            {t('common.approve')}
          </Button>
          <Button size="sm" variant="danger" icon={<XCircle size={14} />}
            onClick={() => { setReviewModal({ leave: v, action: 'rejected' }); setRemarks('') }}>
            {t('common.reject')}
          </Button>
        </div>
      ) : null,
    }] : []),
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('leaveManagement.title')}</h1>
          <p className={styles.pageSub}>{isManager ? t('leaveManagement.subtitleManager') : t('leaveManagement.subtitleStaff')}</p>
        </div>
        {!isManager && (
          <Button icon={<Plus size={14} />} onClick={() => setApplyModal(true)}>{t('leaveManagement.applyLeave')}</Button>
        )}
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <StatCard title={t('leaveManagement.pending')}  value={pending}       sub={t('leaveManagement.awaitingApproval')} icon={<Clock size={16} />}       color="orange" />
        <StatCard title={t('leaveManagement.approved')} value={approved}      sub={t('leaveManagement.thisPeriod')}       icon={<CheckCircle size={16} />} color="green" />
        <StatCard title={t('leaveManagement.rejected')} value={rejected}      sub={t('leaveManagement.thisPeriod')}       icon={<XCircle size={16} />}     color="red" />
        <StatCard title={t('leaveManagement.total')}    value={leaves.length} sub={t('leaveManagement.allRequests')}      icon={<Calendar size={16} />}    color="blue" />
      </div>

      {/* Table */}
      <Card title={isManager ? t('leaveManagement.allLeaveRequests') : t('leaveManagement.myLeaveRequests')} noPadding>
        <Table<LeaveRequest>
          columns={columns}
          dataSource={leaves}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText={t('leaveManagement.noRequests')}
        />
      </Card>

      {/* Apply for Leave Modal */}
      <Modal
        open={applyModal}
        title={t('leaveManagement.applyLeave')}
        okText={t('leaveManagement.submitRequest')}
        cancelText={t('common.cancel')}
        onOk={handleApplyOk}
        confirmLoading={applyMutation.isPending}
        onCancel={() => { setApplyModal(false); applyForm.resetFields() }}
        width={520}
        destroyOnClose
      >
        <Form
          form={applyForm}
          layout="vertical"
          initialValues={{ leaveType: 'annual' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="leaveType"
            label={t('leaveManagement.leaveTypeCol')}
            rules={[{ required: true, message: t('leaveManagement.selectLeaveType') }]}
          >
            <Select options={leaveTypeOptions} />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label={t('leaveManagement.dateRange')}
            rules={[{ required: true, message: t('leaveManagement.selectDateRange') }]}
          >
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              disabledDate={d => d.isBefore(dayjs().startOf('day'))}
              format="DD MMM YYYY"
            />
          </Form.Item>

          {days > 0 && (
            <div className={styles.durationBadge}>
              <Calendar size={14} />
              {days} {t('leaveManagement.daysRequested')}
            </div>
          )}

          {errorMessage && (
            <div className={styles.errorMessage}>
              {errorMessage}
            </div>
          )}

          <Form.Item
            name="reason"
            label={t('leaveManagement.reasonCol')}
            rules={[{ required: true, message: t('leaveManagement.provideReason') }]}
            style={{ marginTop: days > 0 ? 12 : 0 }}
          >
            <Input.TextArea
              rows={3}
              placeholder={t('leaveManagement.reasonPlaceholder')}
            />
          </Form.Item>

          <Form.Item name="coveringOfficerId" label={t('leaveManagement.coveringOfficer')}>
            <Input placeholder={t('leaveManagement.coveringOfficerPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Approve / Reject Modal */}
      {reviewModal && (
        <Modal
          open
          title={reviewModal.action === 'approved' ? t('leaveManagement.approveRequest') : t('leaveManagement.rejectRequest')}
          okText={reviewModal.action === 'approved' ? t('common.approve') : t('common.reject')}
          okButtonProps={{ danger: reviewModal.action === 'rejected' }}
          cancelText={t('common.cancel')}
          onOk={() => approveMutation.mutate({ id: reviewModal.leave.id, action: reviewModal.action, remarks })}
          confirmLoading={approveMutation.isPending}
          onCancel={() => setReviewModal(null)}
          width={480}
          destroyOnClose
        >
          <div className={styles.reviewInfo}>
            <div className={styles.reviewRow}><span>{t('leaveManagement.staffLabel')}</span> {reviewModal.leave.staff.fullName}</div>
            <div className={styles.reviewRow}><span>{t('leaveManagement.leaveTypeLabel')}</span> {leaveTypeLabel(reviewModal.leave.leaveType)}</div>
            <div className={styles.reviewRow}><span>{t('leaveManagement.durationLabel')}</span> {reviewModal.leave.durationDays} {t('leaveManagement.daysUnit')} ({new Date(reviewModal.leave.startDate).toLocaleDateString('en-GB')} – {new Date(reviewModal.leave.endDate).toLocaleDateString('en-GB')})</div>
            <div className={styles.reviewRow}><span>{t('leaveManagement.reasonLabel')}</span> {reviewModal.leave.reason}</div>
          </div>
          <Form layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label={t('leaveManagement.remarksLabel')}>
              <Input.TextArea
                rows={2}
                placeholder={t('leaveManagement.remarksOptional')}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  )
}

export default LeaveManagementPage
