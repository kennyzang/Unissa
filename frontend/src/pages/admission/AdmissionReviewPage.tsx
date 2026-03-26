import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, Search, Eye, Users } from 'lucide-react'
import { Input as AntInput } from 'antd'
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

const STATUS_COLOR: Record<string, 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple'> = {
  draft:              'gray',
  submitted:          'blue',
  auto_check_failed:  'red',
  under_review:       'orange',
  accepted:           'green',
  rejected:           'red',
  waitlisted:         'purple',
}

const STATUS_KEY: Record<string, string> = {
  draft:              'admissionReview.draft',
  submitted:          'admissionReview.submitted',
  auto_check_failed:  'admissionReview.autoCheckFailed',
  under_review:       'admissionReview.underReview',
  accepted:           'admissionReview.accepted',
  rejected:           'admissionReview.rejected',
  waitlisted:         'admissionReview.waitlisted',
}

const AdmissionReviewPage: React.FC = () => {
  const { t } = useTranslation()
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

  const statusLabel = (status: string) => t(STATUS_KEY[status] as any ?? status, { defaultValue: status })

  const decisionMutation = useMutation({
    mutationFn: ({ id, action, remarks }: { id: string; action: string; remarks: string }) =>
      apiClient.patch(`/admissions/applications/${id}/decision`, { action, remarks }),
    onSuccess: (_, vars) => {
      addToast({ type: 'success', message: t('admissionReview.successMsg', { action: vars.action }) })
      qc.invalidateQueries({ queryKey: ['admissions'] })
      setDecisionModal(null)
      setSelected(null)
      setRemarks('')
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('admissionReview.actionFailed') }),
  })

  const filtered = apps.filter(a =>
    a.fullName.toLowerCase().includes(search.toLowerCase()) ||
    a.applicationRef.toLowerCase().includes(search.toLowerCase()) ||
    a.programme.name.toLowerCase().includes(search.toLowerCase())
  )

  const columns: ColumnDef<Application>[] = [
    { key: 'applicationRef', title: t('admissionReview.refNo'), render: (v) => <span className={styles.refNo}>{v.applicationRef}</span> },
    { key: 'fullName', title: t('admissionReview.applicant'), render: (v) => (
      <div>
        <div className={styles.appName}>{v.fullName}</div>
        <div className={styles.appEmail}>{v.email}</div>
      </div>
    )},
    { key: 'programme', title: t('admissionReview.programme'), render: (v) => (
      <div>
        <div>{v.programme.name}</div>
        <div className={styles.appEmail}>{v.intake.semester.name} · {v.modeOfStudy.replace('_', ' ')}</div>
      </div>
    )},
    { key: 'cgpa', title: t('admissionReview.cgpa'), render: (v) => v.cgpa ? v.cgpa.toFixed(2) : '—' },
    { key: 'status', title: t('admissionReview.status'), render: (v) => (
      <Badge color={STATUS_COLOR[v.status] ?? 'gray'}>{statusLabel(v.status)}</Badge>
    )},
    { key: 'submittedAt', title: t('admissionReview.submitted'), render: (v) => v.submittedAt ? new Date(v.submittedAt).toLocaleDateString('en-GB') : '—' },
    { key: 'actions', title: '', render: (v) => (
      <div className={styles.actionBtns}>
        <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setSelected(v)}>{t('admissionReview.review')}</Button>
        {(v.status === 'submitted' || v.status === 'under_review') && (
          <>
            <Button size="sm" variant="ghost" icon={<CheckCircle size={14} />}
              onClick={() => { setDecisionModal({ app: v, action: 'accepted' }); setRemarks('') }}>{t('admissionReview.acceptBtn')}</Button>
            <Button size="sm" variant="danger" icon={<XCircle size={14} />}
              onClick={() => { setDecisionModal({ app: v, action: 'rejected' }); setRemarks('') }}>{t('admissionReview.rejectBtn')}</Button>
          </>
        )}
      </div>
    )},
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('admissionReview.title')}</h1>
        <p className={styles.pageSub}>{t('admissionReview.subtitle')}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className={styles.statsRow}>
          <StatCard title={t('admissionReview.totalApplications')} value={stats.total} sub={t('admissionReview.allTime')} icon={<Users size={16} />} color="blue" />
          <StatCard title={t('admissionReview.pendingReview')} value={stats.submitted + stats.underReview} sub={t('admissionReview.awaitingDecision')} icon={<Clock size={16} />} color="orange" />
          <StatCard title={t('admissionReview.accepted')} value={stats.accepted} sub={t('admissionReview.thisIntake')} icon={<CheckCircle size={16} />} color="green" />
          <StatCard title={t('admissionReview.rejected')} value={stats.rejected} sub={t('admissionReview.thisIntake')} icon={<XCircle size={16} />} color="red" />
        </div>
      )}

      {/* Table */}
      <Card
        title={t('admissionReview.applications')}
        extra={
          <AntInput
            className={styles.searchInput}
            placeholder={t('admissionReview.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            prefix={<Search size={14} />}
            allowClear
          />
        }
        noPadding
      >
        <Table<Application>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText={t('admissionReview.noApplications')}
        />
      </Card>

      {/* Detail Modal */}
      {selected && (
        <Modal
          open
          title={t('admissionReview.appTitle', { ref: selected.applicationRef })}
          onClose={() => setSelected(null)}
          footer={
            <div className={styles.modalFooter}>
              {(selected.status === 'submitted' || selected.status === 'under_review') && (
                <>
                  <Button variant="secondary" onClick={() => { setDecisionModal({ app: selected, action: 'waitlisted' }); setRemarks('') }}>{t('admissionReview.waitlistBtn')}</Button>
                  <Button variant="danger" onClick={() => { setDecisionModal({ app: selected, action: 'rejected' }); setRemarks('') }}>{t('admissionReview.rejectBtn')}</Button>
                  <Button onClick={() => { setDecisionModal({ app: selected, action: 'accepted' }); setRemarks('') }}>{t('admissionReview.acceptBtn')}</Button>
                </>
              )}
              <Button variant="ghost" onClick={() => setSelected(null)}>{t('admissionReview.closeModal')}</Button>
            </div>
          }
        >
          <div className={styles.detailGrid}>
            <DetailRow label={t('admissionReview.detailFullName')} value={selected.fullName} />
            <DetailRow label={t('admissionReview.detailEmail')} value={selected.email} />
            <DetailRow label={t('admissionReview.detailNationality')} value={selected.nationality} />
            <DetailRow label={t('admissionReview.detailProgramme')} value={`${selected.programme.name} (${selected.programme.code})`} />
            <DetailRow label={t('admissionReview.detailIntake')} value={selected.intake.semester.name} />
            <DetailRow label={t('admissionReview.detailMode')} value={selected.modeOfStudy.replace('_', ' ')} />
            <DetailRow label={t('admissionReview.detailQual')} value={selected.highestQualification} />
            <DetailRow label={t('admissionReview.detailCGPA')} value={selected.cgpa ? selected.cgpa.toFixed(2) : t('admissionReview.notProvided')} />
            <DetailRow label={t('admissionReview.detailScholarship')} value={selected.scholarshipApplied ? t('admissionReview.scholarshipApplied') : t('admissionReview.scholarshipNone')} />
            <DetailRow label={t('admissionReview.detailStatus')} value={<Badge color={STATUS_COLOR[selected.status] ?? 'gray'}>{statusLabel(selected.status)}</Badge>} />
            {selected.officerRemarks && <DetailRow label={t('admissionReview.detailRemarks')} value={selected.officerRemarks} />}
          </div>
        </Modal>
      )}

      {/* Decision Modal */}
      {decisionModal && (
        <Modal
          open
          title={
            decisionModal.action === 'accepted' ? t('admissionReview.acceptApplication')
            : decisionModal.action === 'rejected' ? t('admissionReview.rejectApplication')
            : t('admissionReview.waitlistTitle')
          }
          onClose={() => setDecisionModal(null)}
          okDanger={decisionModal.action === 'rejected'}
          okText={
            decisionModal.action === 'accepted' ? t('admissionReview.acceptApplication')
            : decisionModal.action === 'rejected' ? t('admissionReview.rejectApplication')
            : t('admissionReview.waitlistBtn')
          }
          onOk={() => decisionMutation.mutate({ id: decisionModal.app.id, action: decisionModal.action, remarks })}
          okLoading={decisionMutation.isPending}
        >
          <p className={styles.decisionText}>
            {decisionModal.action === 'accepted'
              ? t('admissionReview.acceptConfirm', { name: decisionModal.app.fullName })
              : decisionModal.action === 'rejected'
              ? t('admissionReview.rejectConfirm', { name: decisionModal.app.fullName })
              : t('admissionReview.waitlistConfirm', { name: decisionModal.app.fullName })}
          </p>
          <div className={styles.remarksWrap}>
            <label className={styles.remarksLabel}>{t('admissionReview.remarksLabel')}</label>
            <textarea
              className={styles.remarksInput}
              rows={3}
              placeholder={t('admissionReview.remarksOptional')}
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
