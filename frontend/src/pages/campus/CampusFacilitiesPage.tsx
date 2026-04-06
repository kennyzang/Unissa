import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, CalendarCheck, Wrench, Plus, CheckCircle, XCircle, Clock } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import styles from './CampusFacilitiesPage.module.scss'

// ── Types ──────────────────────────────────────────────────────
interface Facility {
  id: string
  code: string
  name: string
  type: string
  capacity: number
  building: string
  floor?: string
  isAvailable: boolean
  features?: string
  todayStatus: 'available' | 'booked' | 'maintenance'
  _count: { bookings: number; maintenanceTickets: number }
}

interface Booking {
  id: string
  facilityId: string
  bookingDate: string
  startTime: string
  endTime: string
  purpose: string
  status: string
  facility: { name: string; type: string; building: string }
  booker: { id: string; displayName: string; role: string }
  department?: { name: string } | null
}

interface MaintenanceTicket {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  createdAt: string
  resolvedAt?: string
  facility: { name: string; building: string }
  reporter: { displayName: string }
  assignee?: { displayName: string } | null
}

interface Overview {
  totalFacilities: number
  bookedToday: number
  availableNow: number
  openMaintenanceTickets: number
  pendingBookings: number
}

// ── Helpers ────────────────────────────────────────────────────
const FACILITY_TYPE_LABEL: Record<string, string> = {
  lecture_hall: 'Lecture Hall',
  lab:          'Laboratory',
  meeting_room: 'Meeting Room',
  office:       'Office',
  sports:       'Sports Hall',
  facility:     'Facility',
}

const TODAY_STATUS_COLOR: Record<string, 'green' | 'orange' | 'red'> = {
  available:   'green',
  booked:      'orange',
  maintenance: 'red',
}

const PRIORITY_COLOR: Record<string, 'red' | 'orange' | 'blue' | 'gray'> = {
  high:   'red',
  medium: 'orange',
  low:    'blue',
}

const BOOKING_STATUS_COLOR: Record<string, 'green' | 'orange' | 'red' | 'gray'> = {
  confirmed: 'green',
  pending:   'orange',
  rejected:  'red',
  cancelled: 'gray',
}

const TICKET_STATUS_COLOR: Record<string, 'red' | 'orange' | 'green' | 'gray'> = {
  open:        'red',
  in_progress: 'orange',
  resolved:    'green',
  closed:      'gray',
}

type TabKey = 'facilities' | 'bookings' | 'maintenance'

