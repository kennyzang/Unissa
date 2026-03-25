import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Minus, CheckCircle, AlertTriangle, BookOpen, Clock } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import styles from './CourseRegistrationPage.module.scss'

interface Offering {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  seatsTaken: number
  maxSeats: number
  course: { id: string; name: string; code: string; creditHours: number; level: number; description?: string }
  lecturer: { user: { displayName: string } }
  semester: { id: string; name: string }
}

// We'll fetch available offerings (all active offerings for current semester)
const CourseRegistrationPage: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()

  const [selected, setSelected] = useState<string[]>([])
  const [confirmModal, setConfirmModal] = useState(false)
  const [successData, setSuccessData] = useState<any>(null)

  // Fetch all course offerings (using student timetable shows current, so we need a different endpoint)
  // We'll use a custom query that fetches all offerings
  const { data: offerings = [], isLoading } = useQuery<Offering[]>({
    queryKey: ['course-offerings'],
    queryFn: async () => {
      // Get available offerings via a general endpoint; fallback to student 2026001
      const { data } = await apiClient.get('/students/2026001/timetable')
      // If student already has offerings, show those plus some demo extras
      // For demo: return the timetable as registered and also pull extra offerings
      const registered = data.data as Offering[]
      // Return all offerings - registered ones are already taken
      return registered
    },
  })

  // Also fetch all available offerings from DB
  const { data: allOfferings = [] } = useQuery<Offering[]>({
    queryKey: ['all-offerings'],
    queryFn: async () => {
      // Since we don't have a general /offerings endpoint, use LMS courses
      const { data } = await apiClient.get('/lms/courses/2026001')
      return (data.data ?? []).map((c: any) => c.offering ?? c).filter(Boolean)
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (offeringIds: string[]) => {
      const semesterId = offerings[0]?.semester?.id ?? 'sem-1'
      const { data } = await apiClient.post('/students/2026001/register-courses', { offeringIds, semesterId })
      return data
    },
    onSuccess: (data) => {
      setSuccessData(data)
      setConfirmModal(false)
      qc.invalidateQueries({ queryKey: ['student'] })
      addToast({ type: 'success', message: data.message ?? 'Courses registered successfully!' })
    },
    onError: (e: any) => {
      setConfirmModal(false)
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Registration failed' })
    },
  })

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectedOfferings = offerings.filter(o => selected.includes(o.id))
  const totalCH = selectedOfferings.reduce((s, o) => s + (o.course?.creditHours ?? 0), 0)
  const maxCH = 18
  const minCH = 12

  const getAvailabilityColor = (taken: number, max: number): 'green' | 'orange' | 'red' => {
    const pct = taken / max
    if (pct >= 0.9) return 'red'
    if (pct >= 0.7) return 'orange'
    return 'green'
  }

  if (successData) {
    return (
      <div className={styles.successWrap}>
        <div className={styles.successCard}>
          <CheckCircle size={48} className={styles.successIcon} />
          <h2>Registration Successful!</h2>
          <p>{successData.message}</p>
          <div className={styles.successDetails}>
            <div className={styles.successStat}>
              <span>{successData.data?.totalCH}</span>
              <label>Credit Hours</label>
            </div>
            <div className={styles.successStat}>
              <span>{selectedOfferings.length}</span>
              <label>Courses</label>
            </div>
            {successData.data?.invoice && (
              <div className={styles.successStat}>
                <span>BND {successData.data.invoice.totalAmount?.toLocaleString()}</span>
                <label>Invoice Generated</label>
              </div>
            )}
          </div>
          {successData.data?.campusCardNo && (
            <p className={styles.campusCardMsg}>
              🎓 Campus Card issued: <strong>{successData.data.campusCardNo}</strong>
            </p>
          )}
          <div className={styles.successActions}>
            <Button variant="secondary" onClick={() => navigate('/finance/statement')}>View Invoice</Button>
            <Button onClick={() => navigate('/student/profile')}>View Profile</Button>
          </div>
        </div>
      </div>
    )
  }

  // Demo course catalogue (supplemented if offerings empty)
  const displayOfferings = offerings.length > 0 ? offerings : DEMO_OFFERINGS

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Course Registration</h1>
          <p className={styles.pageSub}>Semester Sep 2026 · Select {minCH}–{maxCH} credit hours</p>
        </div>
        <div className={styles.chSummary}>
          <div className={styles.chCount} style={{ color: totalCH > maxCH ? '#F53F3F' : totalCH >= minCH ? '#00B42A' : '#FF7D00' }}>
            {totalCH}
          </div>
          <div className={styles.chLabel}>/ {maxCH} CH selected</div>
          {totalCH > 0 && totalCH < minCH && (
            <div className={styles.chWarning}><AlertTriangle size={12} /> Minimum {minCH} CH required</div>
          )}
          {totalCH > maxCH && (
            <div className={styles.chError}><AlertTriangle size={12} /> Maximum {maxCH} CH exceeded</div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className={styles.floatingBar}>
          <span>{selected.length} course{selected.length > 1 ? 's' : ''} selected · {totalCH} CH</span>
          <div className={styles.barActions}>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear</Button>
            <Button
              size="sm"
              disabled={totalCH < minCH || totalCH > maxCH}
              onClick={() => setConfirmModal(true)}
            >
              Register Selected Courses
            </Button>
          </div>
        </div>
      )}

      <div className={styles.courseGrid}>
        {isLoading ? (
          <div className={styles.loading}>Loading available courses…</div>
        ) : (
          displayOfferings.map(offering => {
            const isSelected = selected.includes(offering.id)
            const seats = offering.seatsTaken ?? 0
            const maxSeats = offering.maxSeats ?? 30
            const seatsLeft = maxSeats - seats

            return (
              <div
                key={offering.id}
                className={`${styles.courseCard} ${isSelected ? styles.selectedCard : ''}`}
                onClick={() => toggle(offering.id)}
              >
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.courseCode}>{offering.course?.code}</div>
                    <div className={styles.courseName}>{offering.course?.name}</div>
                  </div>
                  <div className={`${styles.selectToggle} ${isSelected ? styles.selected : ''}`}>
                    {isSelected ? <Minus size={16} /> : <Plus size={16} />}
                  </div>
                </div>
                <div className={styles.cardMeta}>
                  <span><BookOpen size={12} /> {offering.course?.creditHours} CH</span>
                  <span><Clock size={12} /> {offering.dayOfWeek} {offering.startTime}–{offering.endTime}</span>
                </div>
                <div className={styles.cardMeta}>
                  <span>📍 {offering.room}</span>
                  <span>👤 {offering.lecturer?.user?.displayName ?? 'TBA'}</span>
                </div>
                <div className={styles.cardFooter}>
                  <Badge color={getAvailabilityColor(seats, maxSeats)} size="sm">
                    {seatsLeft > 0 ? `${seatsLeft} seats left` : 'Full'}
                  </Badge>
                  <Badge color="gray" size="sm">Level {offering.course?.level}</Badge>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Confirm Modal */}
      <Modal
        open={confirmModal}
        title="Confirm Course Registration"
        onClose={() => setConfirmModal(false)}
        okText="Confirm Registration"
        onOk={() => registerMutation.mutate(selected)}
        okLoading={registerMutation.isPending}
      >
        <p className={styles.confirmText}>You are about to register the following {selectedOfferings.length} course{selectedOfferings.length > 1 ? 's' : ''} ({totalCH} CH total):</p>
        <div className={styles.confirmList}>
          {selectedOfferings.map(o => (
            <div key={o.id} className={styles.confirmItem}>
              <span>{o.course?.code} – {o.course?.name}</span>
              <span className={styles.confirmCH}>{o.course?.creditHours} CH</span>
            </div>
          ))}
        </div>
        <p className={styles.confirmNote}>
          A fee invoice will be automatically generated upon successful registration.
          Campus card, library access, and email account will be activated.
        </p>
      </Modal>
    </div>
  )
}

// Demo fallback data if API is empty
const DEMO_OFFERINGS = [
  { id: 'off-1', dayOfWeek: 'Monday', startTime: '08:00', endTime: '10:00', room: 'Lab 1', seatsTaken: 18, maxSeats: 30,
    course: { id: 'c1', name: 'Introduction to Programming', code: 'IFN101', creditHours: 3, level: 1 },
    lecturer: { user: { displayName: 'Dr. Siti Aminah' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-2', dayOfWeek: 'Tuesday', startTime: '10:00', endTime: '12:00', room: 'LT2', seatsTaken: 25, maxSeats: 40,
    course: { id: 'c2', name: 'Data Structures & Algorithms', code: 'IFN102', creditHours: 3, level: 2 },
    lecturer: { user: { displayName: 'Dr. Ahmad Fadzil' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-3', dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '17:00', room: 'Lab 3', seatsTaken: 12, maxSeats: 20,
    course: { id: 'c3', name: 'Database Systems', code: 'IFN201', creditHours: 3, level: 2 },
    lecturer: { user: { displayName: 'Dr. Maria Santos' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-4', dayOfWeek: 'Thursday', startTime: '08:00', endTime: '10:00', room: 'TR1', seatsTaken: 8, maxSeats: 35,
    course: { id: 'c4', name: 'Web Development', code: 'IFN202', creditHours: 3, level: 2 },
    lecturer: { user: { displayName: 'Dr. Chen Wei' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-5', dayOfWeek: 'Friday', startTime: '10:00', endTime: '12:00', room: 'LT1', seatsTaken: 29, maxSeats: 30,
    course: { id: 'c5', name: 'Software Engineering', code: 'IFN301', creditHours: 3, level: 3 },
    lecturer: { user: { displayName: 'Prof. Zainudin' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-6', dayOfWeek: 'Monday', startTime: '14:00', endTime: '16:00', room: 'Lab 2', seatsTaken: 5, maxSeats: 20,
    course: { id: 'c6', name: 'Network Security', code: 'IFN302', creditHours: 3, level: 3 },
    lecturer: { user: { displayName: 'Dr. Hasan Ali' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
]

export default CourseRegistrationPage
