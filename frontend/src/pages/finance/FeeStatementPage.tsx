import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  CreditCard, CheckCircle, AlertCircle, Receipt, LockKeyhole,
  FileText, Download, Smartphone, Building2, QrCode as QrIcon,
} from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import InvoicePreviewModal from '@/components/invoice/InvoicePreviewModal'
import styles from './FeeStatementPage.module.scss'

interface Invoice {
  id: string
  invoiceNo: string
  semesterId: string
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
  semester?: { name: string }
}

const paySchema = z.object({
  method: z.enum(['card', 'online_banking', 'e_wallet', 'qr_pay', 'bank_transfer']),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  cardHolder: z.string().optional(),
  bankName: z.string().optional(),
})
type PayForm = z.infer<typeof paySchema>

// ── Payment method meta ────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  {
    value: 'card' as const,
    icon: <CreditCard size={22} />,
    label: 'Credit / Debit Card',
    desc: 'Visa, Mastercard, JCB',
    color: '#1677ff',
    bg: '#e6f4ff',
  },
  {
    value: 'online_banking' as const,
    icon: <Building2 size={22} />,
    label: 'Online Banking',
    desc: 'BIBD, Baiduri, HSBC, Maybank',
    color: '#389e0d',
    bg: '#f6ffed',
  },
  {
    value: 'e_wallet' as const,
    icon: <Smartphone size={22} />,
    label: 'E-Wallet',
    desc: 'Auto-approved in demo',
    color: '#722ed1',
    bg: '#f9f0ff',
  },
  {
    value: 'qr_pay' as const,
    icon: <QrIcon size={22} />,
    label: 'QR Pay',
    desc: 'Scan & pay via banking app',
    color: '#d46b08',
    bg: '#fff7e6',
  },
  {
    value: 'bank_transfer' as const,
    icon: <Building2 size={22} />,
    label: 'Bank Transfer',
    desc: 'Transfer to UNISSA account',
    color: '#08979c',
    bg: '#e6fffb',
  },
]

// ── Formatted card number field ───────────────────────────────────────────────
const CardNumberField: React.FC<{ control: any; error?: string }> = ({ control, error }) => {
  const { field } = useController({ name: 'cardNumber', control })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 16)
    const formatted = digits.replace(/(.{4})/g, '$1 ').trimEnd()
    field.onChange(formatted)
  }

  return (
    <Input
      label="Card Number"
      placeholder="4111 1111 1111 1111"
      hint="Use 4000 0000 0000 0002 to test decline"
      value={field.value ?? ''}
      onChange={handleChange}
      onBlur={field.onBlur}
      name={field.name}
      inputMode="numeric"
      maxLength={19}
      error={error}
    />
  )
}

// ── Formatted expiry field ────────────────────────────────────────────────────
const ExpiryField: React.FC<{ control: any; error?: string }> = ({ control, error }) => {
  const { field } = useController({ name: 'cardExpiry', control })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 6) // strip non-digits, max 6 (MMYYYY)
    let out = ''
    if (raw.length >= 2) {
      const month = parseInt(raw.slice(0, 2), 10)
      // Clamp month to 01–12
      const mm = String(Math.min(Math.max(month, 1), 12)).padStart(2, '0')
      out = mm + (raw.length > 2 ? '/' + raw.slice(2, 6) : '/')
    } else {
      out = raw
    }
    field.onChange(out)
  }

  // On backspace over the slash, remove it cleanly
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const val = field.value ?? ''
    if (e.key === 'Backspace' && val.endsWith('/')) {
      e.preventDefault()
      field.onChange(val.slice(0, -1))
    }
  }

  return (
    <Input
      label="Expiry"
      placeholder="MM/YY"
      value={field.value ?? ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={field.onBlur}
      name={field.name}
      inputMode="numeric"
      maxLength={7}
      error={error}
    />
  )
}

const STATUS_BADGE: Record<string, { color: 'green' | 'red' | 'orange' | 'gray'; label: string }> = {
  unpaid:  { color: 'orange', label: 'Unpaid' },
  paid:    { color: 'green',  label: 'Paid' },
  overdue: { color: 'red',    label: 'Overdue' },
  partial: { color: 'orange', label: 'Partial' },
}

