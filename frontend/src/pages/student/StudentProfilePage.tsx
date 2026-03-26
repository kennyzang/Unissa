import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { Tabs } from 'antd'
import { GraduationCap, CreditCard, Library, Mail, MapPin, Calendar } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import styles from './StudentProfilePage.module.scss'

interface StudentData {
  id: string
  studentId: string
  nationality: string
  studentType: string
  currentCgpa: number
  scholarshipPct: number
  campusCardNo?: string
  libraryAccountActive: boolean
  emailAccountActive: boolean
  status: string
  enrolledAt: string
  modeOfStudy: string
  user: { displayName: string; email: string }
  programme: { name: string; code: string; level: string; department: { name: string } }
  intake: { intakeStart: string; semester: { name: string } }
}

interface Offering {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  course: { name: string; code: string; creditHours: number }
  lecturer: { user: { displayName: string } }
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const STATUS_COLOR: Record<string, 'green' | 'red' | 'orange' | 'gray'> = {
  active: 'green', suspended: 'red', graduated: 'blue' as any, withdrawn: 'gray',
}

const StudentProfilePage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const [tab, setTab] = useState<'profile' | 'timetable' | 'services'>('profile')


  const studentId = user?.role === 'student' ? 'me' : '2026001'

  const { data: student, isLoading } = useQuery<StudentData>({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const id = studentId === 'me' ? '2026001' : studentId
      const { data } = await apiClient.get(`/students/${id}`)
      return data.data
    },
  })

  const { data: timetable = [] } = useQuery<Offering[]>({
    queryKey: ['student', studentId, 'timetable'],
    queryFn: async () => {
      const id = studentId === 'me' ? '2026001' : studentId
      const { data } = await apiClient.get(`/students/${id}/timetable`)
      return data.data
    },
    enabled: tab === 'timetable',
  })

  const { data: services } = useQuery<{ campusCardNo?: string; libraryAccountActive: boolean; emailAccountActive: boolean }>({
    queryKey: ['student', studentId, 'campus-services'],
    queryFn: async () => {
      const id = studentId === 'me' ? '2026001' : studentId
      const { data } = await apiClient.get(`/students/${id}/campus-services`)
      return data.data
    },
    enabled: tab === 'services',
  })

  if (isLoading) return <div className={styles.loading}>{t('studentProfile.loading')}</div>
  if (!student) return <div className={styles.loading}>Student not found</div>

  // Group timetable by day
  const byDay = DAYS_ORDER.map(day => ({
    day,
    slots: timetable.filter(t => t.dayOfWeek === day),
  }))

  const totalCH = timetable.reduce((s, t) => s + (t.course?.creditHours ?? 0), 0)

  return (
    <div className={styles.page}>
      {/* Profile Hero */}
      <div className={styles.hero}>
        <div className={styles.avatar}>
          {student.user.displayName.charAt(0).toUpperCase()}
        </div>
        <div className={styles.heroInfo}>
          <div className={styles.heroName}>{student.user.displayName}</div>
          <div className={styles.heroId}>{student.studentId}</div>
          <div className={styles.heroMeta}>
            <span><GraduationCap size={13} /> {student.programme.name}</span>
            <span><MapPin size={13} /> {student.programme.department.name}</span>
            <span><Calendar size={13} /> {t('studentProfile.intake')} {student.intake.semester.name}</span>
            <span><Mail size={13} /> {student.user.email}</span>
          </div>
          <div className={styles.heroBadges}>
            <Badge color={STATUS_COLOR[student.status] ?? 'gray'}>{student.status}</Badge>
            <Badge color="blue">{student.modeOfStudy.replace('_', ' ')}</Badge>
            {student.scholarshipPct > 0 && <Badge color="purple">{student.scholarshipPct}% {t('studentProfile.scholarship')}</Badge>}
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{student.currentCgpa.toFixed(2)}</span>
            <span className={styles.heroStatLabel}>{t('studentProfile.cgpa')}</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{totalCH}</span>
            <span className={styles.heroStatLabel}>{t('studentProfile.creditHours')}</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{student.programme.level.toUpperCase()}</span>
            <span className={styles.heroStatLabel}>{t('studentProfile.level')}</span>
          </div>
        </div>
      </div>

      <Tabs
        activeKey={tab}
        onChange={key => setTab(key as typeof tab)}
        items={[
          {
            key: 'profile',
            label: t('studentProfile.profile'),
            children: (
              <div className={styles.profileGrid}>
                <Card title={t('studentProfile.academicDetails')}>
                  <div className={styles.detailList}>
                    <DetailRow label={t('studentProfile.studentId')} value={student.studentId} />
                    <DetailRow label={t('studentProfile.programme')} value={`${student.programme.name} (${student.programme.code})`} />
                    <DetailRow label={t('studentProfile.department')} value={student.programme.department.name} />
                    <DetailRow label={t('studentProfile.intakeLabel')} value={student.intake.semester.name} />
                    <DetailRow label={t('studentProfile.level')} value={student.programme.level} />
                    <DetailRow label={t('studentProfile.studentType')} value={student.studentType} />
                    <DetailRow label={t('studentProfile.nationality')} value={student.nationality} />
                    <DetailRow label={t('studentProfile.enrolled')} value={new Date(student.enrolledAt).toLocaleDateString('en-GB')} />
                  </div>
                </Card>
                <Card title={t('studentProfile.financialSummary')}>
                  <div className={styles.detailList}>
                    <DetailRow label={t('studentProfile.scholarship')} value={student.scholarshipPct > 0 ? `${student.scholarshipPct}%` : t('studentProfile.none')} />
                    <DetailRow label={t('studentProfile.modeOfStudy')} value={student.modeOfStudy.replace('_', ' ')} />
                    <DetailRow label={t('studentProfile.cgpa')} value={student.currentCgpa.toFixed(2)} />
                    <DetailRow label={t('common.status')} value={<Badge color={STATUS_COLOR[student.status] ?? 'gray'}>{student.status}</Badge>} />
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'timetable',
            label: t('studentProfile.timetable'),
            children: (
              <Card title={t('studentProfile.weeklyTimetableHours', { hours: totalCH })}>
                <div className={styles.timetableGrid}>
                  {byDay.map(({ day, slots }) => (
                    <div key={day} className={styles.dayCol}>
                      <div className={styles.dayHeader}>{day}</div>
                      {slots.length === 0
                        ? <div className={styles.emptyDay}>{t('studentProfile.noClass')}</div>
                        : slots.map(slot => (
                          <div key={slot.id} className={styles.slotCard}>
                            <div className={styles.slotCourse}>{slot.course?.name}</div>
                            <div className={styles.slotCode}>{slot.course?.code} · {slot.course?.creditHours} CH</div>
                            <div className={styles.slotTime}>{slot.startTime} – {slot.endTime}</div>
                            <div className={styles.slotRoom}>{slot.room}</div>
                            <div className={styles.slotLecturer}>{slot.lecturer?.user?.displayName}</div>
                          </div>
                        ))
                      }
                    </div>
                  ))}
                </div>
              </Card>
            ),
          },
          {
            key: 'services',
            label: t('studentProfile.campusServices'),
            children: services ? (
              <div className={styles.servicesGrid}>
                <ServiceCard
                  icon={<CreditCard size={28} />}
                  title={t('studentProfile.campusCard')}
                  value={services.campusCardNo ?? t('studentProfile.notIssued')}
                  active={!!services.campusCardNo}
                  activeLabel={t('studentProfile.active')}
                  inactiveLabel={t('studentProfile.pendingRegistration')}
                  color="#165DFF"
                />
                <ServiceCard
                  icon={<Library size={28} />}
                  title={t('studentProfile.libraryAccess')}
                  value={services.libraryAccountActive ? t('studentProfile.active') : t('studentProfile.inactive')}
                  active={services.libraryAccountActive}
                  activeLabel={t('studentProfile.canBorrow')}
                  inactiveLabel={t('studentProfile.registerToActivate')}
                  color="#7D3FCC"
                />
                <ServiceCard
                  icon={<Mail size={28} />}
                  title={t('studentProfile.unissaEmail')}
                  value={services.emailAccountActive ? `${student.studentId.toLowerCase()}@student.unissa.edu.bn` : t('studentProfile.notProvisioned')}
                  active={services.emailAccountActive}
                  activeLabel={t('studentProfile.emailActive')}
                  inactiveLabel={t('studentProfile.registerToActivate')}
                  color="#00B42A"
                />
              </div>
            ) : null,
          },
        ]}
      />
    </div>
  )
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className={styles.detailRow}>
    <span className={styles.detailLabel}>{label}</span>
    <span className={styles.detailValue}>{value}</span>
  </div>
)

const ServiceCard: React.FC<{
  icon: React.ReactNode; title: string; value: string; active: boolean;
  activeLabel: string; inactiveLabel: string; color: string;
}> = ({ icon, title, value, active, activeLabel, inactiveLabel, color }) => (
  <div className={styles.serviceCard}>
    <div className={styles.serviceIconWrap} style={{ background: `${color}18`, color }}>
      {icon}
    </div>
    <div className={styles.serviceBody}>
      <div className={styles.serviceTitle}>{title}</div>
      <div className={styles.serviceValue}>{value}</div>
      <div className={`${styles.serviceStatus} ${active ? styles.serviceActive : styles.serviceInactive}`}>
        <span className={styles.serviceDot} />
        {active ? activeLabel : inactiveLabel}
      </div>
    </div>
  </div>
)

export default StudentProfilePage
