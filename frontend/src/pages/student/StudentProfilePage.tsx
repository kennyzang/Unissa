import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { GraduationCap, BookOpen, CreditCard, Library, Mail, MapPin, Calendar } from 'lucide-react'
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

  if (isLoading) return <div className={styles.loading}>Loading student profile…</div>
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
            <span><Calendar size={13} /> Intake: {student.intake.semester.name}</span>
            <span><Mail size={13} /> {student.user.email}</span>
          </div>
          <div className={styles.heroBadges}>
            <Badge color={STATUS_COLOR[student.status] ?? 'gray'}>{student.status}</Badge>
            <Badge color="blue">{student.modeOfStudy.replace('_', ' ')}</Badge>
            {student.scholarshipPct > 0 && <Badge color="purple">{student.scholarshipPct}% Scholarship</Badge>}
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{student.currentCgpa.toFixed(2)}</span>
            <span className={styles.heroStatLabel}>CGPA</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{totalCH}</span>
            <span className={styles.heroStatLabel}>Credit Hours</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{student.programme.level.toUpperCase()}</span>
            <span className={styles.heroStatLabel}>Level</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['profile', 'timetable', 'services'] as const).map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`} onClick={() => setTab(t)}>
            {t === 'profile' ? 'Profile' : t === 'timetable' ? 'Timetable' : 'Campus Services'}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className={styles.profileGrid}>
          <Card title="Academic Details">
            <div className={styles.detailList}>
              <DetailRow label="Student ID" value={student.studentId} />
              <DetailRow label="Programme" value={`${student.programme.name} (${student.programme.code})`} />
              <DetailRow label="Department" value={student.programme.department.name} />
              <DetailRow label="Intake" value={student.intake.semester.name} />
              <DetailRow label="Level" value={student.programme.level} />
              <DetailRow label="Student Type" value={student.studentType} />
              <DetailRow label="Nationality" value={student.nationality} />
              <DetailRow label="Enrolled" value={new Date(student.enrolledAt).toLocaleDateString('en-GB')} />
            </div>
          </Card>
          <Card title="Financial Summary">
            <div className={styles.detailList}>
              <DetailRow label="Scholarship" value={student.scholarshipPct > 0 ? `${student.scholarshipPct}%` : 'None'} />
              <DetailRow label="Mode of Study" value={student.modeOfStudy.replace('_', ' ')} />
              <DetailRow label="CGPA" value={student.currentCgpa.toFixed(2)} />
              <DetailRow label="Status" value={<Badge color={STATUS_COLOR[student.status] ?? 'gray'}>{student.status}</Badge>} />
            </div>
          </Card>
        </div>
      )}

      {/* Timetable Tab */}
      {tab === 'timetable' && (
        <Card title={`Weekly Timetable — ${totalCH} Credit Hours`}>
          <div className={styles.timetableGrid}>
            {byDay.map(({ day, slots }) => (
              <div key={day} className={styles.dayCol}>
                <div className={styles.dayHeader}>{day}</div>
                {slots.length === 0
                  ? <div className={styles.emptyDay}>No class</div>
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
      )}

      {/* Campus Services Tab */}
      {tab === 'services' && services && (
        <div className={styles.servicesGrid}>
          <ServiceCard
            icon={<CreditCard size={28} />}
            title="Campus Card"
            value={services.campusCardNo ?? 'Not issued'}
            active={!!services.campusCardNo}
            activeLabel="Active"
            inactiveLabel="Pending Registration"
            color="#165DFF"
          />
          <ServiceCard
            icon={<Library size={28} />}
            title="Library Access"
            value={services.libraryAccountActive ? 'Active' : 'Inactive'}
            active={services.libraryAccountActive}
            activeLabel="Books can be borrowed"
            inactiveLabel="Register courses to activate"
            color="#7D3FCC"
          />
          <ServiceCard
            icon={<Mail size={28} />}
            title="UNISSA Email"
            value={services.emailAccountActive ? `${student.studentId.toLowerCase()}@student.unissa.edu.bn` : 'Not provisioned'}
            active={services.emailAccountActive}
            activeLabel="Email account active"
            inactiveLabel="Register courses to activate"
            color="#00B42A"
          />
        </div>
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