// ── Main Component ─────────────────────────────────────────────
export default function CampusFacilitiesPage() {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const addToast = useUIStore(s => s.addToast)
  const queryClient = useQueryClient()
  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const [activeTab, setActiveTab] = useState<TabKey>('facilities')
  const [bookingModal, setBookingModal] = useState(false)
  const [maintenanceModal, setMaintenanceModal] = useState(false)

  // Booking form state
  const [bookForm, setBookForm] = useState({
    facilityId: '',
    bookingDate: new Date().toISOString().slice(0, 10),
    startTime: '08:00',
    endTime: '10:00',
    purpose: '',
  })
  const [bookError, setBookError] = useState('')

  // Maintenance form state
  const [maintForm, setMaintForm] = useState({ facilityId: '', title: '', description: '', priority: 'medium' })
  const [maintError, setMaintError] = useState('')

  // ── Queries ──────────────────────────────────────────────────
  const { data: overview } = useQuery<Overview>({
    queryKey: ['campus', 'overview'],
    queryFn: async () => {
      const { data } = await apiClient.get('/campus/overview')
      return data.data
    },
    refetchInterval: 30_000,
  })

  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery<Facility[]>({
    queryKey: ['campus', 'facilities'],
    queryFn: async () => {
      const { data } = await apiClient.get('/campus/facilities')
      return data.data
    },
  })

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['campus', 'bookings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/campus/bookings')
      return data.data
    },
    enabled: activeTab === 'bookings',
  })

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<MaintenanceTicket[]>({
    queryKey: ['campus', 'maintenance'],
    queryFn: async () => {
      const { data } = await apiClient.get('/campus/maintenance')
      return data.data
    },
    enabled: activeTab === 'maintenance',
  })

  // ── Mutations ────────────────────────────────────────────────
  const bookMutation = useMutation({
    mutationFn: () => apiClient.post('/campus/bookings', bookForm),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Booking request submitted successfully' })
      setBookingModal(false)
      setBookForm({ facilityId: '', bookingDate: new Date().toISOString().slice(0, 10), startTime: '08:00', endTime: '10:00', purpose: '' })
      setBookError('')
      queryClient.invalidateQueries({ queryKey: ['campus'] })
    },
    onError: (e: any) => setBookError(e.response?.data?.message ?? 'Failed to submit booking'),
  })

  const maintMutation = useMutation({
    mutationFn: () => apiClient.post('/campus/maintenance', maintForm),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Maintenance ticket submitted' })
      setMaintenanceModal(false)
      setMaintForm({ facilityId: '', title: '', description: '', priority: 'medium' })
      setMaintError('')
      queryClient.invalidateQueries({ queryKey: ['campus'] })
    },
    onError: (e: any) => setMaintError(e.response?.data?.message ?? 'Failed to submit ticket'),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      apiClient.patch(`/campus/bookings/${id}/approve`, { action }),
    onSuccess: (_, vars) => {
      addToast({ type: 'success', message: `Booking ${vars.action === 'approve' ? 'approved' : 'rejected'}` })
      queryClient.invalidateQueries({ queryKey: ['campus'] })
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Action failed' }),
  })

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/campus/maintenance/${id}`, { status }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Ticket updated' })
      queryClient.invalidateQueries({ queryKey: ['campus'] })
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Update failed' }),
  })

  // ── Render helpers ───────────────────────────────────────────
  const renderOverview = () => (
    <div className={styles.overviewGrid}>
      {[
        { label: 'Total Facilities', value: overview?.totalFacilities ?? '—', icon: <Building2 size={18} />, color: '#165DFF' },
        { label: 'Booked Today',     value: overview?.bookedToday ?? '—',     icon: <CalendarCheck size={18} />, color: '#FF7D00' },
        { label: 'Available Now',    value: overview?.availableNow ?? '—',    icon: <CheckCircle size={18} />, color: '#00B42A' },
        { label: 'Open Maintenance', value: overview?.openMaintenanceTickets ?? '—', icon: <Wrench size={18} />, color: '#F53F3F' },
      ].map(item => (
        <div key={item.label} className={styles.overviewCard} style={{ '--accent': item.color } as React.CSSProperties}>
          <div className={styles.overviewIcon} style={{ background: `${item.color}18`, color: item.color }}>
            {item.icon}
          </div>
          <div className={styles.overviewVal} style={{ color: item.color }}>{item.value}</div>
          <div className={styles.overviewLabel}>{item.label}</div>
        </div>
      ))}
    </div>
  )

  const renderFacilitiesTab = () => (
    <div className={styles.tableWrap}>
      {facilitiesLoading ? (
        <div className={styles.loading}>Loading facilities…</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Facility</th>
              <th>Type</th>
              <th>Building</th>
              <th>Capacity</th>
              <th>Features</th>
              <th>Today's Status</th>
            </tr>
          </thead>
          <tbody>
            {facilities.map(f => (
              <tr key={f.id} className={styles.row}>
                <td>
                  <strong>{f.name}</strong>
                  <div className={styles.subText}>{f.code}</div>
                </td>
                <td>{FACILITY_TYPE_LABEL[f.type] ?? f.type}</td>
                <td>
                  {f.building}
                  {f.floor && <span className={styles.subText}> · Floor {f.floor}</span>}
                </td>
                <td>{f.capacity} pax</td>
                <td className={styles.featuresCell}>{f.features ?? '—'}</td>
                <td>
                  <Badge color={TODAY_STATUS_COLOR[f.todayStatus] ?? 'gray'} size="sm">
                    {f.todayStatus}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  const renderBookingsTab = () => (
    <div className={styles.tableWrap}>
      {bookingsLoading ? (
        <div className={styles.loading}>Loading bookings…</div>
      ) : bookings.length === 0 ? (
        <div className={styles.empty}>No bookings found.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Facility</th>
              <th>Date &amp; Time</th>
              <th>Purpose</th>
              <th>Booked By</th>
              <th>Status</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id} className={styles.row}>
                <td>
                  <strong>{b.facility.name}</strong>
                  <div className={styles.subText}>{b.facility.building}</div>
                </td>
                <td>
                  <div>{new Date(b.bookingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div className={styles.subText}>{b.startTime} – {b.endTime}</div>
                </td>
                <td className={styles.purposeCell}>{b.purpose}</td>
                <td>{b.booker.displayName}</td>
                <td>
                  <Badge color={BOOKING_STATUS_COLOR[b.status] ?? 'gray'} size="sm">
                    {b.status}
                  </Badge>
                </td>
                {isManager && (
                  <td>
                    {b.status === 'pending' && (
                      <div className={styles.actionBtns}>
                        <button
                          className={styles.approveBtn}
                          onClick={() => approveMutation.mutate({ id: b.id, action: 'approve' })}
                          title="Approve"
                        >
                          <CheckCircle size={15} />
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => approveMutation.mutate({ id: b.id, action: 'reject' })}
                          title="Reject"
                        >
                          <XCircle size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  const renderMaintenanceTab = () => (
    <div className={styles.tableWrap}>
      {ticketsLoading ? (
        <div className={styles.loading}>Loading tickets…</div>
      ) : tickets.length === 0 ? (
        <div className={styles.empty}>No maintenance tickets.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Issue</th>
              <th>Facility</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Reported By</th>
              <th>Submitted</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {tickets.map(tk => (
              <tr key={tk.id} className={styles.row}>
                <td>
                  <strong>{tk.title}</strong>
                  {tk.description && <div className={styles.subText}>{tk.description}</div>}
                </td>
                <td>
                  <div>{tk.facility.name}</div>
                  <div className={styles.subText}>{tk.facility.building}</div>
                </td>
                <td>
                  <Badge color={PRIORITY_COLOR[tk.priority] ?? 'gray'} size="sm">
                    {tk.priority}
                  </Badge>
                </td>
                <td>
                  <Badge color={TICKET_STATUS_COLOR[tk.status] ?? 'gray'} size="sm">
                    {tk.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td>{tk.reporter.displayName}</td>
                <td className={styles.subText}>
                  {new Date(tk.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </td>
                {isManager && (
                  <td>
                    {tk.status === 'open' && (
                      <button
                        className={styles.progressBtn}
                        onClick={() => updateTicketMutation.mutate({ id: tk.id, status: 'in_progress' })}
                        title="Mark In Progress"
                      >
                        <Clock size={14} /> In Progress
                      </button>
                    )}
                    {tk.status === 'in_progress' && (
                      <button
                        className={styles.approveBtn}
                        onClick={() => updateTicketMutation.mutate({ id: tk.id, status: 'resolved' })}
                        title="Mark Resolved"
                      >
                        <CheckCircle size={14} /> Resolve
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Campus Facilities</h1>
          <p className={styles.sub}>Room bookings, facility status and maintenance management</p>
        </div>
        <div className={styles.headerBtns}>
          <Button variant="secondary" icon={<Wrench size={14} />} onClick={() => setMaintenanceModal(true)}>
            Submit Maintenance
          </Button>
          <Button icon={<Plus size={14} />} onClick={() => setBookingModal(true)}>
            Book a Room
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {renderOverview()}

      {/* Tabs */}
      <Card className={styles.mainCard}>
        <div className={styles.tabs}>
          {(['facilities', 'bookings', 'maintenance'] as TabKey[]).map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'facilities'  && <Building2 size={14} />}
              {tab === 'bookings'    && <CalendarCheck size={14} />}
              {tab === 'maintenance' && <Wrench size={14} />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'bookings'    && overview?.pendingBookings ? (
                <span className={styles.badge}>{overview.pendingBookings}</span>
              ) : null}
              {tab === 'maintenance' && overview?.openMaintenanceTickets ? (
                <span className={styles.badge}>{overview.openMaintenanceTickets}</span>
              ) : null}
            </button>
          ))}
        </div>

        {activeTab === 'facilities'  && renderFacilitiesTab()}
        {activeTab === 'bookings'    && renderBookingsTab()}
        {activeTab === 'maintenance' && renderMaintenanceTab()}
      </Card>

      {/* ── Book a Room Modal ── */}
      <Modal
        open={bookingModal}
        title="Book a Room"
        onClose={() => { setBookingModal(false); setBookError('') }}
        footer={null}
      >
        <div className={styles.form}>
          <div>
            <label className={styles.label}>Facility *</label>
            <select
              className={styles.select}
              value={bookForm.facilityId}
              onChange={e => setBookForm(f => ({ ...f, facilityId: e.target.value }))}
            >
              <option value="">Select a facility…</option>
              {facilities
                .filter(f => f.todayStatus !== 'maintenance')
                .map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.building}) — cap. {f.capacity}
                  </option>
                ))}
            </select>
          </div>
          <Input
            label="Date *"
            type="date"
            value={bookForm.bookingDate}
            onChange={e => setBookForm(f => ({ ...f, bookingDate: (e.target as HTMLInputElement).value }))}
          />
          <div className={styles.timeRow}>
            <Input
              label="Start Time *"
              type="time"
              value={bookForm.startTime}
              onChange={e => setBookForm(f => ({ ...f, startTime: (e.target as HTMLInputElement).value }))}
            />
            <Input
              label="End Time *"
              type="time"
              value={bookForm.endTime}
              onChange={e => setBookForm(f => ({ ...f, endTime: (e.target as HTMLInputElement).value }))}
            />
          </div>
          <Input
            label="Purpose *"
            value={bookForm.purpose}
            placeholder="e.g. Department meeting, Lecture, Workshop"
            onChange={e => setBookForm(f => ({ ...f, purpose: (e.target as HTMLInputElement).value }))}
          />
          {bookError && <p className={styles.error}>{bookError}</p>}
          <div className={styles.formFooter}>
            <Button variant="secondary" onClick={() => { setBookingModal(false); setBookError('') }}>Cancel</Button>
            <Button
              loading={bookMutation.isPending}
              onClick={() => {
                if (!bookForm.facilityId || !bookForm.purpose) {
                  setBookError('Please fill in all required fields')
                  return
                }
                bookMutation.mutate()
              }}
            >
              Submit Booking
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Submit Maintenance Modal ── */}
      <Modal
        open={maintenanceModal}
        title="Submit Maintenance Request"
        onClose={() => { setMaintenanceModal(false); setMaintError('') }}
        footer={null}
      >
        <div className={styles.form}>
          <div>
            <label className={styles.label}>Facility *</label>
            <select
              className={styles.select}
              value={maintForm.facilityId}
              onChange={e => setMaintForm(f => ({ ...f, facilityId: e.target.value }))}
            >
              <option value="">Select a facility…</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.building})</option>
              ))}
            </select>
          </div>
          <Input
            label="Issue Title *"
            placeholder="Brief description of the problem"
            value={maintForm.title}
            onChange={e => setMaintForm(f => ({ ...f, title: (e.target as HTMLInputElement).value }))}
          />
          <div>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="Provide any additional details…"
              value={maintForm.description}
              onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className={styles.label}>Priority</label>
            <select
              className={styles.select}
              value={maintForm.priority}
              onChange={e => setMaintForm(f => ({ ...f, priority: e.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          {maintError && <p className={styles.error}>{maintError}</p>}
          <div className={styles.formFooter}>
            <Button variant="secondary" onClick={() => { setMaintenanceModal(false); setMaintError('') }}>Cancel</Button>
            <Button
              loading={maintMutation.isPending}
              onClick={() => {
                if (!maintForm.facilityId || !maintForm.title) {
                  setMaintError('Please fill in all required fields')
                  return
                }
                maintMutation.mutate()
              }}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
