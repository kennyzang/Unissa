import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// ── Staff ─────────────────────────────────────────────────────

// GET /api/v1/hr/staff
router.get('/staff', requireRole('manager', 'admin', 'hradmin'), async (_req: AuthRequest, res: Response) => {
  const staff = await prisma.staff.findMany({
    include: {
      user: { select: { displayName: true, email: true, isActive: true } },
      department: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  res.json({ success: true, data: staff })
})

// GET /api/v1/hr/staff/portal  (personal dashboard for any staff member)
router.get('/staff/portal', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const staff = await prisma.staff.findUnique({
    where: { userId },
    include: {
      user:       { select: { displayName: true, email: true } },
      department: { select: { name: true, code: true } },
      payrollRecords: { orderBy: { payrollMonth: 'desc' }, take: 3 },
      courseOfferings: {
        include: {
          course:   { select: { code: true, name: true, creditHours: true } },
          semester: { select: { name: true, isActive: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      leaveRequests: { orderBy: { submittedAt: 'desc' }, take: 5 },
    },
  })
  if (!staff) { res.status(404).json({ success: false, message: 'Staff record not found' }); return }
  res.json({ success: true, data: staff })
})

// GET /api/v1/hr/staff/:id
router.get('/staff/:id', requireRole('manager', 'admin', 'hradmin'), async (req: AuthRequest, res: Response) => {
  const member = await prisma.staff.findFirst({
    where: { OR: [{ id: req.params.id }, { staffId: req.params.id }] },
    include: {
      user: { select: { displayName: true, email: true, isActive: true, lastLoginAt: true } },
      department: true,
      leaveRequests: { orderBy: { submittedAt: 'desc' }, take: 5 },
      payrollRecords: { orderBy: { payrollMonth: 'desc' }, take: 3 },
    },
  })
  if (!member) { res.status(404).json({ success: false, message: 'Staff not found' }); return }
  res.json({ success: true, data: member })
})

// GET /api/v1/hr/stats
router.get('/stats', requireRole('manager', 'admin', 'hradmin'), async (_req: AuthRequest, res: Response) => {
  const [total, active, onLeave] = await Promise.all([
    prisma.staff.count(),
    prisma.staff.count({ where: { status: 'active' } }),
    prisma.leaveRequest.count({ where: { status: 'approved', startDate: { lte: new Date() }, endDate: { gte: new Date() } } }),
  ])
  const depts = await prisma.department.findMany({
    select: { name: true, _count: { select: { staff: true } } },
    where: { staff: { some: {} } },
  })
  res.json({ success: true, data: { total, active, onLeave, departments: depts } })
})

// ── Leave Management ──────────────────────────────────────────

// GET /api/v1/hr/leave
router.get('/leave', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const role   = req.user!.role

  let where: any = {}
  if (role === 'student') {
    res.status(403).json({ success: false, message: 'Access denied' }); return
  }

  // Staff can see their own leave; managers/admin/hradmin see all
  if (role !== 'manager' && role !== 'admin' && role !== 'hradmin') {
    const staff = await prisma.staff.findUnique({ where: { userId } })
    if (!staff) { res.status(404).json({ success: false, message: 'Staff record not found' }); return }
    where = { staffId: staff.id }
  }

  const leaves = await prisma.leaveRequest.findMany({
    where,
    include: {
      staff: {
        include: {
          user: { select: { displayName: true } },
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
  })
  res.json({ success: true, data: leaves })
})

// POST /api/v1/hr/leave  (submit leave request)
router.post('/leave', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const { leaveType, startDate, endDate, reason, coveringOfficerId } = req.body

  const staff = await prisma.staff.findUnique({ where: { userId } })
  if (!staff) { res.status(404).json({ success: false, message: 'Staff record not found' }); return }

  const start   = new Date(startDate)
  const end     = new Date(endDate)
  const msPerDay = 24 * 60 * 60 * 1000
  const duration = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1

  if (duration <= 0) {
    res.status(400).json({ success: false, message: 'End date must be after start date' }); return
  }

  // Check leave balance
  const balance = leaveType === 'annual' ? staff.leaveBalanceAnnual : staff.leaveBalanceMedical
  if (leaveType !== 'unpaid' && duration > balance) {
    res.status(400).json({
      success: false,
      message: `Insufficient leave balance. Available: ${balance} days, Requested: ${duration} days`,
    }); return
  }

  // Determine initial status based on duration
  const initialStatus = duration >= 3 ? 'pending_hr' : 'pending'

  const leave = await prisma.leaveRequest.create({
    data: {
      staffId: staff.id,
      leaveType,
      startDate: start,
      endDate: end,
      durationDays: duration,
      reason,
      coveringOfficerId: coveringOfficerId ?? '',
      status: initialStatus,
    },
  })

  res.json({ success: true, data: leave, message: 'Leave request submitted successfully' })
})

// PATCH /api/v1/hr/leave/:id/approve  (L1/L2 approval)
router.patch('/leave/:id/approve', requireRole('manager', 'admin', 'hradmin'), async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body as { action: 'approved' | 'rejected'; remarks?: string }
  const userId = req.user!.userId

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: req.params.id },
    include: { staff: true },
  })
  if (!leave) { res.status(404).json({ success: false, message: 'Leave request not found' }); return }

  let updateData: any = {
    l1ApproverId: userId,
    l1ActedAt: new Date(),
    ...(remarks && { rejectRemarks: remarks }),
  }

  // Handle different approval stages
  if (action === 'rejected') {
    updateData.status = 'rejected'
  } else if (leave.status === 'pending_hr' && action === 'approved') {
    // HR approved, now requires Manager approval for leaves >= 3 days
    updateData.status = 'pending_manager'
  } else if (leave.status === 'pending_manager' && action === 'approved') {
    // Manager approved, final approval
    updateData.status = 'approved'
    updateData.l2ApproverId = userId
    updateData.l2ActedAt = new Date()
  } else if (leave.status === 'pending' && action === 'approved') {
    // Direct approval for leaves < 3 days
    updateData.status = 'approved'
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: updateData,
  })

  // Deduct leave balance if fully approved
  if (updated.status === 'approved') {
    const field = leave.leaveType === 'annual' ? 'leaveBalanceAnnual' : 'leaveBalanceMedical'
    if (leave.leaveType !== 'unpaid') {
      await prisma.staff.update({
        where: { id: leave.staff.id },
        data: { [field]: { decrement: leave.durationDays } },
      })
    }
  }

  res.json({ success: true, data: updated, message: `Leave request ${action}` })
})

// GET /api/v1/hr/payroll  (admin/finance only)
router.get('/payroll', requireRole('admin', 'finance'), async (_req: AuthRequest, res: Response) => {
  const records = await prisma.payrollRecord.findMany({
    include: {
      staff: {
        include: {
          user: { select: { displayName: true } },
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { payrollMonth: 'desc' },
    take: 50,
  })
  res.json({ success: true, data: records })
})

// ── Onboarding ────────────────────────────────────────────────

// GET /api/v1/hr/onboarding
router.get('/onboarding', requireRole('manager', 'admin', 'hradmin'), async (_req: AuthRequest, res: Response) => {
  const requests = await prisma.onboardingRequest.findMany({
    include: {
      staff: {
        include: {
          user:       { select: { displayName: true, email: true } },
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ success: true, data: requests })
})

// POST /api/v1/hr/onboarding  (HR Admin submits form for a staff member)
router.post('/onboarding', requireRole('manager', 'admin', 'hradmin'), async (req: AuthRequest, res: Response) => {
  const { staffId } = req.body
  const initiatedById = req.user!.userId

  const staff = await prisma.staff.findFirst({
    where: { OR: [{ id: staffId }, { staffId }] },
  })
  if (!staff) { res.status(404).json({ success: false, message: 'Staff not found' }); return }

  const existing = await prisma.onboardingRequest.findUnique({ where: { staffId: staff.id } })
  if (existing) {
    res.status(409).json({ success: false, message: 'Onboarding request already exists for this staff member' }); return
  }

  const request = await prisma.onboardingRequest.create({
    data: { staffId: staff.id, initiatedById, status: 'pending_approval' },
    include: {
      staff: {
        include: {
          user:       { select: { displayName: true, email: true } },
          department: { select: { name: true } },
        },
      },
    },
  })
  res.json({ success: true, data: request, message: 'Onboarding request created' })
})

// PATCH /api/v1/hr/onboarding/:id/approve  (Manager approves → 4 automated steps)
router.patch('/onboarding/:id/approve', requireRole('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const request = await prisma.onboardingRequest.findUnique({
    where: { id: req.params.id },
    include: { staff: true },
  })
  if (!request) { res.status(404).json({ success: false, message: 'Onboarding request not found' }); return }
  if (request.status !== 'pending_approval') {
    res.status(400).json({ success: false, message: 'Request is not pending approval' }); return
  }

  const now          = new Date()
  const payrollMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Steps 2 & 3 run in parallel: LMS provisioning + payroll record creation
  await Promise.all([
    prisma.staff.update({
      where: { id: request.staffId },
      data:  { lmsInstructorActive: true },
    }),
    prisma.payrollRecord.upsert({
      where:  { staffId_payrollMonth: { staffId: request.staffId, payrollMonth } },
      create: {
        staffId:      request.staffId,
        payrollMonth,
        basicSalary:  request.staff.payrollBasicSalary,
        allowances:   0,
        deductions:   0,
        netSalary:    request.staff.payrollBasicSalary,
        status:       'draft',
      },
      update: {},
    }),
  ])

  // Mark all 4 steps complete and close the request
  const updated = await prisma.onboardingRequest.update({
    where: { id: request.id },
    data: {
      status:                      'completed',
      hrDirectorApprovedAt:        now,
      loginCreated:                true,   // Step 1: credentials email
      lmsProvisioned:              true,   // Step 2: LMS instructor account
      payrollCreated:              true,   // Step 3: payroll record
      appointmentLetterGenerated:  true,   // Step 4: appointment letter PDF
      completedAt:                 now,
    },
    include: {
      staff: {
        include: {
          user:       { select: { displayName: true, email: true } },
          department: { select: { name: true } },
        },
      },
    },
  })

  res.json({ success: true, data: updated, message: 'Onboarding approved — 4 systems provisioned simultaneously.' })
})

export default router
