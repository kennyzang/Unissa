import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, MapPin, User, BookOpen, ChevronLeft, ChevronRight,
  RefreshCw, AlertTriangle, Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/ui/Badge'
import styles from './CourseCalendar.module.scss'

// ─── Public Types ─────────────────────────────────────────────────────────────

export type BadgeColor = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'purple' | 'cyan'

export interface CalendarEntry {
  id: string
  courseCode: string
  courseName: string
  creditHours: number
  dayOfWeek: string        // 'Monday' | 'Tuesday' | …
  startTime: string        // 'HH:MM'
  endTime: string          // 'HH:MM'
  room: string
  instructorName?: string
  color: { bg: string; border: string; text: string }
  href: string
  badges: Array<{ label: string; color: BadgeColor }>
  availability?: 'enrolled' | 'available'
}

export interface CourseCalendarProps {
  entries: CalendarEntry[]
  onRefresh?: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64            // px per hour in the time grid
const START_HOUR  = 8             // 08:00
const END_HOUR    = 20            // 20:00
const TOTAL_HOURS = END_HOUR - START_HOUR

const WEEK_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const DAY_OF_WEEK_ORDER: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function clampToGrid(mins: number): number {
  return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, mins))
}

function timeToTop(t: string): number {
  return ((clampToGrid(parseMins(t)) - START_HOUR * 60) / 60) * HOUR_HEIGHT
}

function timeToPx(start: string, end: string): number {
  const h = ((clampToGrid(parseMins(end)) - clampToGrid(parseMins(start))) / 60) * HOUR_HEIGHT
  return Math.max(h - 2, 24)   // at least 24 px
}

