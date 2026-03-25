import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, CheckCircle, XCircle, Clock, FileText } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
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
  staff: {
    staffId: string
    fullName: string
    user: { displayName: string }
    department: { name: string }
  }
}

interface LeaveForm {
  leaveType: string
  startDate: string
  endDate: string
  reason: string
  coveringOfficerId: string
}

const STATUS_BADGE: Record<string, { color: 'blue' | 'green' | 'red' | 'orange' | 'gray'; label: string }> = {
  pending:  { color: 'orange', label: 'Pending' },
  approved: { color: 'green',  label: 'Approved' },
  rejected: { color: 'red',    label: 'Rejected' },
  cancelled:{ color: 'gray',   label: 'Cancelled' },
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:  'Annual Leave',
  medical: 'Medical Leave',
  unpaid:  'Unpaid Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  emergency: 'Emergency Leave',
}

const LeaveManagementPage: React.FC = () => {
  const { t } = useTranslation()
  const [applyModal,  setApplyModal]  = useState(false)
  const [reviewModal, setReviewModal] = useState<{ leave: LeaveRequest; action: 'approved' | 'rejected' } | null>(null)
  const [remarks,     setRemarks]     = useState('')

  const { user }  = useAuthStore()
  const addToast  = useUIStore(s => s.addToast)
  const qc        = useQueryClient()
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'hradmin'

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<LeaveForm>({
    defaultValues: { leaveType: 'annual', coveringOfficerId: 'N/A' },
  })

  const { data: leaves = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['hr', 'leave'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hr/leave')
      return data.data
    },
  })

  const applyMutation = useMutation({
    mutationFn: (form: LeaveForm) => apiClient.post('/hr/leave', form),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Leave request submitted successfully' })
      qc.invalidateQueries({ queryKey: ['hr', 'leave'] })
      setApplyModal(false)
      reset()
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Submission failed' }),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, action, remarks }: { id: string; action: string; remarks: string }) =>
      apiClient.patch(`/hr/leave/${id}/approve`, { action, remarks }),
    onSuccess: (_, vars) => {
      addToast({ type: 'success', message: `Leave request ${vars.action}` })
      qc.invalidateQueries({ queryKey: ['hr', 'leave'] })
      setReviewModal(null)
      setRemarks('')
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Action failed' }),
  })

  const onSubmit = (form: LeaveForm) => applyMutation.mutate(form)

  const startDate = watch('startDate')
  const endDate   = watch('endDate')
  const days = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0

  const pending  = leaves.filter(l => l.status === 'pending').length
  const approved = leaves.filter(l => l.status === 'approved').length
  const rejected = leaves.filter(l => l.status === 'rejected').length

  const columns: ColumnDef<LeaveRequest>[] = [
    ...(isManager ? [{
      key: 'staff' as keyof LeaveRequest,
      title: 'Staff',
      render: (v: LeaveRequest) => (
        <div>
          <div className={styles.name}>{v.staff.fullName}</div>
          <div className={styles.sub}>{v.staff.department.name}</div>
        </div>
      ),
    }] : []),
    { key: 'leaveType', title: 'Leave Type', render: v => LEAVE_TYPE_LABELS[v.leaveType] ?? v.leaveType },
    { key: 'startDate', title: 'Period', render: v => (
      <div>
        <div>{new Date(v.startDate).toLocaleDateString('en-GB')} – {new Date(v.endDate).toLocaleDateString('en-GB')}</div>
        <div className={styles.sub}>{v.durationDays} day{v.durationDays !== 1 ? 's' : ''}</div>
      </div>
    )},
    { key: 'reason', title: 'Reason', render: v => <span className={styles.reason}>{v.reason}</span> },
    { key: 'status', title: 'Status', render: v => {
      const s = STATUS_BADGE[v.status] ?? STATUS_BADGE.pending
      return <Badge color={s.color}>{s.label}</Badge>
    }},
    { key: 'submittedAt', title: 'Submitted', render: v => new Date(v.submittedAt).toLocaleDateString('en-GB') },
    ...(isManager ? [{
      key: 'actions' as keyof LeaveRequest,
      title: '',
      render: (v: LeaveRequest) => v.status === 'pending' ? (
        <div className={styles.actionBtns}>
          <Button size="sm" variant="ghost" icon={<CheckCircle size={14} />}
            onClick={() => { setReviewModal({ leave: v, action: 'approved' }); setRemarks('') }}>
            Approve
          </Button>
          <Button size="sm" variant="danger" icon={<XCircle size={14} />}
            onClick={() => { setReviewModal({ leave: v, action: 'rejected' }); setRemarks('') }}>
            Reject
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
          <Button icon={<Plus size={14} />} onClick={() => setApplyModal(true)}>Apply for Leave</Button>
        )}
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <StatCard title="Pending"  value={pending}  sub="Awaiting approval" icon={<Clock size={16} />}       color="orange" />
        <StatCard title="Approved" value={approved} sub="This period"       icon={<CheckCircle size={16} />} color="green" />
        <StatCard title="Rejected" value={rejected} sub="This period"       icon={<XCircle size={16} />}     color="red" />
        <StatCard title="Total"    value={leaves.length} sub="All requests"  icon={<Calendar size={16} />}   color="blue" />
      </div>

      {/* Table */}
      <Card title={isManager ? 'All Leave Requests' : 'My Leave Requests'} noPadding>
        <Table<LeaveRequest>
          columns={columns}
          dataSource={leaves}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText="No leave requests found"
        />
      </Card>

      {/* Apply Modal */}
      <Modal
        open={applyModal}
        title="Apply for Leave"
        onClose={() => { setApplyModal(false); reset() }}
        okText="Submit Request"
        onOk={handleSubmit(onSubmit)}
        okLoading={applyMutation.isPending}
      >
        <form className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Leave Type *</label>
            <select className={styles.select} {...register('leaveType', { required: true })}>
              <option value="annual">Annual Leave</option>
              <option value="medical">Medical Leave</option>
              <option value="emergency">Emergency Leave</option>
              <option value="maternity">Maternity Leave</option>
              <option value="paternity">Paternity Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          <div className={styles.dateRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Start Date *</label>
              <input
                type="date"
                className={styles.input}
                {...register('startDate', { required: 'Start date is required' })}
              />
              {errors.startDate && <span className={styles.error}>{errors.startDate.message}</span>}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>End Date *</label>
              <input
                type="date"
                className={styles.input}
                {...register('endDate', { required: 'End date is required' })}
              />
              {errors.endDate && <span className={styles.error}>{errors.endDate.message}</span>}
            </div>
          </div>

          {days > 0 && (
            <div className={styles.durationBadge}>
              <Calendar size={14} />
              {days} day{days !== 1 ? 's' : ''} requested
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Reason *</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="Please briefly explain the reason for leave..."
              {...register('reason', { required: 'Reason is required' })}
            />
            {errors.reason && <span className={styles.error}>{errors.reason.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Covering Officer</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Name of colleague covering your duties"
              {...register('coveringOfficerId')}
            />
          </div>
        </form>
      </Modal>

      {/* Approve/Reject Modal */}
      {reviewModal && (
        <Modal
          open
          title={`${reviewModal.action === 'approved' ? 'Approve' : 'Reject'} Leave Request`}
          onClose={() => setReviewModal(null)}
          okDanger={reviewModal.action === 'rejected'}
          okText={reviewModal.action === 'approved' ? 'Approve' : 'Reject'}
          onOk={() => approveMutation.mutate({ id: reviewModal.leave.id, action: reviewModal.action, remarks })}
          okLoading={approveMutation.isPending}
        >
          <div className={styles.reviewInfo}>
            <div className={styles.reviewRow}><span>Staff:</span> {reviewModal.leave.staff.fullName}</div>
            <div className={styles.reviewRow}><span>Leave Type:</span> {LEAVE_TYPE_LABELS[reviewModal.leave.leaveType]}</div>
            <div className={styles.reviewRow}><span>Duration:</span> {reviewModal.leave.durationDays} days ({new Date(reviewModal.leave.startDate).toLocaleDateString('en-GB')} – {new Date(reviewModal.leave.endDate).toLocaleDateString('en-GB')})</div>
            <div className={styles.reviewRow}><span>Reason:</span> {reviewModal.leave.reason}</div>
          </div>
          <div className={styles.formGroup} style={{ marginTop: 16 }}>
            <label className={styles.label}>Remarks (optional)</label>
            <textarea
              className={styles.textarea}
              rows={2}
              placeholder="Add notes or reason for rejection..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

export default LeaveManagementPage
