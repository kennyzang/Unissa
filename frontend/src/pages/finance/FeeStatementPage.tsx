import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CreditCard, CheckCircle, AlertCircle, Receipt } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
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
  method: z.enum(['card', 'online_banking', 'e_wallet']),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  cardHolder: z.string().optional(),
  bankName: z.string().optional(),
})
type PayForm = z.infer<typeof paySchema>

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
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', '2026001'],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/invoices/2026001')
      return data.data
    },
  })

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

  const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingBalance, 0)

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
        >
          <div className={styles.payAmount}>
            Amount: <strong>BND {payModal.outstandingBalance.toLocaleString()}</strong>
          </div>

          <form onSubmit={onPay} className={styles.payForm}>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select
                  label="Payment Method"
                  value={field.value}
                  onChange={val => field.onChange(val)}
                  options={[
                    { value: 'card', label: 'Credit / Debit Card' },
                    { value: 'online_banking', label: 'Online Banking' },
                    { value: 'e_wallet', label: 'E-Wallet' },
                  ]}
                />
              )}
            />

            {method === 'card' && (
              <>
                <Input
                  label="Card Number"
                  placeholder="4111 1111 1111 1111"
                  hint="Use 4000 0000 0000 0002 to test decline"
                  {...register('cardNumber')}
                  error={errors.cardNumber?.message}
                />
                <div className={styles.cardRow}>
                  <Input label="Expiry" placeholder="MM/YY" {...register('cardExpiry')} />
                  <Input label="CVV" placeholder="123" {...register('cardCvv')} />
                </div>
                <Input label="Cardholder Name" {...register('cardHolder')} />
              </>
            )}

            {method === 'online_banking' && (
              <Controller
                control={control}
                name="bankName"
                render={({ field }) => (
                  <Select
                    label="Bank"
                    value={field.value}
                    onChange={val => field.onChange(val)}
                    options={[
                      { value: 'BIBD', label: 'BIBD (Baiduri)' },
                      { value: 'Baiduri', label: 'Baiduri Bank' },
                      { value: 'HSBC', label: 'HSBC Brunei' },
                      { value: 'Maybank', label: 'Maybank' },
                    ]}
                  />
                )}
              />
            )}

            {method === 'e_wallet' && (
              <div className={styles.ewalletNote}>
                You will be redirected to complete payment via e-wallet. (Demo: auto-approved)
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
