import React from 'react'
import { Download, X, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import styles from './InvoicePreviewModal.module.scss'

interface InvoiceData {
  invoiceNo: string
  semester?: { name: string }
  tuitionFee: number
  libraryFee: number
  hostelDeposit: number
  scholarshipDeduction: number
  totalAmount: number
  amountPaid: number
  outstandingBalance: number
  dueDate: string
  status: string
  generatedAt: string
  student?: {
    studentId: string
    user: { displayName: string; email: string }
  }
  payments?: Array<{
    transactionRef: string
    amount: number
    method: string
    status: string
    paidAt: string
    cardLast4?: string
  }>
}

interface InvoicePreviewModalProps {
  invoice: InvoiceData
  open: boolean
  onClose: () => void
  onDownload?: () => void
}

const STATUS_CONFIG = {
  paid: { color: 'green' as const, icon: CheckCircle, label: 'Paid' },
  unpaid: { color: 'orange' as const, icon: Clock, label: 'Unpaid' },
  overdue: { color: 'red' as const, icon: AlertCircle, label: 'Overdue' },
  partial: { color: 'orange' as const, icon: Clock, label: 'Partial' },
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoice,
  open,
  onClose,
  onDownload,
}) => {
  const statusConfig = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unpaid
  const StatusIcon = statusConfig.icon

  const items = [
    { description: 'Tuition Fee', amount: invoice.tuitionFee },
    { description: 'Library Fee', amount: invoice.libraryFee },
  ]

  if (invoice.hostelDeposit > 0) {
    items.push({ description: 'Hostel Deposit', amount: invoice.hostelDeposit })
  }

  if (invoice.scholarshipDeduction > 0) {
    items.push({ description: 'Scholarship Deduction', amount: -invoice.scholarshipDeduction })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className={styles.modalTitle}>
          <FileText size={20} />
          <span>Invoice Preview</span>
        </div>
      }
      footer={
        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            icon={<Download size={16} />}
            disabled={!onDownload}
            title={!onDownload ? 'Available after payment' : undefined}
            onClick={onDownload}
          >
            Download PDF
          </Button>
        </div>
      }
      width={700}
    >
      <div className={styles.invoicePreview}>
        <div className={styles.invoiceHeader}>
          <div className={styles.invoiceTitle}>
            <h2>INVOICE</h2>
            <p>UNISSA - Universiti Islam Sultan Sharif Ali</p>
            <p>Bandar Seri Begawan, Brunei Darussalam</p>
          </div>
          <div className={styles.invoiceMeta}>
            <div className={styles.invoiceNo}>{invoice.invoiceNo}</div>
            <div className={styles.invoiceDate}>
              Date: {new Date().toLocaleDateString('en-GB')}
            </div>
            <Badge color={statusConfig.color}>
              <StatusIcon size={12} />
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {invoice.student && (
          <div className={styles.invoiceSection}>
            <h3>Bill To:</h3>
            <div className={styles.billTo}>
              <p className={styles.name}>{invoice.student.user.displayName}</p>
              <p>Student ID: {invoice.student.studentId}</p>
              <p>{invoice.student.user.email}</p>
            </div>
          </div>
        )}

        <div className={styles.invoiceSection}>
          <h3>Invoice Details:</h3>
          <div className={styles.details}>
            <p>Semester: {invoice.semester?.name ?? 'N/A'}</p>
            <p>Due Date: {new Date(invoice.dueDate).toLocaleDateString('en-GB')}</p>
            <p>Status: {invoice.status.toUpperCase()}</p>
          </div>
        </div>

        <div className={styles.invoiceTable}>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th className={styles.amount}>Amount (BND)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{item.description}</td>
                  <td className={styles.amount}>
                    {item.amount >= 0 ? '' : '-'}BND {Math.abs(item.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.invoiceTotals}>
          <div className={styles.totalRow}>
            <span>Total Amount:</span>
            <span className={styles.totalAmount}>
              BND {invoice.totalAmount.toLocaleString()}
            </span>
          </div>
          <div className={styles.summaryRow}>
            <span>Amount Paid:</span>
            <span>BND {invoice.amountPaid.toLocaleString()}</span>
          </div>
          <div className={`${styles.summaryRow} ${invoice.outstandingBalance > 0 ? styles.outstanding : ''}`}>
            <span>Outstanding Balance:</span>
            <span>BND {invoice.outstandingBalance.toLocaleString()}</span>
          </div>
        </div>

        {invoice.payments && invoice.payments.length > 0 && (
          <div className={styles.invoiceSection}>
            <h3>Payment History:</h3>
            <div className={styles.paymentHistory}>
              {invoice.payments.map((payment, index) => (
                <div key={index} className={styles.paymentItem}>
                  <div className={styles.paymentHeader}>
                    <span className={styles.paymentRef}>{payment.transactionRef}</span>
                    <Badge color={payment.status === 'success' ? 'green' : 'red'}>
                      {payment.status}
                    </Badge>
                  </div>
                  <div className={styles.paymentDetails}>
                    <p>Amount: BND {payment.amount.toLocaleString()}</p>
                    <p>Method: {payment.method}{payment.cardLast4 ? ` (**** ${payment.cardLast4})` : ''}</p>
                    {payment.paidAt && (
                      <p>Date: {new Date(payment.paidAt).toLocaleDateString('en-GB')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.invoiceFooter}>
          <p>This is a computer-generated invoice. No signature is required.</p>
          <p>For inquiries, please contact finance@unissa.edu.bn</p>
        </div>
      </div>
    </Modal>
  )
}

export default InvoicePreviewModal