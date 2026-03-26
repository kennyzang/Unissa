import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, AlertTriangle, Inbox, PenLine } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import styles from './ApprovalInboxPage.module.scss'

interface PRItem {
  id: string
  prNumber: string
  itemDescription: string
  quantity: number
  estimatedUnitPrice: number
  totalAmount: number
  quoteTrafficLight: string
  status: string
  submittedAt?: string
  requiredByDate: string
  requestor?: { user: { displayName: string } }
  department?: { name: string }
  glCode?: { code: string; description: string; availableBalance?: number }
  quotes?: { id: string; vendorName: string; quotedPrice: number; quoteNumber: number }[]
  anomalies?: { id: string; anomalyType: string; severity: string; description: string }[]
}

const TRAFFIC_COLORS: Record<string, string> = { red: '#F53F3F', amber: '#FF7D00', green: '#00B42A' }

const ApprovalInboxPage: React.FC = () => {
  const { t } = useTranslation()
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()
  const [approveModal, setApproveModal] = useState<{ pr: PRItem; action: 'approve' | 'reject' } | null>(null)
  const [remarks, setRemarks] = useState('')

  const { data: items = [], isLoading } = useQuery<PRItem[]>({
    queryKey: ['procurement', 'inbox'],
    queryFn: async () => {
      const { data } = await apiClient.get('/procurement/approval-inbox')
      return data.data
    },
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action, remarks }: { id: string; action: 'approve' | 'reject'; remarks: string }) => {
      const endpoint = action === 'approve' ? `/procurement/pr/${id}/approve` : `/procurement/pr/${id}/reject`
      return apiClient.post(endpoint, { remarks })
    },
    onSuccess: (_, vars) => {
      addToast({ type: 'success', message: vars.action === 'approve' ? t('approvalInbox.approveSuccess') : t('approvalInbox.rejectSuccess') })
      setApproveModal(null)
      setRemarks('')
      qc.invalidateQueries({ queryKey: ['procurement'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? t('leaveManagement.actionFailed') })
    },
  })

  const TRAFFIC_LABELS: Record<string, string> = {
    red: t('approvalInbox.requestor'),
    amber: '1-2 quotes',
    green: '3+ quotes',
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('approvalInbox.title')}</h1>
          <p className={styles.pageSub}>
            {items.length} {t('approvalInbox.pending')}
          </p>
        </div>
        <div className={styles.inboxBadge}>
          <Inbox size={16} />
          {items.length} {t('approvalInbox.pendingLabel')}
        </div>
      </div>

      {isLoading && <div className={styles.loading}>{t('approvalInbox.loading')}</div>}

      {!isLoading && items.length === 0 && (
        <div className={styles.emptyInbox}>
          <CheckCircle size={40} />
          <h3>{t('approvalInbox.clear')}</h3>
          <p>{t('approvalInbox.clearNote')}</p>
        </div>
      )}

      <div className={styles.prList}>
        {items.map(pr => {
          const hasAnomaly = (pr.anomalies?.length ?? 0) > 0

          return (
            <Card key={pr.id} className={`${styles.prCard} ${hasAnomaly ? styles.anomalyCard : ''}`}>
              {hasAnomaly && (
                <div className={styles.anomalyBanner}>
                  <AlertTriangle size={14} />
                  {t('approvalInbox.anomalyNote')}
                </div>
              )}

              <div className={styles.prHeader}>
                <div>
                  <div className={styles.prNumber}>{pr.prNumber}</div>
                  <div className={styles.prDesc}>{pr.itemDescription}</div>
                </div>
                <div className={styles.prAmount}>
                  <span className={styles.amountValue}>BND {pr.totalAmount.toLocaleString()}</span>
                  <div
                    className={styles.trafficDot}
                    style={{ background: TRAFFIC_COLORS[pr.quoteTrafficLight] }}
                    title={TRAFFIC_LABELS[pr.quoteTrafficLight]}
                  />
                </div>
              </div>

              <div className={styles.prMeta}>
                <MetaItem label={t('approvalInbox.requestor')}     value={pr.requestor?.user?.displayName ?? '—'} />
                <MetaItem label={t('approvalInbox.department')}    value={pr.department?.name ?? '—'} />
                <MetaItem label={t('approvalInbox.glCode')}        value={`${pr.glCode?.code} – ${pr.glCode?.description}`} />
                <MetaItem label={t('approvalInbox.qtyPrice')}      value={`${pr.quantity} × BND ${pr.estimatedUnitPrice}`} />
                <MetaItem label={t('approvalInbox.requiredBy')}    value={new Date(pr.requiredByDate).toLocaleDateString('en-GB')} />
                <MetaItem label={t('approvalInbox.submittedLabel')} value={pr.submittedAt ? new Date(pr.submittedAt).toLocaleDateString('en-GB') : '—'} />
              </div>

              {pr.quotes && pr.quotes.length > 0 && (
                <div className={styles.quotesBar}>
                  <span className={styles.quotesLabel}>{t('approvalInbox.vendorQuotes')}</span>
                  {pr.quotes.map(q => (
                    <span key={q.id} className={styles.quoteChip}>
                      #{q.quoteNumber} {q.vendorName} — BND {q.quotedPrice.toLocaleString()}
                    </span>
                  ))}
                </div>
              )}

              {pr.anomalies && pr.anomalies.map(a => (
                <div key={a.id} className={styles.anomalyDetail}>
                  <Badge color={a.severity === 'high' ? 'red' : 'orange'} size="sm">{a.anomalyType.replace('_', ' ')}</Badge>
                  <span>{a.description}</span>
                </div>
              ))}

              <div className={styles.prActions}>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<XCircle size={14} />}
                  onClick={() => { setApproveModal({ pr, action: 'reject' }); setRemarks('') }}
                >
                  {t('approvalInbox.rejectBtn')}
                </Button>
                <Button
                  size="sm"
                  icon={<CheckCircle size={14} />}
                  onClick={() => { setApproveModal({ pr, action: 'approve' }); setRemarks('') }}
                >
                  {t('approvalInbox.approveBtn')}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Approve/Reject Modal */}
      {approveModal && (
        <Modal
          open
          title={approveModal.action === 'approve'
            ? `${t('approvalInbox.approvePR')} ${approveModal.pr.prNumber}`
            : `${t('approvalInbox.rejectPR')} ${approveModal.pr.prNumber}`}
          onClose={() => setApproveModal(null)}
          okDanger={approveModal.action === 'reject'}
          okText={approveModal.action === 'approve' ? t('approvalInbox.approveBtn') : t('approvalInbox.rejectBtn')}
          onOk={() => actionMutation.mutate({ id: approveModal.pr.id, action: approveModal.action, remarks })}
          okLoading={actionMutation.isPending}
        >
          <div className={styles.modalSummary}>
            <div>{t('approvalInbox.item')} <strong>{approveModal.pr.itemDescription}</strong></div>
            <div>{t('approvalInbox.totalLabel')} <strong>BND {approveModal.pr.totalAmount.toLocaleString()}</strong></div>
            <div>{t('approvalInbox.gl')} <strong>{approveModal.pr.glCode?.code}</strong></div>
          </div>

          {approveModal.action === 'approve' && (
            <div className={styles.eSignNote}>
              <PenLine size={14} />
              {t('approvalInbox.signatureNote')}
            </div>
          )}

          <div className={styles.remarksField}>
            <label>
              {t('common.remarks')} {approveModal.action === 'reject' ? `(${t('common.required')})` : `(${t('common.optional')})`}
            </label>
            <textarea
              rows={3}
              className={styles.remarksTextarea}
              placeholder={approveModal.action === 'reject' ? t('approvalInbox.reasonRequired') : t('approvalInbox.addNotes')}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

const MetaItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={styles.metaItem}>
    <span className={styles.metaLabel}>{label}</span>
    <span className={styles.metaValue}>{value}</span>
  </div>
)

export default ApprovalInboxPage