const FeeStatementPage: React.FC = () => {
  const { t } = useTranslation()
  const [payModal, setPayModal] = useState<Invoice | null>(null)
  const [receipt, setReceipt] = useState<any>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()

  // Get current student's ID dynamically
  const { data: studentProfile, isLoading: studentLoading } = useQuery<{ studentId: string }>({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
    retry: false,
  })

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', studentProfile?.studentId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/finance/invoices/${studentProfile!.studentId}`)
      return data.data
    },
    enabled: !!studentProfile?.studentId,
  })

  const isLoading = studentLoading || invoicesLoading

  const { register, handleSubmit, watch, control, formState: { errors }, reset } = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { method: 'card' },
  })

  const method = watch('method')

  const payMutation = useMutation({
    mutationFn: (form: PayForm & { invoiceId: string }) => apiClient.post('/finance/payments', form),
    onSuccess: (res) => {
      setReceipt(res.data.data)
      setPayModal(null)
      reset()
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Payment failed' })
    },
  })

  const onPay = handleSubmit(form => {
    if (!payModal) return
    payMutation.mutate({ ...form, invoiceId: payModal.id })
  })

  const downloadInvoice = async (invoiceId: string, invoiceNo: string) => {
    try {
      const response = await apiClient.get(`/finance/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice-${invoiceNo}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      addToast({ type: 'success', message: 'Invoice downloaded successfully' })
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to download invoice' })
    }
  }

  const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingBalance, 0)

  // Not yet enrolled
  if (!studentLoading && !studentProfile) {
    return (
      <div className={styles.page}>
        <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <LockKeyhole size={36} color="#bbb" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#333', marginBottom: 8 }}>
            {t('feeStatement.notEnrolledTitle', { defaultValue: 'Not Enrolled Yet' })}
          </div>
          <div style={{ fontSize: 14, color: '#888', lineHeight: 1.7 }}>
            {t('feeStatement.notEnrolledMsg', { defaultValue: 'Your fee statement will be available once you have registered for courses. Please complete your admission application and accept your offer first.' })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('feeStatement.title')}</h1>
          <p className={styles.pageSub}>{t('feeStatement.studentInfo')}</p>
        </div>
        {totalOutstanding > 0 && (
          <div className={styles.outstandingBadge}>
            <AlertCircle size={16} />
            Outstanding: BND {totalOutstanding.toLocaleString()}
          </div>
        )}
      </div>

      {/* Receipt modal */}
      {receipt && (
        <Modal
          open
          title="Payment Receipt"
          onClose={() => setReceipt(null)}
          footer={<Button onClick={() => setReceipt(null)}>Close</Button>}
        >
          <div className={styles.receipt}>
            <CheckCircle size={40} className={styles.receiptIcon} />
            <h3>Payment Successful</h3>
            <div className={styles.receiptGrid}>
              <ReceiptRow label="Transaction Ref" value={receipt.transactionRef} />
              <ReceiptRow label="Amount Paid" value={`BND ${receipt.amount?.toLocaleString()}`} />
              <ReceiptRow label="Date" value={new Date().toLocaleDateString('en-GB')} />
              <ReceiptRow label="Status" value={<Badge color="green">Successful</Badge>} />
            </div>
          </div>
        </Modal>
      )}

      {/* Invoice list */}
      <div className={styles.invoiceList}>
        {isLoading && <div className={styles.loading}>{t('feeStatement.loadingInvoices')}</div>}
        {!isLoading && invoices.length === 0 && (
          <Card>
            <div className={styles.emptyState}>
              <Receipt size={32} />
              <p>No invoices found. Register for courses to generate your first invoice.</p>
            </div>
          </Card>
        )}
        {invoices.map(inv => {
          const s = STATUS_BADGE[inv.status] ?? STATUS_BADGE.unpaid
          return (
            <Card key={inv.id} className={styles.invoiceCard}>
              <div className={styles.invoiceHeader}>
                <div>
                  <div className={styles.invoiceNo}>{inv.invoiceNo}</div>
                  <div className={styles.invoiceSem}>{inv.semester?.name ?? 'Sep 2026'}</div>
                </div>
                <div className={styles.invoiceRight}>
                  <Badge color={s.color}>{s.label}</Badge>
                  <div className={styles.invoiceTotal}>BND {inv.totalAmount.toLocaleString()}</div>
                </div>
              </div>

              <div className={styles.invoiceBreakdown}>
                <InvoiceRow label="Tuition Fee" amount={inv.tuitionFee} />
                <InvoiceRow label="Library Fee" amount={inv.libraryFee} />
                {inv.hostelDeposit > 0 && <InvoiceRow label="Hostel Deposit" amount={inv.hostelDeposit} />}
                {inv.scholarshipDeduction > 0 && (
                  <InvoiceRow label="Scholarship Deduction" amount={-inv.scholarshipDeduction} isDeduction />
                )}
                <div className={styles.invoiceDivider} />
                <InvoiceRow label="Total Amount" amount={inv.totalAmount} bold />
                <InvoiceRow label="Amount Paid" amount={inv.amountPaid} />
                <InvoiceRow
                  label="Outstanding Balance"
                  amount={inv.outstandingBalance}
                  bold
                  highlight={inv.outstandingBalance > 0}
                />
              </div>

              <div className={styles.invoiceFooter}>
                <span className={styles.dueDate}>
                  Due: {new Date(inv.dueDate).toLocaleDateString('en-GB')}
                </span>
                <div className={styles.invoiceActions}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<FileText size={14} />}
                    onClick={() => setPreviewInvoice(inv)}
                  >
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download size={14} />}
                    onClick={() => downloadInvoice(inv.id, inv.invoiceNo)}
                  >
                    Download
                  </Button>
                  {inv.status !== 'paid' && (
                    <Button
                      size="sm"
                      icon={<CreditCard size={14} />}
                      onClick={() => setPayModal(inv)}
                    >
                      Pay Now
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Payment Modal */}
      {payModal && (
        <Modal
          open
          title="Make Payment"
          onClose={() => { setPayModal(null); reset() }}
          footer={null}
          width={560}
        >
          <div className={styles.payAmount}>
            Amount: <strong>BND {payModal.outstandingBalance.toLocaleString()}</strong>
          </div>

          <form onSubmit={onPay} className={styles.payForm}>
            {/* ── Visual payment method selector ── */}
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <div>
                  <div className={styles.methodLabel}>Payment Method</div>
                  <div className={styles.methodGrid}>
                    {PAYMENT_METHODS.map(pm => (
                      <button
                        key={pm.value}
                        type="button"
                        className={`${styles.methodCard} ${field.value === pm.value ? styles.methodCardActive : ''}`}
                        style={field.value === pm.value ? { borderColor: pm.color, background: pm.bg } : {}}
                        onClick={() => field.onChange(pm.value)}
                      >
                        <span className={styles.methodIcon} style={{ color: pm.color }}>{pm.icon}</span>
                        <span className={styles.methodName}>{pm.label}</span>
                        <span className={styles.methodDesc}>{pm.desc}</span>
                        {field.value === pm.value && (
                          <span className={styles.methodCheck} style={{ background: pm.color }}>
                            <CheckCircle size={12} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            />

            {/* ── Credit / Debit Card ── */}
            {method === 'card' && (
              <div className={styles.methodForm}>
                <CardNumberField control={control} error={errors.cardNumber?.message} />
                <div className={styles.cardRow}>
                  <ExpiryField control={control} error={errors.cardExpiry?.message} />
                  <Input label="CVV" placeholder="123" {...register('cardCvv')} inputMode="numeric" maxLength={4} />
                </div>
                <Input label="Cardholder Name" {...register('cardHolder')} />
              </div>
            )}

            {/* ── Online Banking ── */}
            {method === 'online_banking' && (
              <div className={styles.methodForm}>
                <Controller
                  control={control}
                  name="bankName"
                  render={({ field }) => (
                    <Select
                      label="Select Bank"
                      value={field.value}
                      onChange={val => field.onChange(val)}
                      options={[
                        { value: 'BIBD',    label: 'BIBD (Baiduri)' },
                        { value: 'Baiduri', label: 'Baiduri Bank' },
                        { value: 'HSBC',    label: 'HSBC Brunei' },
                        { value: 'Maybank', label: 'Maybank' },
                      ]}
                    />
                  )}
                />
                <div className={styles.methodInfoBox}>
                  You will be redirected to your bank's secure online portal to complete payment.
                </div>
              </div>
            )}

            {/* ── E-Wallet ── */}
            {method === 'e_wallet' && (
              <div className={styles.methodForm}>
                <div className={styles.methodInfoBox}>
                  You will be redirected to complete payment via e-wallet. <em>(Demo: auto-approved)</em>
                </div>
              </div>
            )}

            {/* ── QR Pay ── */}
            {method === 'qr_pay' && (
              <div className={styles.methodForm}>
                <div className={styles.qrPayBox}>
                  <div className={styles.qrPayTitle}>Scan QR Code to Pay</div>
                  {/* Static demo QR placeholder */}
                  <div className={styles.qrPayPlaceholder}>
                    <QrIcon size={72} strokeWidth={1.5} />
                    <div className={styles.qrPayAmount}>BND {payModal.outstandingBalance.toLocaleString()}</div>
                  </div>
                  <p className={styles.qrPayHint}>
                    Open your banking or payment app → Scan → Confirm payment of BND {payModal.outstandingBalance.toLocaleString()}.<br />
                    <em>Demo: payment will be auto-confirmed on submit.</em>
                  </p>
                </div>
              </div>
            )}

            {/* ── Bank Transfer ── */}
            {method === 'bank_transfer' && (
              <div className={styles.methodForm}>
                <div className={styles.bankTransferBox}>
                  <div className={styles.bankTransferTitle}>UNISSA Bank Transfer Details</div>
                  <table className={styles.bankTransferTable}>
                    <tbody>
                      <tr><td>Bank</td><td><strong>BIBD — Bank Islam Brunei Darussalam</strong></td></tr>
                      <tr><td>Account Name</td><td><strong>Universiti Islam Sultan Sharif Ali</strong></td></tr>
                      <tr><td>Account No.</td><td><strong>01-234567-001</strong></td></tr>
                      <tr><td>Reference</td><td><strong>{payModal.invoiceNo ?? payModal.id.slice(-8).toUpperCase()}</strong></td></tr>
                      <tr><td>Amount</td><td><strong>BND {payModal.outstandingBalance.toLocaleString()}</strong></td></tr>
                    </tbody>
                  </table>
                  <p className={styles.bankTransferNote}>
                    ⚠ Please use your Invoice No. as the payment reference so we can match your transfer.
                    Send your bank receipt to <strong>finance@unissa.edu.bn</strong>.
                    <em> Demo: confirmed on submit.</em>
                  </p>
                </div>
              </div>
            )}

            <div className={styles.payActions}>
              <Button variant="secondary" type="button" onClick={() => { setPayModal(null); reset() }}>Cancel</Button>
              <Button type="submit" loading={payMutation.isPending} icon={<CreditCard size={14} />}>
                Pay BND {payModal.outstandingBalance.toLocaleString()}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <InvoicePreviewModal
          invoice={previewInvoice}
          open={!!previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          onDownload={() => {
            downloadInvoice(previewInvoice.id, previewInvoice.invoiceNo)
            setPreviewInvoice(null)
          }}
        />
      )}
    </div>
  )
}

const InvoiceRow: React.FC<{ label: string; amount: number; bold?: boolean; highlight?: boolean; isDeduction?: boolean }> = ({
  label, amount, bold, highlight, isDeduction,
}) => (
  <div className={`${styles.invoiceRow} ${bold ? styles.boldRow : ''} ${highlight ? styles.highlightRow : ''}`}>
    <span>{label}</span>
    <span style={{ color: isDeduction ? '#00B42A' : undefined }}>
      {isDeduction ? '−' : ''}BND {Math.abs(amount).toLocaleString()}
    </span>
  </div>
)

const ReceiptRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className={styles.receiptRow}>
    <span className={styles.receiptLabel}>{label}</span>
    <span className={styles.receiptValue}>{value}</span>
  </div>
)

export default FeeStatementPage
