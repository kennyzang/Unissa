import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, CheckCircle, AlertTriangle, BookOpen, Clock, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
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
  course: {
    id: string
    name: string
    code: string
    creditHours: number
    level: number
    maxSeats: number
    prerequisites: { prerequisite: { id: string; code: string; name: string }; minGrade: string }[]
  }
  lecturer: { user: { displayName: string } }
  semester: { id: string; name: string }
}

function timesOverlap(a: Offering, b: Offering): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && a.endTime > b.startTime
}

const CourseRegistrationPage: React.FC = () => {
  const navigate = useNavigate()
  const addToast = useUIStore(s => s.addToast)
  const { t } = useTranslation()
  const qc = useQueryClient()

  const [selected, setSelected] = useState<string[]>([])
  const [confirmModal, setConfirmModal] = useState(false)
  const [successData, setSuccessData] = useState<any>(null)

  const { data: offerings = [], isLoading } = useQuery<Offering[]>({
    queryKey: ['offerings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/offerings')
      return (data.data ?? []).length > 0 ? data.data : DEMO_OFFERINGS
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (offeringIds: string[]) => {
      const semesterId = offerings.find(o => offeringIds.includes(o.id))?.semester?.id ?? 'sem-1'
      const { data } = await apiClient.post('/students/2026001/register-courses', { offeringIds, semesterId })
      return data
    },
    onSuccess: (data) => {
      setSuccessData(data)
      setConfirmModal(false)
      qc.invalidateQueries({ queryKey: ['lms'] })
      qc.invalidateQueries({ queryKey: ['campus-services'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      addToast({ type: 'success', message: data.message ?? t('courseReg.successTitle') })
    },
    onError: (e: any) => {
      setConfirmModal(false)
      const errData = e.response?.data
      if (errData?.conflicts) {
        addToast({ type: 'error', message: `Schedule conflict: ${errData.conflicts[0]?.course1} ↔ ${errData.conflicts[0]?.course2}` })
      } else if (errData?.prereqErrors) {
        addToast({ type: 'error', message: errData.prereqErrors[0] ?? 'Prerequisite not met' })
      } else {
        addToast({ type: 'error', message: errData?.message ?? 'Registration failed' })
      }
    },
  })

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectedOfferings = offerings.filter(o => selected.includes(o.id))
  const totalCH = selectedOfferings.reduce((s, o) => s + (o.course?.creditHours ?? 0), 0)
  const maxCH = 18
  const minCH = 12

  const conflictPairs: { a: string; b: string }[] = []
  for (let i = 0; i < selectedOfferings.length; i++) {
    for (let j = i + 1; j < selectedOfferings.length; j++) {
      if (timesOverlap(selectedOfferings[i], selectedOfferings[j])) {
        conflictPairs.push({ a: selectedOfferings[i].id, b: selectedOfferings[j].id })
      }
    }
  }
  const conflictingIds = new Set(conflictPairs.flatMap(p => [p.a, p.b]))
  const hasConflicts = conflictPairs.length > 0

  const getAvailabilityColor = (taken: number, max: number): 'green' | 'orange' | 'red' => {
    const pct = taken / max
    if (pct >= 0.9) return 'red'
    if (pct >= 0.7) return 'orange'
    return 'green'
  }

  // ── Success screen ────────────────────────────────────────────
  if (successData) {
    const syncSystems = [
      { icon: '📚', label: 'LMS', detail: t('campusServices.accountActivated'), color: '#165DFF', path: '/lms/courses' },
      { icon: '📖', label: t('campusServices.librarySystem'), detail: t('campusServices.accountActivated'), color: '#00B42A', path: '/campus/services' },
      { icon: '🎓', label: t('campusServices.campusCard'), detail: successData.data?.campusCardNo ?? 'CC-2026001', color: '#FF7D00', path: '/campus/services' },
      { icon: '💰', label: t('nav.finance'), detail: t('campusServices.activated'), color: '#7816FF', path: '/finance/statement' },
    ]
    return (
      <div className={styles.successWrap}>
        <div className={styles.successCard}>
          <CheckCircle size={48} className={styles.successIcon} />
          <h2>{t('courseReg.successTitle')}</h2>
          <p>{successData.message}</p>
          <div className={styles.successDetails}>
            <div className={styles.successStat}>
              <span>{successData.data?.totalCH}</span>
              <label>{t('courseReg.creditHours')}</label>
            </div>
            <div className={styles.successStat}>
              <span>{selectedOfferings.length || successData.data?.enrolments?.length}</span>
              <label>{t('courseReg.courseCount')}</label>
            </div>
            {successData.data?.invoice && (
              <div className={styles.successStat}>
                <span>BND {successData.data.invoice.totalAmount?.toLocaleString()}</span>
                <label>{t('courseReg.invoiceAmount')}</label>
              </div>
            )}
          </div>

          {/* 4-system sync panel */}
          <div className={styles.syncPanel}>
            <div className={styles.syncTitle}>{t('courseReg.systemSync')}</div>
            <div className={styles.syncGrid}>
              {syncSystems.map(sys => (
                <div
                  key={sys.label}
                  className={styles.syncCard}
                  style={{ borderColor: sys.color + '33', cursor: 'pointer' }}
                  onClick={() => navigate(sys.path)}
                >
                  <div className={styles.syncIcon}>{sys.icon}</div>
                  <div className={styles.syncLabel}>{sys.label}</div>
                  <div className={styles.syncDetail} style={{ color: sys.color }}>{sys.detail}</div>
                </div>
              ))}
            </div>
            <p className={styles.syncQuote}>「{t('courseReg.syncMessage')}」</p>
          </div>

          <div className={styles.successActions}>
            <Button variant="secondary" onClick={() => navigate('/finance/statement')}>{t('courseReg.viewInvoice')}</Button>
            <Button variant="secondary" onClick={() => navigate('/campus/services')}>{t('courseReg.viewCampus')}</Button>
            <Button onClick={() => navigate('/lms/courses')}>{t('courseReg.goToLms')}</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('courseReg.title')}</h1>
          <p className={styles.pageSub}>{t('courseReg.semesterLabel')} {minCH}–{maxCH} {t('courseReg.ch')}</p>
        </div>
        <div className={styles.chSummary}>
          <div className={styles.chCount} style={{ color: totalCH > maxCH ? '#F53F3F' : totalCH >= minCH ? '#00B42A' : '#FF7D00' }}>
            {totalCH}
          </div>
          <div className={styles.chLabel}>/ {maxCH} {t('courseReg.chSelected')}</div>
          {totalCH > 0 && totalCH < minCH && (
            <div className={styles.chWarning}><AlertTriangle size={12} /> {t('courseReg.min')} {minCH} {t('courseReg.chRequired')}</div>
          )}
          {totalCH > maxCH && (
            <div className={styles.chError}><AlertTriangle size={12} /> {t('courseReg.max')} {maxCH} {t('courseReg.chExceeded')}</div>
          )}
        </div>
      </div>

      {/* Conflict alert banner */}
      {hasConflicts && (
        <div className={styles.conflictBanner}>
          <AlertCircle size={16} />
          <span>
            <strong>{t('courseReg.conflictWarning')}</strong>{' '}
            {conflictPairs.map((p, i) => {
              const a = offerings.find(o => o.id === p.a)
              const b = offerings.find(o => o.id === p.b)
              return (
                <span key={i}>
                  {a?.course.code} {t('courseReg.conflictWith')} {b?.course.code} {t('courseReg.conflictAt')} {a?.dayOfWeek} {a?.startTime}–{a?.endTime}
                </span>
              )
            })}
            {t('courseReg.conflictRemove')}
          </span>
        </div>
      )}

      {selected.length > 0 && (
        <div className={styles.floatingBar}>
          <span>{selected.length} {selected.length > 1 ? t('courseReg.coursesSelected') : t('courseReg.courseSelected')} · {totalCH} {t('courseReg.ch')}
            {hasConflicts && <span className={styles.conflictBadge}> ⚠ {t('courseReg.conflict')}</span>}
          </span>
          <div className={styles.barActions}>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>{t('courseReg.clear')}</Button>
            <Button
              size="sm"
              disabled={totalCH < minCH || totalCH > maxCH || hasConflicts}
              onClick={() => setConfirmModal(true)}
            >
              {t('courseReg.registerSelected')}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.courseGrid}>
        {isLoading ? (
          <div className={styles.loading}>{t('courseReg.loading')}</div>
        ) : (
          offerings.map(offering => {
            const isSelected = selected.includes(offering.id)
            const isConflicting = isSelected && conflictingIds.has(offering.id)
            const seats = offering.seatsTaken ?? 0
            const maxSeats = offering.course?.maxSeats ?? 30
            const seatsLeft = maxSeats - seats
            const prereqs = offering.course?.prerequisites ?? []

            return (
              <div
                key={offering.id}
                className={`${styles.courseCard} ${isSelected ? styles.selectedCard : ''} ${isConflicting ? styles.conflictCard : ''}`}
                onClick={() => toggle(offering.id)}
              >
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.courseCode}>{offering.course?.code}</div>
                    <div className={styles.courseName}>{offering.course?.name}</div>
                  </div>
                  <div className={`${styles.selectToggle} ${isSelected ? (isConflicting ? styles.conflict : styles.selected) : ''}`}>
                    {isSelected ? <Minus size={16} /> : <Plus size={16} />}
                  </div>
                </div>
                <div className={styles.cardMeta}>
                  <span><BookOpen size={12} /> {offering.course?.creditHours} {t('courseReg.ch')}</span>
                  <span><Clock size={12} /> {offering.dayOfWeek} {offering.startTime}–{offering.endTime}</span>
                </div>
                <div className={styles.cardMeta}>
                  <span>📍 {offering.room}</span>
                  <span>👤 {offering.lecturer?.user?.displayName ?? 'TBA'}</span>
                </div>
                {prereqs.length > 0 && (
                  <div className={styles.prereqLine}>
                    <span>{t('courseReg.prerequisites')} {prereqs.map(p => p.prerequisite.code).join(', ')}</span>
                  </div>
                )}
                <div className={styles.cardFooter}>
                  <Badge color={getAvailabilityColor(seats, maxSeats)} size="sm">
                    {seatsLeft > 0 ? `${seatsLeft} ${t('courseReg.seatsLeft')}` : t('courseReg.full')}
                  </Badge>
                  <Badge color="gray" size="sm">Level {offering.course?.level}</Badge>
                  {isConflicting && <Badge color="red" size="sm">⚠ {t('courseReg.conflict')}</Badge>}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Confirm Modal */}
      <Modal
        open={confirmModal}
        title={t('courseReg.confirmTitle')}
        onClose={() => setConfirmModal(false)}
        okText={t('common.confirm')}
        onOk={() => registerMutation.mutate(selected)}
        okLoading={registerMutation.isPending}
      >
        <p className={styles.confirmText}>
          {t('courseReg.confirmRegistering')} {selectedOfferings.length} {selectedOfferings.length > 1 ? t('courseReg.coursesSelected') : t('courseReg.courseSelected')} ({totalCH} {t('courseReg.chTotal')}):
        </p>
        <div className={styles.confirmList}>
          {selectedOfferings.map(o => (
            <div key={o.id} className={styles.confirmItem}>
              <span>{o.course?.code} – {o.course?.name}</span>
              <span className={styles.confirmCH}>{o.course?.creditHours} {t('courseReg.ch')}</span>
            </div>
          ))}
        </div>
        <p className={styles.confirmNote}>{t('courseReg.syncNote')}</p>
      </Modal>
    </div>
  )
}

// Demo fallback
const DEMO_OFFERINGS: Offering[] = [
  { id: 'off-1', dayOfWeek: 'Monday', startTime: '09:00', endTime: '11:00', room: 'Lab 3', seatsTaken: 18,
    course: { id: 'c1', name: 'Introduction to Programming', code: 'IFN101', creditHours: 3, level: 1, maxSeats: 30, prerequisites: [] },
    lecturer: { user: { displayName: 'Dr. Siti Aminah' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-2', dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '11:00', room: 'Lab 3', seatsTaken: 25,
    course: { id: 'c2', name: 'Data Structures & Algorithms', code: 'IFN102', creditHours: 3, level: 2, maxSeats: 30,
      prerequisites: [{ prerequisite: { id: 'c1', code: 'IFN101', name: 'Intro to Programming' }, minGrade: 'D' }] },
    lecturer: { user: { displayName: 'Dr. Siti Aminah' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-3', dayOfWeek: 'Tuesday', startTime: '14:00', endTime: '16:00', room: 'Lecture Hall A', seatsTaken: 12,
    course: { id: 'c3', name: 'Database Systems', code: 'IFN201', creditHours: 3, level: 2, maxSeats: 40, prerequisites: [] },
    lecturer: { user: { displayName: 'Dr. Siti Aminah' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-4', dayOfWeek: 'Thursday', startTime: '10:00', endTime: '12:00', room: 'Lecture Hall B', seatsTaken: 8,
    course: { id: 'c4', name: 'Arabic Language I', code: 'ARA101', creditHours: 3, level: 1, maxSeats: 35, prerequisites: [] },
    lecturer: { user: { displayName: 'Dr. Ahmad Fadzil' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
  { id: 'off-5', dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '11:00', room: 'Lecture Hall B', seatsTaken: 5,
    course: { id: 'c5', name: 'Arabic Language II', code: 'ARA102', creditHours: 3, level: 1, maxSeats: 35,
      prerequisites: [{ prerequisite: { id: 'c4', code: 'ARA101', name: 'Arabic Language I' }, minGrade: 'D' }] },
    lecturer: { user: { displayName: 'Dr. Ahmad Fadzil' } }, semester: { id: 'sem-1', name: 'Sep 2026' } },
]

export default CourseRegistrationPage
