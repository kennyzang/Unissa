import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, Users, CheckCircle, Clock, BookOpen, ChevronDown,
  ChevronUp, RefreshCw, X, UserCheck, AlertTriangle, Calendar,
  Copy, Check, FileText, Upload as UploadIcon, Eye,
} from 'lucide-react'
import { QRCode, Select, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import styles from './AttendancePage.module.scss'

const { Option } = Select

// ─── Clipboard fallback (works on HTTP / non-secure contexts) ─────────────────
function fallbackCopy(text: string, onDone: () => void) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  try { document.execCommand('copy'); onDone() } catch {}
  document.body.removeChild(el)
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionMaterial {
  filename: string
  path: string
  size: number
  mimetype: string
  uploadedAt: string
}

interface AttendanceSession {
  id: string
  offeringId: string
  sessionToken: string
  qrExpiresAt: string
  startedAt: string
  endedAt: string | null
  name: string | null
  description: string | null
  materials: SessionMaterial[]
  qrData?: string
  records?: { id: string; status: string; scannedAt: string; studentId: string }[]
}

interface OfferingWithCount {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  course: { name: string; code: string }
  _count: { enrolments: number; attendanceSessions: number }
}

interface AttendanceSummaryRow {
  studentId: string
  name: string
  present: number
  total: number
  attendancePct: number
}

interface StudentCourseSummary {
  offeringId: string
  courseName: string
  courseCode: string
  present: number
  total: number
  attendancePct: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pctColor = (pct: number): 'green' | 'orange' | 'red' =>
  pct >= 80 ? 'green' : pct >= 60 ? 'orange' : 'red'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })

const fmtBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Create Session Modal ─────────────────────────────────────────────────────
const CreateSessionModal: React.FC<{
  offeringId: string
  offeringLabel: string
  onCreated: (session: AttendanceSession) => void
  onClose: () => void
}> = ({ offeringId, offeringLabel, onCreated, onClose }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore(s => s.addToast)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) { setError(t('attendance.nameRequired')); return }
    if (trimmedName.length > 100) { setError(t('attendance.nameTooLong')); return }
    setCreating(true)
    setError('')
    try {
      const res = await apiClient.post('/lms/attendance/sessions', {
        offeringId,
        name: trimmedName,
        description: description.trim() || undefined,
      })
      let session: AttendanceSession = res.data.data

      if (files.length > 0) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        try {
          const matRes = await apiClient.post(
            `/lms/attendance/sessions/${session.id}/materials`,
            fd,
            { headers: { 'Content-Type': 'multipart/form-data' } },
          )
          session = matRes.data.data
        } catch {
          addToast({ type: 'warning', message: t('attendance.materialsUploadWarning', { defaultValue: 'Session created, but materials could not be uploaded. You can add them later.' }) })
        }
      }

      queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions'] })
      onCreated({ ...session, qrData: session.sessionToken })
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.message ?? t('attendance.createError'))
    } finally {
      setCreating(false)
    }
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const oversized = selected.filter(f => f.size > 50 * 1024 * 1024)
    if (oversized.length > 0) {
      setError(t('attendance.fileTooLarge'))
      return
    }
    setError('')
    setFiles(selected)
  }

  return (
    <Modal
      open
      title={t('attendance.createSessionTitle')}
      onClose={onClose}
      footer={null}
      width={560}
    >
      <div className={styles.createForm}>
        <p className={styles.createFormSub}>{offeringLabel}</p>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>
            {t('attendance.sessionName')} <span className={styles.required}>*</span>
          </label>
          <input
            className={styles.fieldInput}
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder={t('attendance.sessionNamePlaceholder')}
            maxLength={100}
            autoFocus
          />
          <span className={styles.fieldHint}>
            {name.length}/100 · {t('attendance.sessionNameHint')}
          </span>
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>{t('attendance.sessionDescription')}</label>
          <textarea
            className={styles.fieldTextarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('attendance.sessionDescriptionPlaceholder')}
            rows={3}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>{t('attendance.uploadMaterials')}</label>
          <Upload
            name="files"
            multiple
            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.zip,.png,.jpg,.jpeg"
            showUploadList={false}
            beforeUpload={(file, fileList) => {
              const oversized = fileList.filter(f => f.size > 50 * 1024 * 1024)
              if (oversized.length > 0) {
                setError(t('attendance.fileTooLarge'))
                return false
              }
              setError('')
              setFiles(fileList.map(f => f.originFileObj!))
              return false
            }}
            className={styles.fileDropZone}
          >
            <div className={styles.fileDropContent}>
              <UploadOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <span className={styles.fileDropText}>
                {files.length > 0
                  ? t('attendance.filesSelected', { count: files.length })
                  : t('attendance.uploadBtn')}
              </span>
              <span className={styles.fileHint}>{t('attendance.uploadMaterialsHint')}</span>
            </div>
          </Upload>
          {files.length > 0 && (
            <ul className={styles.filePreviewList}>
              {files.map((f, i) => (
                <li key={i} className={styles.filePreviewItem}>
                  <FileText size={13} />
                  <span className={styles.filePreviewName}>{f.name}</span>
                  <span className={styles.filePreviewSize}>{fmtBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className={styles.formError}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className={styles.formFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={creating}>
            {t('common.cancel')}
          </button>
          <button
            className={styles.createBtn}
            onClick={handleCreate}
            disabled={creating || !name.trim()}
          >
            <QrCode size={14} />
            {creating ? t('attendance.starting') : t('attendance.createSession')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Session Details Modal ────────────────────────────────────────────────────
const SessionDetailsModal: React.FC<{
  session: AttendanceSession
  onClose: () => void
}> = ({ session, onClose }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const token = session.qrData ?? session.sessionToken
  const expired = new Date(session.qrExpiresAt) < new Date()
  const presentCount = session.records?.filter(r => r.status === 'present').length ?? 0

  const handleCopy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2500) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(done).catch(() => fallbackCopy(token, done))
    } else {
      fallbackCopy(token, done)
    }
  }

  return (
    <Modal
      open
      title={session.name ?? t('attendance.sessionDetails')}
      onClose={onClose}
      footer={null}
      width={580}
    >
      <div className={styles.detailsModal}>
        <div className={styles.detailsMeta}>
          <span className={styles.detailsDate}>
            <Calendar size={13} /> {fmtDate(session.startedAt)} · {fmtTime(session.startedAt)}
            {session.endedAt ? ` – ${fmtTime(session.endedAt)}` : ''}
          </span>
          <Badge color={session.endedAt ? 'gray' : expired ? 'orange' : 'green'} size="sm">
            {session.endedAt
              ? t('attendance.closed')
              : expired
              ? t('attendance.expired')
              : t('attendance.open')}
          </Badge>
        </div>

        {session.description && (
          <p className={styles.detailsDesc}>{session.description}</p>
        )}

        <div className={styles.detailsQrRow}>
          <div className={styles.qrWrapper}>
            {expired || session.endedAt
              ? (
                <div className={styles.qrExpired}>
                  <Clock size={28} />
                  <span>{t('attendance.qrExpired')}</span>
                </div>
              )
              : <QRCode value={token} size={160} />
            }
            <p className={styles.qrHint}>{t('attendance.qrHint')}</p>
          </div>

          <div className={styles.detailsRight}>
            <div className={styles.tokenSection}>
              <div className={styles.tokenLabel}>
                <QrCode size={13} /> {t('attendance.sessionToken')}
              </div>
              <div className={styles.tokenBox}>
                <span className={styles.tokenText}>{token}</span>
                <button
                  className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
                  onClick={handleCopy}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? t('attendance.copied') : t('attendance.copyToken')}
                </button>
              </div>
              <p className={styles.tokenNote}>{t('attendance.tokenNote')}</p>
            </div>

            <div className={styles.detailsAttendance}>
              <UserCheck size={18} />
              <span className={styles.detailsAttendanceNum}>{presentCount}</span>
              <span className={styles.detailsAttendanceLabel}>{t('attendance.present')}</span>
            </div>
          </div>
        </div>

        {session.materials && session.materials.length > 0 && (
          <div className={styles.materialsSection}>
            <h4 className={styles.materialsSectionTitle}>
              <FileText size={14} /> {t('attendance.materialsSection')}
            </h4>
            <ul className={styles.materialsList}>
              {session.materials.map((m, i) => (
                <li key={i} className={styles.materialItem}>
                  <FileText size={13} />
                  <span className={styles.materialName}>{m.filename}</span>
                  <span className={styles.materialSize}>{fmtBytes(m.size)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── QR Session Panel (Lecturer active session) ───────────────────────────────
const ActiveSessionPanel: React.FC<{
  session: AttendanceSession
  onClose: () => void
}> = ({ session, onClose }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [liveCount, setLiveCount] = useState(session.records?.length ?? 0)
  const [copied, setCopied] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expired = new Date(session.qrExpiresAt) < new Date()
  const token = session.qrData ?? session.sessionToken

  const closeMutation = useMutation({
    mutationFn: () => apiClient.patch(`/lms/attendance/sessions/${session.id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions'] })
      onClose()
    },
  })

  useEffect(() => {
    if (expired || session.endedAt) return
    const fetch = async () => {
      try {
        const { data } = await apiClient.get(`/lms/attendance/live-count/${session.id}`)
        setLiveCount(data.data.count)
      } catch {}
    }
    fetch()
    intervalRef.current = setInterval(fetch, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [session.id, expired, session.endedAt])

  const handleCopy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2500) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(done).catch(() => fallbackCopy(token, done))
    } else {
      fallbackCopy(token, done)
    }
  }

  return (
    <div className={styles.activePanel}>
      <div className={styles.activePanelHeader}>
        <div>
          <h3 className={styles.activePanelTitle}>
            {session.name ?? t('attendance.activeSession')}
          </h3>
          <span className={styles.activePanelSub}>
            {t('attendance.started')}: {fmtTime(session.startedAt)} &nbsp;·&nbsp;
            {expired
              ? <span className={styles.expiredText}>{t('attendance.expired')}</span>
              : <span className={styles.activeText}>{t('attendance.expiresAt')} {fmtTime(session.qrExpiresAt)}</span>
            }
          </span>
          {session.description && (
            <p className={styles.activePanelDesc}>{session.description}</p>
          )}
        </div>
        <button
          className={styles.closeSessionBtn}
          onClick={() => closeMutation.mutate()}
          disabled={closeMutation.isPending}
        >
          <X size={14} /> {t('attendance.closeSession')}
        </button>
      </div>

      <div className={styles.activePanelBody}>
        <div className={styles.qrWrapper}>
          {expired
            ? <div className={styles.qrExpired}><Clock size={32} /><span>{t('attendance.qrExpired')}</span></div>
            : <QRCode value={token} size={180} />
          }
          <p className={styles.qrHint}>{t('attendance.qrHint')}</p>
        </div>

        <div className={styles.tokenSection}>
          <div className={styles.tokenLabel}>
            <QrCode size={14} />
            {t('attendance.sessionToken')}
          </div>
          <div className={styles.tokenBox}>
            <span className={styles.tokenText}>{token}</span>
            <button
              className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
              onClick={handleCopy}
              title={t('attendance.copyToken')}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('attendance.copied') : t('attendance.copyToken')}
            </button>
          </div>
          <p className={styles.tokenNote}>{t('attendance.tokenNote')}</p>
        </div>

        <div className={styles.liveStats}>
          <div className={styles.liveCount}>
            <UserCheck size={28} />
            <span className={styles.liveCountNum}>{liveCount}</span>
            <span className={styles.liveCountLabel}>{t('attendance.present')}</span>
          </div>
          {!expired && !session.endedAt && (
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              {t('attendance.liveUpdating')}
            </div>
          )}
        </div>
      </div>

      {session.materials && session.materials.length > 0 && (
        <div className={styles.activePanelMaterials}>
          <span className={styles.materialsInlineLabel}>
            <FileText size={13} /> {t('attendance.materialsSection')}:
          </span>
          {session.materials.map((m, i) => (
            <span key={i} className={styles.materialChip}>{m.filename}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Lecturer View ────────────────────────────────────────────────────────────
const LecturerView: React.FC<{ lecturerId: string }> = ({ lecturerId }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)
  const [expandedOffering, setExpandedOffering] = useState<string | null>(null)
  const [createModalOfferingId, setCreateModalOfferingId] = useState<string | null>(null)
  const [viewingSession, setViewingSession] = useState<AttendanceSession | null>(null)

  const { data: offerings = [], isLoading: loadingOfferings } = useQuery<OfferingWithCount[]>({
    queryKey: ['attendance', 'offerings', lecturerId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/offerings/lecturer/${lecturerId}`)
      return data.data
    },
  })

  const { data: sessionData } = useQuery<AttendanceSession[]>({
    queryKey: ['attendance', 'sessions', expandedOffering],
    queryFn: async () => {
      if (!expandedOffering) return []
      const { data } = await apiClient.get(`/lms/attendance/sessions/offering/${expandedOffering}`)
      return data.data
    },
    enabled: !!expandedOffering,
  })

  const createModalOffering = createModalOfferingId
    ? offerings.find(o => o.id === createModalOfferingId)
    : null

  if (loadingOfferings) return <div className={styles.loading}>{t('attendance.loading')}</div>

  if (offerings.length === 0) {
    return (
      <div className={styles.emptyState}>
        <BookOpen size={36} />
        <p>{t('attendance.noOfferings')}</p>
      </div>
    )
  }

  return (
    <div className={styles.lecturerView}>
      {activeSession && (
        <ActiveSessionPanel
          session={activeSession}
          onClose={() => setActiveSession(null)}
        />
      )}

      {createModalOffering && (
        <CreateSessionModal
          offeringId={createModalOffering.id}
          offeringLabel={`${createModalOffering.course.code} — ${createModalOffering.course.name}`}
          onCreated={sess => setActiveSession(sess)}
          onClose={() => setCreateModalOfferingId(null)}
        />
      )}

      {viewingSession && (
        <SessionDetailsModal
          session={viewingSession}
          onClose={() => setViewingSession(null)}
        />
      )}

      <div className={styles.offeringList}>
        {offerings.map(off => {
          const isExpanded = expandedOffering === off.id
          return (
            <div key={off.id} className={styles.offeringCard}>
              <div className={styles.offeringCardHeader}>
                <div className={styles.offeringInfo}>
                  <span className={styles.offeringCode}>{off.course.code}</span>
                  <span className={styles.offeringName}>{off.course.name}</span>
                  <span className={styles.offeringMeta}>
                    {off.dayOfWeek} · {off.startTime}–{off.endTime} · {off.room}
                  </span>
                </div>
                <div className={styles.offeringActions}>
                  <div className={styles.offeringStats}>
                    <Badge color="blue" size="sm">
                      <Users size={11} /> {off._count.enrolments} {t('attendance.enrolled')}
                    </Badge>
                    <Badge color="gray" size="sm">
                      <Calendar size={11} /> {off._count.attendanceSessions} {t('attendance.sessions')}
                    </Badge>
                  </div>
                  <button
                    className={styles.startBtn}
                    onClick={() => setCreateModalOfferingId(off.id)}
                  >
                    <QrCode size={14} />
                    {t('attendance.startNewSession')}
                  </button>
                  <button
                    className={styles.expandBtn}
                    onClick={() => setExpandedOffering(isExpanded ? null : off.id)}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.sessionHistory}>
                  <h4 className={styles.historyTitle}>{t('attendance.sessionHistory')}</h4>
                  {!sessionData || sessionData.length === 0
                    ? <p className={styles.noHistory}>{t('attendance.noSessions')}</p>
                    : sessionData.map(sess => {
                        const count = sess.records?.filter(r => r.status === 'present').length ?? 0
                        const isExpired = new Date(sess.qrExpiresAt) < new Date()
                        return (
                          <div key={sess.id} className={styles.sessionRow}>
                            <div className={styles.sessionRowLeft}>
                              <span className={styles.sessionName}>
                                {sess.name ?? `${t('attendance.session')} — ${fmtDate(sess.startedAt)}`}
                              </span>
                              <span className={styles.sessionTime}>
                                {fmtDate(sess.startedAt)} · {fmtTime(sess.startedAt)}
                                {sess.endedAt ? ` – ${fmtTime(sess.endedAt)}` : ''}
                              </span>
                            </div>
                            <div className={styles.sessionRowRight}>
                              <Badge color="green" size="sm">
                                <CheckCircle size={10} /> {count} {t('attendance.present')}
                              </Badge>
                              <Badge color={isExpired || sess.endedAt ? 'gray' : 'orange'} size="sm">
                                {sess.endedAt
                                  ? t('attendance.closed')
                                  : isExpired
                                  ? t('attendance.expired')
                                  : t('attendance.open')}
                              </Badge>
                              <button
                                className={styles.viewDetailsBtn}
                                onClick={() => setViewingSession(sess)}
                                title={t('attendance.viewDetails')}
                              >
                                <Eye size={13} /> {t('attendance.viewDetails')}
                              </button>
                            </div>
                          </div>
                        )
                      })
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Student View ─────────────────────────────────────────────────────────────
const StudentView: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { t } = useTranslation()
  const [token, setToken] = useState('')
  const [checkinMsg, setCheckinMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<{
    summary: StudentCourseSummary[]
    records: any[]
  }>({
    queryKey: ['attendance', 'student', studentId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/records/student/${studentId}`)
      return data.data
    },
  })

  const checkinMutation = useMutation({
    mutationFn: () => apiClient.post('/lms/attendance/check-in', { token, studentId }),
    onSuccess: (res) => {
      setCheckinMsg({ ok: true, text: res.data.message ?? t('attendance.checkinSuccess') })
      setToken('')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'student', studentId] })
      setTimeout(() => setCheckinMsg(null), 4000)
    },
    onError: (err: any) => {
      setCheckinMsg({ ok: false, text: err.response?.data?.message ?? t('attendance.checkinError') })
      setTimeout(() => setCheckinMsg(null), 4000)
    },
  })

  if (isLoading) return <div className={styles.loading}>{t('attendance.loading')}</div>

  const summary = data?.summary ?? []

  return (
    <div className={styles.studentView}>
      {/* Manual token check-in */}
      <div className={styles.checkinCard}>
        <h3 className={styles.checkinTitle}>
          <QrCode size={18} /> {t('attendance.manualCheckin')}
        </h3>
        <p className={styles.checkinHint}>{t('attendance.manualCheckinHint')}</p>
        <div className={styles.checkinRow}>
          <input
            className={styles.tokenInput}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={t('attendance.tokenPlaceholder')}
          />
          <button
            className={styles.checkinBtn}
            onClick={() => checkinMutation.mutate()}
            disabled={!token.trim() || checkinMutation.isPending}
          >
            <CheckCircle size={14} />
            {checkinMutation.isPending ? t('attendance.checking') : t('attendance.checkIn')}
          </button>
        </div>
        {checkinMsg && (
          <div className={`${styles.checkinMsg} ${checkinMsg.ok ? styles.checkinMsgOk : styles.checkinMsgErr}`}>
            {checkinMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {checkinMsg.text}
          </div>
        )}
      </div>

      {/* Per-course summary */}
      <div className={styles.summaryGrid}>
        {summary.length === 0
          ? (
            <div className={styles.emptyState}>
              <Calendar size={36} />
              <p>{t('attendance.noRecords')}</p>
            </div>
          )
          : summary.map(s => (
            <div key={s.offeringId} className={styles.summaryCard}>
              <div className={styles.summaryCardTop}>
                <span className={styles.summaryCode}>{s.courseCode}</span>
                <Badge color={pctColor(s.attendancePct)}>
                  {s.attendancePct}%
                </Badge>
              </div>
              <div className={styles.summaryCourseName}>{s.courseName}</div>
              <div className={styles.summaryBar}>
                <div
                  className={styles.summaryBarFill}
                  style={{
                    width: `${s.attendancePct}%`,
                    background: s.attendancePct >= 80 ? 'var(--color-success)' : s.attendancePct >= 60 ? '#f59e0b' : 'var(--color-danger)',
                  }}
                />
              </div>
              <div className={styles.summaryMeta}>
                <span><CheckCircle size={12} /> {s.present} / {s.total} {t('attendance.sessions')}</span>
                {s.attendancePct < 80 && (
                  <span className={styles.warningText}>
                    <AlertTriangle size={12} /> {t('attendance.belowThreshold')}
                  </span>
                )}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── Admin View ───────────────────────────────────────────────────────────────
const AdminView: React.FC = () => {
  const { t } = useTranslation()
  const [selectedOffering, setSelectedOffering] = useState<string | null>(null)

  const { data: offerings = [], isLoading: loadingOfferings } = useQuery<OfferingWithCount[]>({
    queryKey: ['attendance', 'all-offerings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lms/attendance/offerings/lecturer/all')
      return data.data
    },
  })

  // Auto-select the first offering when the list loads
  useEffect(() => {
    if (offerings.length > 0 && selectedOffering === null) {
      setSelectedOffering(offerings[0].id)
    }
  }, [offerings, selectedOffering])

  const { data: report, isFetching: loadingReport } = useQuery<{ summary: AttendanceSummaryRow[]; sessions: AttendanceSession[] }>({
    queryKey: ['attendance', 'report', selectedOffering],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lms/attendance/records/offering/${selectedOffering}`)
      return data.data
    },
    enabled: !!selectedOffering,
  })

  if (loadingOfferings) return <div className={styles.loading}>{t('attendance.loading')}</div>

  const avgPct = report && report.summary.length > 0
    ? Math.round(report.summary.reduce((s, r) => s + r.attendancePct, 0) / report.summary.length)
    : 0
  const totalPresent = report ? report.summary.reduce((s, r) => s + r.present, 0) : 0
  const totalSessions = report ? report.sessions.length : 0

  return (
    <div className={styles.adminView}>
      <div className={styles.adminFilterArea}>
        <div className={styles.adminOfferingSelect}>
          <label className={styles.selectLabel}>{t('attendance.selectCourse')}</label>
          <Select
            className={styles.courseSelect}
            value={selectedOffering}
            onChange={value => setSelectedOffering(value || null)}
          >
            {offerings.map(o => (
              <Option key={o.id} value={o.id}>
                {o.course.code} – {o.course.name}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      <div className={styles.reportDivider}>
        <span>{t('attendance.attendanceData')}</span>
      </div>

      {loadingReport && (
        <div className={styles.loading}><RefreshCw size={16} /> {t('attendance.loading')}</div>
      )}

      {!loadingReport && report && (
        <div className={styles.reportSection}>
          <div className={styles.reportStats}>
            <div className={styles.reportStat}>
              <span>{totalSessions}</span>
              <label>{t('attendance.totalSessions')}</label>
            </div>
            <div className={styles.reportStat}>
              <span>{report.summary.length}</span>
              <label>{t('attendance.studentsTracked')}</label>
            </div>
            <div className={styles.reportStat}>
              <span>{avgPct}%</span>
              <label>{t('attendance.avgAttendance')}</label>
            </div>
          </div>

          <div className={styles.reportTable}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('attendance.student')}</th>
                  <th className={styles.centerCol}>{t('attendance.present')}</th>
                  <th className={styles.centerCol}>{t('attendance.totalSessions')}</th>
                  <th className={styles.centerCol}>{t('attendance.rate')}</th>
                  <th className={styles.centerCol}>{t('attendance.status')}</th>
                </tr>
              </thead>
              <tbody>
                {report.summary.map((row, idx) => (
                  <tr key={row.studentId} className={idx % 2 === 1 ? styles.rowEven : undefined}>
                    <td>{row.name}</td>
                    <td className={styles.centerCol}>{row.present}</td>
                    <td className={styles.centerCol}>{row.total}</td>
                    <td className={styles.centerCol}>
                      <div className={styles.tableBarWrap}>
                        <div className={styles.tableBar}>
                          <div
                            className={styles.tableBarFill}
                            style={{
                              width: `${row.attendancePct}%`,
                              background: row.attendancePct >= 80 ? 'var(--color-success)' : row.attendancePct >= 60 ? '#f59e0b' : 'var(--color-danger)',
                            }}
                          />
                        </div>
                        <span>{row.attendancePct}%</span>
                      </div>
                    </td>
                    <td className={styles.centerCol}>
                      <Badge color={pctColor(row.attendancePct)} size="sm">
                        {row.attendancePct >= 80
                          ? t('attendance.good')
                          : row.attendancePct >= 60
                          ? t('attendance.warning')
                          : t('attendance.critical')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.summaryFooter}>
                  <td><strong>{t('attendance.summary')}</strong></td>
                  <td className={styles.centerCol}><strong>{totalPresent}</strong></td>
                  <td className={styles.centerCol}>—</td>
                  <td className={styles.centerCol}>
                    <div className={styles.tableBarWrap}>
                      <div className={styles.tableBar}>
                        <div
                          className={styles.tableBarFill}
                          style={{
                            width: `${avgPct}%`,
                            background: avgPct >= 80 ? 'var(--color-success)' : avgPct >= 60 ? '#f59e0b' : 'var(--color-danger)',
                          }}
                        />
                      </div>
                      <strong>{avgPct}%</strong>
                    </div>
                  </td>
                  <td className={styles.centerCol}>
                    <Badge color={pctColor(avgPct)} size="sm">
                      {avgPct >= 80
                        ? t('attendance.good')
                        : avgPct >= 60
                        ? t('attendance.warning')
                        : t('attendance.critical')}
                    </Badge>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const AttendancePage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const hasRole = useAuthStore(s => s.hasRole)

  const { data: studentProfile } = useQuery({
    queryKey: ['student', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/me')
      return data.data
    },
    enabled: !!user && hasRole('student'),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('attendance.title')}</h1>
          <p className={styles.pageSub}>
            {hasRole('lecturer')
              ? t('attendance.subLecturer')
              : hasRole('student')
              ? t('attendance.subStudent')
              : t('attendance.subAdmin')}
          </p>
        </div>
      </div>

      {hasRole('lecturer') && user?.id && (
        <LecturerView lecturerId={user.id} />
      )}
      {hasRole('student') && studentProfile?.id && (
        <StudentView studentId={studentProfile.id} />
      )}
      {hasRole('admin') && (
        <AdminView />
      )}
    </div>
  )
}

export default AttendancePage
