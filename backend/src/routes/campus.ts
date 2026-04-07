import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/campus/facilities
router.get('/facilities', async (_req: AuthRequest, res: Response) => {
  const facilities = await prisma.campusFacility.findMany({
    include: {
      _count: { select: { bookings: true, maintenanceTickets: true } },
    },
    orderBy: [{ building: 'asc' }, { name: 'asc' }],
  })

  // Annotate each facility with today's booking status
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayBookings = await prisma.facilityBooking.findMany({
    where: {
      bookingDate: { gte: today, lt: tomorrow },
      status: { in: ['confirmed', 'pending'] },
    },
  })

  const bookedFacilityIds = new Set(todayBookings.map(b => b.facilityId))

  const openTickets = await prisma.maintenanceTicket.findMany({
    where: { status: { in: ['open', 'in_progress'] } },
    select: { facilityId: true },
  })
  const maintenanceFacilityIds = new Set(openTickets.map(t => t.facilityId))

  const enriched = facilities.map(f => ({
    ...f,
    todayStatus: maintenanceFacilityIds.has(f.id)
      ? 'maintenance'
      : bookedFacilityIds.has(f.id)
      ? 'booked'
      : 'available',
  }))

  res.json({ success: true, data: enriched })
})

// GET /api/v1/campus/bookings
router.get('/bookings', async (req: AuthRequest, res: Response) => {
  const { status, facilityId } = req.query as Record<string, string>
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (facilityId) where.facilityId = facilityId

  const bookings = await prisma.facilityBooking.findMany({
    where,
    include: {
      facility: { select: { id: true, name: true, type: true, building: true } },
      department: { select: { name: true } },
    },
    orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
  })

  // Resolve booker names from users table
  const bookerIds = [...new Set(bookings.map(b => b.bookedById))]
  const users = await prisma.user.findMany({
    where: { id: { in: bookerIds } },
    select: { id: true, displayName: true, role: true },
  })
  const userMap = Object.fromEntries(users.map(u => [u.id, u]))

  const data = bookings.map(b => ({
    ...b,
    booker: userMap[b.bookedById] ?? { id: b.bookedById, displayName: 'Unknown', role: '' },
  }))

  res.json({ success: true, data })
})

// POST /api/v1/campus/bookings
router.post('/bookings', async (req: AuthRequest, res: Response) => {
  const {
    facilityId, bookingDate, startTime, endTime, purpose, departmentId,
  } = req.body as {
    facilityId: string
    bookingDate: string
    startTime: string
    endTime: string
    purpose: string
    departmentId?: string
  }

  if (!facilityId || !bookingDate || !startTime || !endTime || !purpose) {
    res.status(400).json({ success: false, message: 'facilityId, bookingDate, startTime, endTime and purpose are required' })
    return
  }

  // Check for conflicts
  const date = new Date(bookingDate)
  const conflicts = await prisma.facilityBooking.findMany({
    where: {
      facilityId,
      bookingDate: { gte: new Date(date.toDateString()), lt: new Date(new Date(date.toDateString()).getTime() + 86400000) },
      status: { in: ['confirmed', 'pending'] },
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    },
  })

  if (conflicts.length > 0) {
    res.status(409).json({ success: false, message: 'This facility is already booked for the selected time slot' })
    return
  }

  const booking = await prisma.facilityBooking.create({
    data: {
      facilityId,
      bookedById: req.user!.userId,
      departmentId: departmentId ?? undefined,
      bookingDate: new Date(bookingDate),
      startTime,
      endTime,
      purpose,
      status: 'pending',
    },
    include: {
      facility: { select: { name: true, building: true } },
    },
  })

  res.status(201).json({ success: true, data: booking, message: 'Booking request submitted' })
})

// PATCH /api/v1/campus/bookings/:id/approve
router.patch('/bookings/:id/approve', requireRole('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body as { action: 'approve' | 'reject'; remarks?: string }

  const booking = await prisma.facilityBooking.findUnique({ where: { id: String(req.params.id) } })
  if (!booking) { res.status(404).json({ success: false, message: 'Booking not found' }); return }

  const updated = await prisma.facilityBooking.update({
    where: { id: String(req.params.id) },
    data: { status: action === 'approve' ? 'confirmed' : 'rejected' },
    include: {
      facility: { select: { name: true } },
    },
  })

  res.json({ success: true, data: updated, message: `Booking ${action === 'approve' ? 'approved' : 'rejected'}` })
})

// GET /api/v1/campus/maintenance
router.get('/maintenance', async (_req: AuthRequest, res: Response) => {
  const tickets = await prisma.maintenanceTicket.findMany({
    include: {
      facility: { select: { id: true, name: true, building: true } },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  })

  // Resolve reporter and assignee names
  const userIds = [...new Set([
    ...tickets.map(t => t.reportedById),
    ...tickets.filter(t => t.assignedToId).map(t => t.assignedToId!),
  ])]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true },
  })
  const userMap = Object.fromEntries(users.map(u => [u.id, u]))

  const data = tickets.map(t => ({
    ...t,
    reporter: userMap[t.reportedById] ?? { id: t.reportedById, displayName: 'Unknown' },
    assignee: t.assignedToId ? (userMap[t.assignedToId] ?? null) : null,
  }))

  res.json({ success: true, data })
})

// POST /api/v1/campus/maintenance
router.post('/maintenance', async (req: AuthRequest, res: Response) => {
  const { facilityId, title, description, priority } = req.body as {
    facilityId: string
    title: string
    description?: string
    priority?: string
  }

  if (!facilityId || !title) {
    res.status(400).json({ success: false, message: 'facilityId and title are required' })
    return
  }

  const ticket = await prisma.maintenanceTicket.create({
    data: {
      facilityId,
      reportedById: req.user!.userId,
      title,
      description,
      priority: priority ?? 'medium',
      status: 'open',
    },
    include: { facility: { select: { name: true } } },
  })

  res.status(201).json({ success: true, data: ticket, message: 'Maintenance ticket submitted' })
})

// PATCH /api/v1/campus/maintenance/:id
router.patch('/maintenance/:id', requireRole('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { status, assignedToId } = req.body as { status?: string; assignedToId?: string }

  const ticket = await prisma.maintenanceTicket.findUnique({ where: { id: String(req.params.id) } })
  if (!ticket) { res.status(404).json({ success: false, message: 'Ticket not found' }); return }

  const updated = await prisma.maintenanceTicket.update({
    where: { id: String(req.params.id) },
    data: {
      ...(status ? { status } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(status === 'resolved' ? { resolvedAt: new Date() } : {}),
    },
    include: { facility: { select: { name: true } } },
  })

  res.json({ success: true, data: updated, message: 'Ticket updated' })
})

// GET /api/v1/campus/overview — KPI summary for dashboard cards
router.get('/overview', async (_req: AuthRequest, res: Response) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [totalFacilities, bookedToday, openTickets, pendingBookings] = await Promise.all([
    prisma.campusFacility.count(),
    prisma.facilityBooking.count({
      where: { bookingDate: { gte: today, lt: tomorrow }, status: { in: ['confirmed', 'pending'] } },
    }),
    prisma.maintenanceTicket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.facilityBooking.count({ where: { status: 'pending' } }),
  ])

  res.json({
    success: true,
    data: {
      totalFacilities,
      bookedToday,
      availableNow: totalFacilities - bookedToday,
      openMaintenanceTickets: openTickets,
      pendingBookings,
    },
  })
})

export default router
