import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Plus, TrendingUp, Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import styles from './CampusCardPage.module.scss'

interface CampusCard {
  id: string
  balance: number
  status: string
  student: {
    studentId: string
    user: {
      displayName: string
      email: string
    }
  }
  transactions?: Transaction[]
}

interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  balanceAfter: number
  createdAt: string
}

const CampusCardPage: React.FC = () => {
  const { t } = useTranslation()
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()
  
  const [showTopUp, setShowTopUp] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState<number>(50)
  const [paymentMethod, setPaymentMethod] = useState<string>('credit_card')

  const { data: cardData, isLoading } = useQuery<{ card: CampusCard; transactions: Transaction[] }>({
    queryKey: ['campus-card', 'my-card'],
    queryFn: async () => {
      const { data } = await apiClient.get('/campus-card/my-card')
      return {
        card: data.data,
        transactions: data.data.transactions || [],
      }
    },
  })

  const topUpMutation = useMutation({
    mutationFn: async ({ amount, method }: { amount: number; method: string }) => {
      const { data } = await apiClient.post('/campus-card/top-up', { amount, method })
      return data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: t('campusCard.topUpSuccess') })
      setShowTopUp(false)
      qc.invalidateQueries({ queryKey: ['campus-card'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? t('campusCard.topUpFailed') })
    },
  })

  const handleTopUp = () => {
    if (topUpAmount < 10 || topUpAmount > 1000) {
      addToast({ type: 'error', message: t('campusCard.invalidAmount') })
      return
    }
    topUpMutation.mutate({ amount: topUpAmount, method: paymentMethod })
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{t('common.loading')}</div>
      </div>
    )
  }

  const card = cardData?.card
  const transactions = cardData?.transactions || []

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <CreditCard size={24} /> {t('campusCard.title', { defaultValue: 'Campus Card' })}
        </h1>
        <p className={styles.pageDesc}>
          {t('campusCard.desc', { defaultValue: 'Manage your campus card balance and transactions' })}
        </p>
      </div>

      {card && (
        <div className={styles.cardGrid}>
          <Card className={styles.balanceCard}>
            <div className={styles.cardHeader}>
              <CreditCard size={32} />
              <Badge color={card.status === 'active' ? 'green' : 'red'}>
                {card.status === 'active' ? t('campusCard.active') : t('campusCard.inactive')}
              </Badge>
            </div>
            <div className={styles.balanceInfo}>
              <div className={styles.balanceLabel}>{t('campusCard.currentBalance')}</div>
              <div className={styles.balanceAmount}>BND {card.balance.toFixed(2)}</div>
              <div className={styles.cardNumber}>
                {card.student.user.displayName} • {card.student.studentId}
              </div>
            </div>
            <Button onClick={() => setShowTopUp(true)} className={styles.topUpBtn}>
              <Plus size={16} /> {t('campusCard.topUp')}
            </Button>
          </Card>

          <Card className={styles.statsCard}>
            <div className={styles.statItem}>
              <TrendingUp size={20} />
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  BND {transactions.filter(t => t.type === 'top_up').reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                </div>
                <div className={styles.statLabel}>{t('campusCard.totalTopUp')}</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <Clock size={20} />
              <div className={styles.statContent}>
                <div className={styles.statValue}>{transactions.length}</div>
                <div className={styles.statLabel}>{t('campusCard.totalTransactions')}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card title={t('campusCard.transactionHistory')}>
        {transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <Clock size={48} />
            <h3>{t('campusCard.noTransactions')}</h3>
            <p>{t('campusCard.noTransactionsDesc')}</p>
          </div>
        ) : (
          <div className={styles.transactionList}>
            {transactions.map(transaction => (
              <div key={transaction.id} className={styles.transactionItem}>
                <div className={styles.transactionIcon}>
                  {transaction.type === 'top_up' ? (
                    <Plus size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                </div>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionDesc}>{transaction.description}</div>
                  <div className={styles.transactionDate}>
                    {new Date(transaction.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className={styles.transactionAmount}>
                  <div className={transaction.type === 'top_up' ? styles.positive : styles.negative}>
                    {transaction.type === 'top_up' ? '+' : '-'}BND {transaction.amount.toFixed(2)}
                  </div>
                  <div className={styles.balanceAfter}>
                    {t('campusCard.balance')}: BND {transaction.balanceAfter.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showTopUp && (
        <Modal
          open
          title={t('campusCard.topUpTitle')}
          onClose={() => setShowTopUp(false)}
          footer={
            <div className={styles.modalFooter}>
              <Button variant="ghost" onClick={() => setShowTopUp(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleTopUp} loading={topUpMutation.isPending}>
                <CheckCircle size={16} /> {t('campusCard.confirmTopUp')}
              </Button>
            </div>
          }
        >
          <div className={styles.topUpForm}>
            <div className={styles.formGroup}>
              <label>{t('campusCard.amount')}</label>
              <div className={styles.amountOptions}>
                {[20, 50, 100, 200].map(amount => (
                  <button
                    key={amount}
                    className={`${styles.amountBtn} ${topUpAmount === amount ? styles.active : ''}`}
                    onClick={() => setTopUpAmount(amount)}
                  >
                    BND {amount}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={topUpAmount}
                onChange={e => setTopUpAmount(Number(e.target.value))}
                min={10}
                max={1000}
                className={styles.amountInput}
                placeholder={t('campusCard.customAmount')}
              />
              <span className={styles.hint}>{t('campusCard.amountHint')}</span>
            </div>

            <div className={styles.formGroup}>
              <label>{t('campusCard.paymentMethod')}</label>
              <div className={styles.paymentMethods}>
                <button
                  className={`${styles.methodBtn} ${paymentMethod === 'credit_card' ? styles.active : ''}`}
                  onClick={() => setPaymentMethod('credit_card')}
                >
                  <CreditCard size={16} />
                  {t('campusCard.creditCard')}
                </button>
                <button
                  className={`${styles.methodBtn} ${paymentMethod === 'debit_card' ? styles.active : ''}`}
                  onClick={() => setPaymentMethod('debit_card')}
                >
                  <CreditCard size={16} />
                  {t('campusCard.debitCard')}
                </button>
                <button
                  className={`${styles.methodBtn} ${paymentMethod === 'bank_transfer' ? styles.active : ''}`}
                  onClick={() => setPaymentMethod('bank_transfer')}
                >
                  {t('campusCard.bankTransfer')}
                </button>
              </div>
            </div>

            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span>{t('campusCard.topUpAmount')}</span>
                <span>BND {topUpAmount.toFixed(2)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>{t('campusCard.currentBalance')}</span>
                <span>BND {card?.balance.toFixed(2)}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.total}`}>
                <span>{t('campusCard.newBalance')}</span>
                <span>BND {((card?.balance || 0) + topUpAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default CampusCardPage
