import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, Search, Eye, Users } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatCard from '@/components/ui/StatCard'
import styles from './AdmissionReviewPage.module.scss'

interface Application {
  id: string
  applicationRef: string
  fullName: string
  email: string
  nationality: string
  highestQualification: string
  cgpa?: number
  modeOfStudy: string
  scholarshipApplied: boolean
  status: string
  submittedAt?: string
  decisionMadeAt?: string
  officerRemarks?: string
  programme: { name: string; code: string }
  intake: { intakeStart: string; semester: { name: string } }
}

interface Stats { total: number; submitted: number; underReview: number; accepted: number; rejected: number; waitlisted: number }

const STATUS_BADGE: Record<string, { color: 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple'; label: string }> = {
  draft:              { color: 'gray',   label: 'Draft' },
  submitted:          { color: 'blue',   label: 'Submitted' },
  auto_check_failed:  { color: 'red',    label: 'Auto-Check Failed' },
  under_review:       { color: 'orange', label: 'Under Review' },
  accepted:           { color: 'green',  label: 'Accepted' },
  rejected:           { color: 'red',    label: 'Rejected' },
  waitlisted:         { color: 'purple', label: 'Waitlisted' },
}

const AdmissionReviewPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Application | null>(null)
  const [decisionModal, setDecisionModal] = useState<{ app: Application; action: 'accepted' | 'rejected' | 'waitlisted' } | null>(null)
  const [remarks, setRemarks] = useState('')
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()

  const { data: apps = [], isLoading } = useQuery<Application[]>({
    queryKey: ['admissions', 'applications'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admissions/applications')
      return data.data
    },
  })

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admissions', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admissions/stats')
      return data.data
    },
  })

  const decisionMutation = useMutation({
    mutationFn: ({ id, action, remarks }: { id: string; action: string; remarks: string }) =>
      apiClient.patch(`/admissions/applications/${id}/decision`, { action, remarks }),
    onSuccess: (_, vars) => {
      addToast({ type: 'success', message: `Application ${vars.action} successfully` })
      qc.invalidateQueries({ queryKey: ['admissions'] })
      setDecisionModal(null)
      setSelected(null)
      setRemarks('')
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Action failed' }),
  })

  const filtered = apps.filter(a =>
    a.fullName.toLowerCase().includes(search.toLowerCase()) ||
    a.applicationRef.toLowerCase().includes(search.toLowerCase()) ||
    a.programme.name.toLowerCase().includes(search.toLowerCase())
  )

  const columns: ColumnDef<Application>[] = [
    { key: 'applicationRef', title: 'Ref No.', render: (v) => <span className={styles.refNo}>{v.applicationRef}</span> },
    { key: 'fullName', title: 'Applicant', render: (v) => (
      <div>
        <div className={styles.appName}>{v.fullName}</div>
        <div className={styles.appEmail}>{v.email}</div>
      </div>
    )},
    { key: 'programme', title: 'Programme', render: (v) => (
      <div>
        <div>{v.programme.name}</div>
        <div className={styles.appEmail}>{v.intake.semester.name} · {v.modeOfStudy.replace('_', ' ')}</div>
      </div>
    )},
    { key: 'cgpa', title: 'CGPA', render: (v) => v.cgpa ? v.cgpa.toFixed(2) : '—' },
    { key: 'status', title: 'Status', render: (v) => {
      const s = STATUS_BADGE[v.status] ?? STATUS_BADGE.draft
      return <Badge color={s.color}>{s.label}</Badge>
    }},
    { key: 'submittedAt', title: 'Submitted', render: (v) => v.submittedAt ? new Date(v.submittedAt).toLocaleDateString('en-GB') : '—' },
    { key: 'actions', title: '', render: (v) => (
      <div className={styles.actionBtns}>
        <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setSelected(v)}>Review</Button>
        {(v.status === 'submitted' || v.status === 'under_review') && (
          <>
            <Button size="sm" variant="ghost" icon={<CheckCircle size={14} />}
              onClick={() => { setDecisionModal({ app: v, action: 'accepted' }); setRemarks('') }}>Accept</Button>
            <Button size="sm" variant="danger" icon={<XCircle size={14} />}
              onClick={() => { setDecisionModal({ app: v, action: 'rejected' }); setRemarks('') }}>Reject</Button>
          </>
        )}
      </div>
    )},
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Admission Review</h1>
        <p className={styles.pageSub}>Review and process student applications</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className={styles.statsRow}>
          <StatCard title="Total Applications" value={stats.total} sub="All time" icon={<Users size={16} />} color="blue" />
          <StatCard title="Pending Review" value={stats.submitted + stats.underReview} sub="Awaiting decision" icon={<Clock size={16} />} color="orange" />
          <StatCard title="Accepted" value={stats.accepted} sub="This intake" icon={<CheckCircle size={16} />} color="green" />
          <StatCard title="Rejected" value={stats.rejected} sub="This intake" icon={<XCircle size={16} />} color="red" />
        </div>
      )}

      {/* Table */}
      <Card
        title="Applications"
        extra={
          <div className={styles.searchWrap}>
            <Search size={14} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, ref, programme..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        }
        noPadding
      >
        <Table<Application>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText="No applications found"
        />
      </Card>

      {/* Detail Modal */}
      {selected && (
        <Modal
          open
          title={`Application: ${selected.applicationRef}`}
          onClose={() => setSelected(null)}
          footer={
            <div className={styles.modalFooter}>
              {(selected.status === 'submitted' || selected.status === 'under_review') && (
                <>
                  <Button variant="secondary" onClick={() => { setDecisionModal({ app: selected, action: 'waitlisted' }); setRemarks('') }}>Waitlist</Button>
                  <Button variant="danger" onClick={() => { setDecisionModal({ app: selected, action: 'rejected' }); setRemarks('') }}>Reject</Button>
                  <Button onClick={() => { setDecisionModal({ app: selected, action: 'accepted' }); setRemarks('') }}>Accept</Button>
                </>
              )}
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
          }
        >
          <div className={styles.detailGrid}>
            <DetailRow label="Full Name" value={selected.fullName} />
            <DetailRow label="Email" value={selected.email} />
            <DetailRow label="Nationality" value={selected.nationality} />
            <DetailRow label="Programme" value={`${selected.programme.name} (${selected.programme.code})`} />
            <DetailRow label="Intake" value={selected.intake.semester.name} />
            <DetailRow label="Mode of Study" value={selected.modeOfStudy.replace('_', ' ')} />
            <DetailRow label="Qualification" value={selected.highestQualification} />
            <DetailRow label="CGPA" value={selected.cgpa ? selected.cgpa.toFixed(2) : 'Not provided'} />
            <DetailRow label="Scholarship" value={selected.scholarshipApplied ? 'Applied' : 'None'} />
            <DetailRow label="Status" value={<Badge color={STATUS_BADGE[selected.status]?.color ?? 'gray'}>{STATUS_BADGE[selected.status]?.label ?? selected.status}</Badge>} />
            {selected.officerRemarks && <DetailRow label="Officer Remarks" value={selected.officerRemarks} />}
          </div>
        </Modal>
      )}

      {/* Decision Modal */}
      {decisionModal && (
        <Modal
          open
          title={`${decisionModal.action === 'accepted' ? 'Accept' : decisionModal.action === 'rejected' ? 'Reject' : 'Waitlist'} Application`}
          onClose={() => setDecisionModal(null)}
          okDanger={decisionModal.action === 'rejected'}
          okText={decisionModal.action === 'accepted' ? 'Accept Application' : decisionModal.action === 'rejected' ? 'Reject Application' : 'Waitlist'}
          onOk={() => decisionMutation.mutate({ id: decisionModal.app.id, action: decisionModal.action, remarks })}
          okLoading={decisionMutation.isPending}
        >
          <p className={styles.decisionText}>
            {decisionModal.action === 'accepted'
              ? `You are about to accept the application from ${decisionModal.app.fullName}. An offer letter will be generated.`
              : decisionModal.action === 'rejected'
              ? `You are about to reject the application from ${decisionModal.app.fullName}. This action cannot be undone.`
              : `You are placing ${decisionModal.app.fullName} on the waitlist.`}
          </p>
          <div className={styles.remarksWrap}>
            <label className={styles.remarksLabel}>Officer Remarks (optional)</label>
            <textarea
              className={styles.remarksInput}
              rows={3}
              placeholder="Add any notes or reasons..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
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

export default AdmissionReviewPage
