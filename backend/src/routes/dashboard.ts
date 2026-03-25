import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/dashboard/kpi
router.get('/kpi', requireRole('admin', 'manager', 'finance'), async (_req: AuthRequest, res: Response) => {
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

  const [glSummary, overdueInvoices] = await Promise.all([
    prisma.glCode.aggregate({ _sum: { totalBudget: true, committedAmount: true, spentAmount: true } }),
    prisma.feeInvoice.count({ where: { status: 'overdue' } }),
  ])

  const totalBudget = glSummary._sum.totalBudget ?? 0
  const committed = (glSummary._sum.committedAmount ?? 0) + (glSummary._sum.spentAmount ?? 0)

  // 7-day enrollment trend (stub)
  const trend7day = [1190, 1195, 1198, 1200, 1201, 1203, totalEnrolled]

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
        pendingApprovals: 4,
        newHiresMonth: 2,
      },
      research: {
        activeGrants,
        totalValue: grantsValue._sum.totalBudget ?? 0,
        utilisation: 38,
        pendingProposals: 5,
      },
      campus: {
        roomsBookedToday: roomsToday,
        totalRooms,
        maintenanceTickets: maintenanceOpen,
        vehiclesInUse,
        totalVehicles,
        activeAlert: maintenanceOpen > 0 ? 'Lab 3 HVAC' : undefined,
      },
      lms: {
        activeLearnersNow: 89,
        assignmentsDueToday: 14,
        avgCourseCompletion: 82,
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
