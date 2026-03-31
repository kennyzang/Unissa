import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, CreditCard, BookOpen, Mail, DollarSign, ExternalLink, LockKeyhole } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import Badge from '@/components/ui/Badge'
import styles from './CampusServicesPage.module.scss'

interface CampusServices {
  campusCardNo: string | null
  libraryAccountActive: boolean
  emailAccountActive: boolean
  libraryAccount: {
    accountNo: string
    isActive: boolean
    activatedAt: string | null
    borrowingLimit: number
    currentBorrowed: number
  } | null
}

interface Invoice {
  id: string
  invoiceNo: string
  totalAmount: number
  status: string
  generatedAt: string
  dueDate: string
}

interface StudentProfile {
  id: string
  studentId: string
  user: { displayName: string; email: string; username: string }
}

const CampusServicesPage: React.FC = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)

  const { data: studentProfile, isLoading: profileLoading } = useQuery<StudentProfile>({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
    enabled: !!user,
    retry: false,
  })

  const { data: services, isLoading: svcLoading } = useQuery<CampusServices>({
    queryKey: ['campus-services', studentProfile?.studentId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/students/${studentProfile?.studentId}/campus-services`)
      return data.data
    },
    enabled: !!studentProfile?.studentId,
  })

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices', studentProfile?.studentId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/finance/invoices/${studentProfile?.studentId}`)
      return data.data
    },
    enabled: !!studentProfile?.studentId,
  })

  const isLoading = profileLoading || (studentProfile && svcLoading)

  // Not yet enrolled — show placeholder
  if (!profileLoading && !studentProfile) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <LockKeyhole size={36} color="#bbb" />
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, color: '#333', marginBottom: 8 }}>
          {t('campusServices.notEnrolledTitle', { defaultValue: 'Not Enrolled Yet' })}
        </div>
        <div style={{ fontSize: 14, color: '#888', lineHeight: 1.7 }}>
          {t('campusServices.notEnrolledMsg', { defaultValue: 'Campus services will be activated once you have been admitted and accepted your offer. Please complete your admission application first.' })}
        </div>
      </div>
    )
  }

  const latestInvoice = invoices[0]

  const cards = [
    {
      id: 'lms',
      icon: <BookOpen size={28} />,
      title: t('campusServices.lmsSystem'),
      subtitle: t('campusServices.lmsSubtitle'),
      active: true,
      detail: `${studentProfile?.user?.displayName ? `${studentProfile.user.displayName} ${t('campusServices.registered')}` : t('campusServices.registered')}`,
      subDetail: t('campusServices.viewCourses'),
      color: '#165DFF',
      actionLabel: t('campusServices.viewCourses'),
      onAction: () => navigate('/lms/courses'),
    },
    {
      id: 'library',
      icon: <BookOpen size={28} />,
      title: t('campusServices.librarySystem'),
      subtitle: t('campusServices.libraryAccount'),
      active: services?.libraryAccountActive ?? false,
      detail: services?.libraryAccount?.accountNo ?? (services?.libraryAccountActive ? `LIB-${studentProfile?.studentId}` : t('campusServices.notActivated')),
      subDetail: services?.libraryAccount?.activatedAt
        ? `${t('campusServices.activatedAt')}${new Date(services.libraryAccount.activatedAt).toLocaleDateString()}`
        : services?.libraryAccountActive ? t('campusServices.accountActivated') : t('campusServices.completeRegistrationFirst'),
      color: '#00B42A',
      actionLabel: null,
      onAction: null,
    },
    {
      id: 'campus-card',
      icon: <CreditCard size={28} />,
      title: t('campusServices.campusCard'),
      subtitle: t('campusServices.campusCardSubtitle'),
      active: !!services?.campusCardNo,
      detail: services?.campusCardNo ?? t('campusServices.notGenerated'),
      subDetail: services?.campusCardNo ? t('campusServices.cardAssigned') : t('campusServices.completeRegistrationFirst'),
      color: '#FF7D00',
      actionLabel: null,
      onAction: null,
    },
    {
      id: 'email',
      icon: <Mail size={28} />,
      title: t('campusServices.universityEmail'),
      subtitle: t('campusServices.universityEmailSubtitle'),
      active: services?.emailAccountActive ?? false,
      detail: services?.emailAccountActive ? (studentProfile?.user?.email ?? t('campusServices.notActivated')) : t('campusServices.notActivated'),
      subDetail: services?.emailAccountActive ? t('campusServices.emailActivated') : t('campusServices.completeRegistrationFirst'),
      color: '#7816FF',
      actionLabel: null,
      onAction: null,
    },
    {
      id: 'finance',
      icon: <DollarSign size={28} />,
      title: t('campusServices.financeAccount'),
      subtitle: t('campusServices.financeAccountSubtitle'),
      active: !!latestInvoice,
      detail: latestInvoice ? `BND ${latestInvoice.totalAmount.toLocaleString()}` : t('campusServices.noInvoices'),
      subDetail: latestInvoice
        ? `${t('campusServices.invoice')} ${latestInvoice.invoiceNo} · ${t('campusServices.due')}${new Date(latestInvoice.dueDate).toLocaleDateString()}`
        : t('campusServices.completeRegForInvoice'),
      color: '#0FC6C2',
      actionLabel: latestInvoice ? t('campusServices.viewInvoice') : null,
      onAction: latestInvoice ? () => navigate('/finance/statement') : null,
    },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('campusServices.title')}</h1>
          <p className={styles.pageSub}>
            {t('campusServices.studentId')} {studentProfile?.studentId} · {studentProfile?.user?.displayName} ·{' '}
            {cards.filter(c => c.active).length}/{cards.length} {t('campusServices.servicesActivated')}
          </p>
        </div>
        <div className={styles.headerStatus}>
          <div className={styles.statusDot} />
          <span>{t('campusServices.syncStatus')}</span>
        </div>
      </div>

      {/* Integration callout */}
      <div className={styles.integrationBanner}>
        <span className={styles.integrationIcon}>⚡</span>
        <div>
          <strong>{t('campusServices.integrationDemo')}</strong>
          <p>{t('campusServices.integrationNote')}</p>
        </div>
      </div>

      <div className={styles.serviceGrid}>
        {cards.map(card => (
          <div
            key={card.id}
            className={`${styles.serviceCard} ${card.active ? styles.activeCard : styles.inactiveCard}`}
            style={{ '--card-color': card.color } as React.CSSProperties}
          >
            <div className={styles.cardTop}>
              <div className={styles.cardIcon} style={{ color: card.active ? card.color : '#C9CDD4' }}>
                {card.icon}
              </div>
              <div className={styles.cardStatus}>
                {card.active
                  ? <CheckCircle size={20} style={{ color: card.color }} />
                  : <XCircle size={20} style={{ color: '#C9CDD4' }} />
                }
              </div>
            </div>

            <div className={styles.cardTitle}>{card.title}</div>
            <div className={styles.cardSubtitle}>{card.subtitle}</div>

            <div className={styles.cardDetail} style={{ color: card.active ? card.color : '#C9CDD4' }}>
              {card.detail}
            </div>
            <div className={styles.cardSubDetail}>{card.subDetail}</div>

            <div className={styles.cardFooter}>
              <Badge color={card.active ? 'green' : 'gray'} size="sm">
                {card.active ? t('campusServices.activated') : t('campusServices.notActivated')}
              </Badge>
              {card.actionLabel && card.onAction && (
                <button className={styles.cardAction} onClick={card.onAction}>
                  {card.actionLabel} <ExternalLink size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

export default CampusServicesPage
