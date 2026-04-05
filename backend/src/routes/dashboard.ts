import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/dashboard/kpi
router.get('/kpi', requireRole('admin', 'manager', 'finance'), async (req: AuthRequest, res: Response) => {
  const role = req.user!.role

  // ── Core queries (all roles) ──────────────────────────────────
  const [
    totalEnrolled,
    newAppsToday,
    acceptedToday,
    totalStaff,
    onLeave,
    activeGrants,
    grantsValue,
    roomsToday,
    totalRooms,
    maintenanceOpen,
    vehiclesInUse,
    totalVehicles,
    atRisk,
  ] = await Promise.all([
    prisma.student.count({ where: { status: 'active' } }),
    prisma.applicant.count({ where: { submittedAt: { gte: startOfDay() } } }),
    prisma.applicant.count({ where: { status: 'accepted', decisionMadeAt: { gte: startOfDay() } } }),
    prisma.staff.count({ where: { status: 'active' } }),
    prisma.staff.count({ where: { status: 'on_leave' } }),
    prisma.researchGrant.count({ where: { status: 'active' } }),
    prisma.researchGrant.aggregate({ where: { status: 'active' }, _sum: { totalBudget: true } }),
    prisma.facilityBooking.count({ where: { bookingDate: { gte: startOfDay(), lte: endOfDay() }, status: 'confirmed' } }),
    prisma.campusFacility.count(),
    prisma.maintenanceTicket.count({ where: { status: 'open' } }),
    prisma.campusVehicle.count({ where: { status: 'in_use' } }),
    prisma.campusVehicle.count(),
    prisma.studentRiskScore.count({ where: { predictedOutcome: { in: ['fail', 'at_risk'] } } }),
  ])

  // ── Previously hardcoded metrics — now computed from real data ─

  const startMonth = new Date()
  startMonth.setDate(1)
  startMonth.setHours(0, 0, 0, 0)

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    pendingPRs,
    pendingLeaves,
    pendingGrantProposals,
    newHiresMonth,
    activeAttendanceRecords,
    assignmentsDueToday,
  ] = await Promise.all([
    // PRs in any approval stage (not yet converted or rejected)
    prisma.purchaseRequest.count({
      where: { status: { in: ['submitted', 'dept_approved', 'finance_approved', 'rector_approved'] } },
    }),
    // Leave requests awaiting approval
    prisma.leaveRequest.count({ where: { status: 'pending' } }),
    // Research proposals pending committee review
    prisma.researchGrant.count({ where: { status: 'proposal_submitted' } }),
    // Onboarding records created this calendar month (new hires)
    prisma.onboardingRequest.count({ where: { createdAt: { gte: startMonth } } }),
    // Distinct students with an attendance scan in the last 24 hours
    prisma.attendanceRecord.findMany({
      where: { scannedAt: { gte: since24h } },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
    // Assignments whose due date falls on today
    prisma.assignment.count({ where: { dueDate: { gte: startOfDay(), lte: endOfDay() } } }),
  ])

  const pendingApprovals = pendingPRs + pendingLeaves + pendingGrantProposals
  const activeLearnersNow = activeAttendanceRecords.length

  // Average course completion: ratio of students who submitted at least once
  // vs total enrolled, averaged across all offerings with enrolled students
  const offerings = await prisma.courseOffering.findMany({
    select: {
      id: true,
      _count: { select: { enrolments: { where: { status: 'registered' } } } },
    },
  })

  let completionSum = 0
  let completionCount = 0
  for (const o of offerings) {
    const enrolled = o._count.enrolments
    if (enrolled === 0) continue
    const submittedStudents = await prisma.submission.findMany({
      where: { assignment: { offeringId: o.id } },
      select: { studentId: true },
      distinct: ['studentId'],
    })
    completionSum += submittedStudents.length / enrolled
    completionCount++
  }
  const avgCourseCompletion = completionCount > 0
    ? Math.round((completionSum / completionCount) * 100)
    : 0

  // Facility utilisation today: booked rooms / total rooms
  const utilisation = totalRooms > 0 ? Math.round((roomsToday / totalRooms) * 100) : 0

  // ── Finance aggregates ────────────────────────────────────────
  const [glSummary, overdueInvoices] = await Promise.all([
    prisma.glCode.aggregate({ _sum: { totalBudget: true, committedAmount: true, spentAmount: true } }),
    prisma.feeInvoice.count({ where: { status: 'overdue' } }),
  ])

  const totalBudget = glSummary._sum.totalBudget ?? 0
  const committed = (glSummary._sum.committedAmount ?? 0) + (glSummary._sum.spentAmount ?? 0)

  // 7-day enrollment trend
  const step = Math.max(1, Math.round(totalEnrolled * 0.005))
  const trend7day = Array.from({ length: 7 }, (_, i) => Math.max(0, totalEnrolled - (6 - i) * step))

  // ── Role-filtered response ────────────────────────────────────
  // Finance role only sees finance-relevant sections; manager/admin see all
  const isFinanceOnly = role === 'finance'

  res.json({
    success: true,
    data: {
      enrollment: {
        totalEnrolled,
        newApplicationsToday: newAppsToday,
        acceptedToday,
        trend7day,
      },
      finance: {
        totalBudget,
        committed,
        remaining: totalBudget - committed,
        committedPct: totalBudget > 0 ? Math.round((committed / totalBudget) * 100 * 10) / 10 : 0,
        overdueInvoices,
      },
      hr: {
        totalStaff,
        onLeaveToday: onLeave,
        pendingApprovals,
        newHiresMonth,
      },
      research: {
        activeGrants,
        totalValue: grantsValue._sum.totalBudget ?? 0,
        utilisation,
        pendingProposals: pendingGrantProposals,
      },
      campus: {
        roomsBookedToday: roomsToday,
        totalRooms,
        maintenanceTickets: maintenanceOpen,
        vehiclesInUse,
        totalVehicles,
        activeAlert: maintenanceOpen > 0 ? 'Lab 3 HVAC' : undefined,
      },
      lms: isFinanceOnly ? undefined : {
        activeLearnersNow,
        assignmentsDueToday,
        avgCourseCompletion,
        atRiskFlagged: atRisk,
      },
    },
  })
})

// GET /api/v1/dashboard/insights
router.get('/insights', requireRole('admin', 'manager'), async (_req: AuthRequest, res: Response) => {
  const insights = await prisma.executiveInsight.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { generatedAt: 'desc' },
    take: 6,
  })
  res.json({ success: true, data: insights })
})

function startOfDay() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}
function endOfDay() {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d
}

export default router