function weekMondayOf(anchor: Date): Date {
  const d = new Date(anchor)
  const day = d.getDay()              // 0=Sun…6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekDaysOf(anchor: Date): Date[] {
  const mon = weekMondayOf(anchor)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function jsWeekdayOf(d: Date): string {
  const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return names[d.getDay()]
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isToday(d: Date): boolean { return isSameDay(d, new Date()) }

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function fmtWeekRange(days: Date[]): string {
  if (days.length === 0) return ''
  const first = days[0]
  const last  = days[days.length - 1]
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString('en-US',{month:'short'})} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`
  }
  return `${fmtShortDate(first)} – ${fmtShortDate(last)}, ${last.getFullYear()}`
}

type CourseStatus = 'in-progress' | 'completed' | 'upcoming'

function getCourseStatus(entry: CalendarEntry, forDate: Date): CourseStatus {
  const now      = new Date()
  const todayDay = jsWeekdayOf(now)
  const curMins  = now.getHours() * 60 + now.getMinutes()
  const startMin = parseMins(entry.startTime)
  const endMin   = parseMins(entry.endTime)

  if (isSameDay(forDate, now) && entry.dayOfWeek === todayDay) {
    if (curMins >= endMin)   return 'completed'
    if (curMins >= startMin) return 'in-progress'
    return 'upcoming'
  }

  // forDate is strictly before today → completed for this week
  const forDateStart = new Date(forDate); forDateStart.setHours(0,0,0,0)
  const todayStart   = new Date(now);     todayStart.setHours(0,0,0,0)
  if (forDateStart < todayStart) return 'completed'
  return 'upcoming'
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipData {
  entry: CalendarEntry
  status: CourseStatus
  x: number
  y: number
}

const CourseTooltip: React.FC<{ data: TooltipData; onClose: () => void }> = ({ data, onClose }) => {
  const navigate = useNavigate()
  const { entry, status, x, y } = data
  const ref = useRef<HTMLDivElement>(null)

  const statusCfg: Record<CourseStatus, { label: string; color: string; bg: string }> = {
    'in-progress': { label: 'In Progress', color: '#059669', bg: '#ecfdf5' },
    'completed':   { label: 'Completed',   color: '#6b7280', bg: '#f3f4f6' },
    'upcoming':    { label: 'Upcoming',    color: '#2563eb', bg: '#eff6ff' },
  }
  const sc = statusCfg[status]

  // Smart flip if near edge
  const W = 264
  const vW = window.innerWidth
  const vH = window.innerHeight
  const left = x + 16 + W > vW - 8 ? x - W - 16 : x + 16
  const top  = Math.min(y - 8, vH - 300)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      ref={ref}
      className={styles.tooltip}
      style={{ left, top }}
      onMouseLeave={onClose}
    >
      <div className={styles.tooltipHeader} style={{ borderLeftColor: entry.color.border }}>
        <span className={styles.tooltipCode} style={{ color: entry.color.text }}>{entry.courseCode}</span>
        <span className={styles.tooltipStatus} style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
      </div>
      <div className={styles.tooltipName}>{entry.courseName}</div>
      <div className={styles.tooltipMeta}>
        <div className={styles.tooltipMetaRow}><Clock size={12} /><span>{entry.startTime} – {entry.endTime}</span></div>
        <div className={styles.tooltipMetaRow}><MapPin size={12} /><span>{entry.room}</span></div>
        {entry.instructorName && (
          <div className={styles.tooltipMetaRow}><User size={12} /><span>{entry.instructorName}</span></div>
        )}
        <div className={styles.tooltipMetaRow}><BookOpen size={12} /><span>{entry.creditHours} Credit Hours</span></div>
      </div>
      {entry.badges.length > 0 && (
        <div className={styles.tooltipBadges}>
          {entry.badges.map((b, i) => (
            <Badge key={i} color={b.color} size="sm">{b.label}</Badge>
          ))}
        </div>
      )}
      <button
        className={styles.tooltipCta}
        style={{ '--cta-color': entry.color.border } as React.CSSProperties}
        onClick={() => { onClose(); navigate(entry.href) }}
      >
        View Details →
      </button>
    </div>
  )
}

// ─── Course Block (shared by Day & Week views) ────────────────────────────────

interface CourseBlockProps {
  entry: CalendarEntry
  forDate: Date
  width?: string
  left?: string
  onHover: (data: TooltipData | null) => void
  onClick: () => void
}

const CourseBlock: React.FC<CourseBlockProps> = ({ entry, forDate, width = '100%', left = '0', onHover, onClick }) => {
  const status = getCourseStatus(entry, forDate)
  const top    = timeToTop(entry.startTime)
  const height = timeToPx(entry.startTime, entry.endTime)
  const isShort = height < 56

  const statusClass = status === 'in-progress'
    ? styles.blockInProgress
    : status === 'completed'
    ? styles.blockCompleted
    : styles.blockUpcoming

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    onHover({ entry, status, x: e.clientX, y: e.clientY })
  }, [entry, status, onHover])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    onHover({ entry, status, x: e.clientX, y: e.clientY })
  }, [entry, status, onHover])

  return (
    <div
      className={`${styles.courseBlock} ${statusClass}`}
      style={{
        top,
        height,
        width,
        left,
        background: entry.color.bg,
        borderColor: entry.color.border,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      {status === 'in-progress' && <span className={styles.liveDot} />}
      <div className={styles.blockCode} style={{ color: entry.color.text }}>{entry.courseCode}</div>
      {!isShort && (
        <>
          <div className={styles.blockName}>{entry.courseName}</div>
          <div className={styles.blockMeta}><Clock size={10} /><span>{entry.startTime}–{entry.endTime}</span></div>
          {height >= 80 && (
            <div className={styles.blockMeta}><MapPin size={10} /><span>{entry.room}</span></div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Week / Day Time Grid ─────────────────────────────────────────────────────

interface TimeGridProps {
  days: Date[]           // 1 day for day-view, 6 for week-view
  entries: CalendarEntry[]
  onHover: (data: TooltipData | null) => void
  onClickEntry: (entry: CalendarEntry) => void
}

const TimeGrid: React.FC<TimeGridProps> = ({ days, entries, onHover, onClickEntry }) => {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i)

  // Current time line
  const now       = new Date()
  const nowMins   = now.getHours() * 60 + now.getMinutes()
  const showNowLine = nowMins >= START_HOUR * 60 && nowMins <= END_HOUR * 60
  const nowTop    = ((nowMins - START_HOUR * 60) / 60) * HOUR_HEIGHT

  // Group entries by day-of-week name
  const entriesByDay: Record<string, CalendarEntry[]> = {}
  days.forEach(d => { entriesByDay[jsWeekdayOf(d)] = [] })
  entries.forEach(e => {
    if (entriesByDay[e.dayOfWeek] !== undefined) entriesByDay[e.dayOfWeek].push(e)
  })

  return (
    <div className={styles.timeGrid}>
      {/* Day headers */}
      <div className={styles.timeGridHeaders}>
        <div className={styles.timeAxisGutter} />
        {days.map(d => {
          const today = isToday(d)
          return (
            <div key={d.toISOString()} className={`${styles.dayHeader} ${today ? styles.dayHeaderToday : ''}`}>
              <span className={styles.dayHeaderName}>{jsWeekdayOf(d).slice(0, 3).toUpperCase()}</span>
              <span className={styles.dayHeaderDate}>{d.getDate()}</span>
            </div>
          )
        })}
      </div>

      {/* Scrollable time body */}
      <div className={styles.timeGridBody}>
        {/* Time axis */}
        <div className={styles.timeAxis}>
          {hours.map(h => (
            <div key={h} className={styles.timeLabel} style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 8 }}>
              {h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className={styles.dayColumns} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map(d => {
            const dayName  = jsWeekdayOf(d)
            const dayEnts  = entriesByDay[dayName] ?? []
            const today    = isToday(d)

            return (
              <div key={d.toISOString()} className={`${styles.dayColumn} ${today ? styles.dayColumnToday : ''}`}>
                {/* Hour grid lines */}
                {hours.map(h => (
                  <div
                    key={h}
                    className={styles.hourLine}
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}

                {/* Current time line (only for today) */}
                {today && showNowLine && (
                  <div className={styles.nowLine} style={{ top: nowTop }}>
                    <span className={styles.nowDot} />
                  </div>
                )}

                {/* Course blocks */}
                {dayEnts.map(e => (
                  <CourseBlock
                    key={e.id}
                    entry={e}
                    forDate={d}
                    onHover={onHover}
                    onClick={() => onClickEntry(e)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

interface MonthViewProps {
  anchor: Date
  entries: CalendarEntry[]
  onDayClick: (d: Date) => void
}

const MonthView: React.FC<MonthViewProps> = ({ anchor, entries, onDayClick }) => {
  const year  = anchor.getFullYear()
  const month = anchor.getMonth()

  // Build the 6-week grid
  const firstDay = new Date(year, month, 1)
  const gridStart = weekMondayOf(firstDay)

  const weeks: Date[][] = []
  let cur = new Date(gridStart)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  // Map weekday name → entries
  const entryByWeekday: Record<string, CalendarEntry[]> = {}
  WEEK_DAY_NAMES.forEach(n => { entryByWeekday[n] = [] })
  entries.forEach(e => {
    if (entryByWeekday[e.dayOfWeek]) entryByWeekday[e.dayOfWeek].push(e)
  })

  const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  return (
    <div className={styles.monthGrid}>
      {/* Day-of-week headers */}
      <div className={styles.monthDayHeaders}>
        {dayHeaders.map(h => (
          <div key={h} className={styles.monthDayOfWeekLabel}>{h}</div>
        ))}
      </div>

      {/* Calendar weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className={styles.monthWeekRow}>
          {week.map(d => {
            const inMonth   = d.getMonth() === month
            const today     = isToday(d)
            const weekday   = jsWeekdayOf(d)
            // Sunday in grid maps to last column; only show Mon-Sat entries
            const dayEnts   = weekday === 'Sunday' ? [] : (entryByWeekday[weekday] ?? [])

            return (
              <div
                key={d.toISOString()}
                className={`${styles.monthCell} ${!inMonth ? styles.monthCellOtherMonth : ''} ${today ? styles.monthCellToday : ''}`}
                onClick={() => inMonth && onDayClick(d)}
                role={inMonth ? 'button' : undefined}
                tabIndex={inMonth ? 0 : undefined}
                onKeyDown={e => { if (inMonth && (e.key === 'Enter' || e.key === ' ')) onDayClick(d) }}
              >
                <span className={`${styles.monthDayNum} ${today ? styles.monthDayNumToday : ''}`}>
                  {d.getDate()}
                </span>
                <div className={styles.monthCoursePills}>
                  {dayEnts.slice(0, 3).map(e => (
                    <div
                      key={e.id}
                      className={styles.monthCoursePill}
                      style={{ background: e.color.bg, borderColor: e.color.border, color: e.color.text }}
                      title={`${e.courseCode} ${e.startTime}–${e.endTime}`}
                    >
                      {e.courseCode}
                    </div>
                  ))}
                  {dayEnts.length > 3 && (
                    <div className={styles.monthMorePill}>+{dayEnts.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const CalendarLegend: React.FC<{ entries: CalendarEntry[] }> = ({ entries }) => {
  const uniqueEntries = entries.filter((e, i, a) => a.findIndex(x => x.id === e.id) === i)
  return (
    <div className={styles.legend}>
      <div className={styles.legendGroup}>
        <span className={styles.legendLabel}>Status:</span>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#059669' }} />
          <span>In Progress</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#6b7280' }} />
          <span>Completed</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#2563eb' }} />
          <span>Upcoming</span>
        </div>
      </div>
      {uniqueEntries.length > 0 && (
        <div className={styles.legendGroup}>
          <span className={styles.legendLabel}>Courses:</span>
          {uniqueEntries.map(e => (
            <div key={e.id} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: e.color.bg, borderColor: e.color.border }} />
              <span>{e.courseCode}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type CalendarMode = 'day' | 'week' | 'month'

const CourseCalendar: React.FC<CourseCalendarProps> = ({ entries, onRefresh }) => {
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const [mode, setMode]             = useState<CalendarMode>('week')
  const [anchor, setAnchor]         = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [tooltip, setTooltip]       = useState<TooltipData | null>(null)
  const [mobileDay, setMobileDay]   = useState<string>(() => {
    const d = new Date(); return jsWeekdayOf(d)
  })

  // Tooltip debounce (hide only after a short delay to allow mouse to enter tooltip)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleHover = useCallback((data: TooltipData | null) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (data) {
      setTooltip(data)
    } else {
      hideTimerRef.current = setTimeout(() => setTooltip(null), 80)
    }
  }, [])

  const handleClickEntry = useCallback((entry: CalendarEntry) => {
    setTooltip(null)
    navigate(entry.href)
  }, [navigate])

  // Navigation
  const navigate_ = (delta: number) => {
    setAnchor(prev => {
      const d = new Date(prev)
      if (mode === 'day')   d.setDate(d.getDate() + delta)
      if (mode === 'week')  d.setDate(d.getDate() + delta * 7)
      if (mode === 'month') d.setMonth(d.getMonth() + delta)
      return d
    })
    setTooltip(null)
  }

  const goToday = () => {
    const d = new Date(); d.setHours(0,0,0,0)
    setAnchor(d)
    setTooltip(null)
  }

  // Period label
  const weekDays   = weekDaysOf(anchor)
  const periodLabel = mode === 'day'   ? anchor.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
                    : mode === 'week'  ? fmtWeekRange(weekDays)
                    :                   fmtMonthYear(anchor)

  // Active days for mobile tab (week mode)
  const activeDays = WEEK_DAY_NAMES.filter(d => entries.some(e => e.dayOfWeek === d))
  const mobileDays = activeDays.length > 0 ? activeDays : WEEK_DAY_NAMES.slice(0, 5)
  const curMobileDay = mobileDays.includes(mobileDay) ? mobileDay : mobileDays[0]

  // For day view: find the weekday name for the selected anchor date
  const dayViewWeekday = jsWeekdayOf(anchor)
  const dayViewEntries = entries.filter(e => e.dayOfWeek === dayViewWeekday)

  return (
    <div className={styles.calendar}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* View mode switcher */}
          <div className={styles.modeGroup}>
            {(['day','week','month'] as CalendarMode[]).map(m => (
              <button
                key={m}
                className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ''}`}
                onClick={() => { setMode(m); setTooltip(null) }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbarCenter}>
          {/* Navigation */}
          <div className={styles.navGroup}>
            <button className={styles.navBtn} onClick={() => navigate_(-1)} aria-label="Previous">
              <ChevronLeft size={16} />
            </button>
            <button className={styles.todayBtn} onClick={goToday}>Today</button>
            <button className={styles.navBtn} onClick={() => navigate_(1)} aria-label="Next">
              <ChevronRight size={16} />
            </button>
          </div>
          <span className={styles.periodLabel}>{periodLabel}</span>
        </div>

        <div className={styles.toolbarRight}>
          {onRefresh && (
            <button className={styles.refreshBtn} onClick={onRefresh} title="Refresh">
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Week View ── */}
      {mode === 'week' && (
        <>
          {/* Mobile: day tab switcher */}
          <div className={styles.mobileTabs}>
            {mobileDays.map(day => {
              const hasEntry = entries.some(e => e.dayOfWeek === day)
              return (
                <button
                  key={day}
                  className={`${styles.mobileTab} ${curMobileDay === day ? styles.mobileTabActive : ''}`}
                  onClick={() => setMobileDay(day)}
                >
                  <span className={styles.mobileTabName}>{day.slice(0,3).toUpperCase()}</span>
                  {hasEntry && <span className={styles.mobileTabDot} />}
                </button>
              )
            })}
          </div>

          {/* Mobile single-day list */}
          <div className={styles.mobileDayList}>
            {entries.filter(e => e.dayOfWeek === curMobileDay).length === 0
              ? <div className={styles.emptyDay}>No classes scheduled</div>
              : entries.filter(e => e.dayOfWeek === curMobileDay).map(e => (
                <MobileEntryCard key={e.id} entry={e} onClick={() => handleClickEntry(e)} />
              ))
            }
          </div>

          {/* Desktop time grid */}
          <div className={styles.desktopOnly}>
            <TimeGrid
              days={weekDays}
              entries={entries}
              onHover={handleHover}
              onClickEntry={handleClickEntry}
            />
          </div>
        </>
      )}

      {/* ── Day View ── */}
      {mode === 'day' && (
        <>
          {/* Mobile list */}
          <div className={styles.mobileDayList}>
            {dayViewEntries.length === 0
              ? <div className={styles.emptyDay}>No classes on {dayViewWeekday}</div>
              : dayViewEntries.map(e => (
                <MobileEntryCard key={e.id} entry={e} onClick={() => handleClickEntry(e)} />
              ))
            }
          </div>

          {/* Desktop grid */}
          <div className={styles.desktopOnly}>
            <TimeGrid
              days={[anchor]}
              entries={dayViewEntries}
              onHover={handleHover}
              onClickEntry={handleClickEntry}
            />
          </div>
        </>
      )}

      {/* ── Month View ── */}
      {mode === 'month' && (
        <MonthView
          anchor={anchor}
          entries={entries}
          onDayClick={d => { setAnchor(d); setMode('day'); setTooltip(null) }}
        />
      )}

      {/* ── Legend ── */}
      <CalendarLegend entries={entries} />

      {/* ── Tooltip (portal-like fixed layer) ── */}
      {tooltip && (
        <CourseTooltip
          data={tooltip}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  )
}

// ─── Mobile Entry Card ────────────────────────────────────────────────────────

const MobileEntryCard: React.FC<{ entry: CalendarEntry; onClick: () => void }> = ({ entry, onClick }) => {
  const today = new Date()
  const status = getCourseStatus(entry, today)
  const sc = {
    'in-progress': { label: 'In Progress', color: '#059669', bg: '#ecfdf5' },
    'completed':   { label: 'Completed',   color: '#9ca3af', bg: '#f3f4f6' },
    'upcoming':    { label: 'Upcoming',    color: '#3b82f6', bg: '#eff6ff' },
  }[status]

  return (
    <div
      className={styles.mobileEntryCard}
      style={{ borderLeftColor: entry.color.border, background: entry.color.bg }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      <div className={styles.mobileEntryHeader}>
        <span className={styles.mobileEntryCode} style={{ color: entry.color.text }}>{entry.courseCode}</span>
        <span className={styles.mobileEntryStatus} style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
      </div>
      <div className={styles.mobileEntryName}>{entry.courseName}</div>
      <div className={styles.mobileEntryMeta}>
        <span><Clock size={11} /> {entry.startTime}–{entry.endTime}</span>
        <span><MapPin size={11} /> {entry.room}</span>
        {entry.instructorName && <span><User size={11} /> {entry.instructorName}</span>}
      </div>
      <div className={styles.mobileEntryBadges}>
        {entry.badges.map((b, i) => <Badge key={i} color={b.color} size="sm">{b.label}</Badge>)}
      </div>
    </div>
  )
}

export default CourseCalendar
