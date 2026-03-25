import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/procurement/pr
router.get('/pr', async (req: AuthRequest, res: Response) => {
  const { status, page = '1', pageSize = '20' } = req.query as Record<string, string>
  const skip = (parseInt(page) - 1) * parseInt(pageSize)

  const where = status ? { status } : {}
  const [items, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      include: {
        requestor: { include: { user: { select: { displayName: true } } } },
        department: true,
        glCode: true,
        quotes: true,
        approvals: { include: { approver: { select: { displayName: true } } } },
        anomalies: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(pageSize),
    }),
    prisma.purchaseRequest.count({ where }),
  ])

  res.json({ success: true, data: items, total, page: parseInt(page), pageSize: parseInt(pageSize) })
})

// GET /api/v1/procurement/pr/:id
router.get('/pr/:id', async (req: AuthRequest, res: Response) => {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: req.params.id },
    include: {
      requestor: { include: { user: true, department: true } },
      department: true,
      glCode: true,
      quotes: { include: { vendor: true } },
      approvals: { include: { approver: { select: { displayName: true, role: true } } } },
      recommendedVendor: true,
      anomalies: true,
      po: true,
    },
  })
  if (!pr) { res.status(404).json({ success: false, message: 'PR not found' }); return }
  res.json({ success: true, data: pr })
})

// POST /api/v1/procurement/pr
router.post('/pr', requireRole('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const body = req.body as {
    itemDescription: string; quantity: number; estimatedUnitPrice: number
    glCodeId: string; requiredByDate: string; departmentId: string; itemCategoryId?: string
  }

  // Get requestor staff record
  const staff = await prisma.staff.findUnique({ where: { userId: req.user!.userId } })
  if (!staff) { res.status(400).json({ success: false, message: 'Staff record not found' }); return }

  const totalAmount = body.quantity * body.estimatedUnitPrice

  if (totalAmount >= 2000) {
    res.status(400).json({ success: false, message: 'Use Tender process for amounts ≥ BND 2,000' })
    return
  }

  // Check GL budget
  const gl = await prisma.glCode.findUnique({ where: { id: body.glCodeId } })
  if (!gl) { res.status(400).json({ success: false, message: 'GL code not found' }); return }
  const available = gl.totalBudget - gl.committedAmount - gl.spentAmount
  if (available < totalAmount) {
    res.status(400).json({ success: false, message: `Insufficient budget. Available: BND ${available.toFixed(2)}` })
    return
  }

  const year = new Date().getFullYear()
  const count = await prisma.purchaseRequest.count()
  const prNumber = `PR-${year}-${String(count + 1).padStart(4, '0')}`

  const pr = await prisma.purchaseRequest.create({
    data: {
      prNumber,
      requestorId: staff.id,
      departmentId: body.departmentId ?? staff.departmentId,
      itemCategoryId: body.itemCategoryId,
      itemDescription: body.itemDescription,
      quantity: body.quantity,
      estimatedUnitPrice: body.estimatedUnitPrice,
      totalAmount,
      glCodeId: body.glCodeId,
      requiredByDate: new Date(body.requiredByDate),
      quoteTrafficLight: 'red',
      status: 'submitted',
      submittedAt: new Date(),
    },
  })

  res.status(201).json({ success: true, data: pr, message: 'Purchase Request submitted' })
})

// POST /api/v1/procurement/pr/:id/approve
router.post('/pr/:id/approve', requireRole('manager', 'finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const { remarks, signatureData } = req.body as { remarks?: string; signatureData?: string }

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: req.params.id },
    include: { approvals: true, glCode: true },
  })
  if (!pr) { res.status(404).json({ success: false, message: 'PR not found' }); return }

  const role = req.user!.role
  const approvalLevel = role === 'manager' ? 1 : role === 'finance' ? 2 : 3

  // Create e-signature if provided
  let esigId: string | undefined
  if (signatureData) {
    const sig = await prisma.esignature.create({
      data: { userId: req.user!.userId, signatureData, ipAddress: req.ip },
    })
    esigId = sig.id
  }

  await prisma.prApproval.create({
    data: {
      prId: pr.id,
      level: approvalLevel,
      approverId: req.user!.userId,
      action: 'approved',
      remarks,
      esignatureId: esigId,
    },
  })

  // Advance status
  const nextStatus =
    approvalLevel === 1 ? 'dept_approved' :
    approvalLevel === 2 ? 'finance_approved' : 'rector_approved'

  await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { status: nextStatus } })

  // If fully approved → auto-generate PO
  if (nextStatus === 'rector_approved' || (pr.totalAmount < 500 && nextStatus === 'finance_approved')) {
    await generatePO(pr)
    // Commit GL budget
    await prisma.glCode.update({
      where: { id: pr.glCodeId },
      data: { committedAmount: { increment: pr.totalAmount } },
    })
  }

  res.json({ success: true, message: `PR approved at Level ${approvalLevel}` })
})

// POST /api/v1/procurement/pr/:id/reject
router.post('/pr/:id/reject', requireRole('manager', 'finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const { remarks } = req.body as { remarks: string }
  const role = req.user!.role
  const approvalLevel = role === 'manager' ? 1 : role === 'finance' ? 2 : 3

  await prisma.$transaction([
    prisma.prApproval.create({
      data: { prId: req.params.id, level: approvalLevel, approverId: req.user!.userId, action: 'rejected', remarks },
    }),
    prisma.purchaseRequest.update({ where: { id: req.params.id }, data: { status: 'rejected' } }),
  ])
  res.json({ success: true, message: 'PR rejected' })
})

// GET /api/v1/procurement/approval-inbox
router.get('/approval-inbox', requireRole('manager', 'finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const role = req.user!.role
  const pendingStatus = role === 'manager' ? 'submitted' : role === 'finance' ? 'dept_approved' : 'finance_approved'

  const items = await prisma.purchaseRequest.findMany({
    where: { status: pendingStatus },
    include: {
      requestor: { include: { user: { select: { displayName: true } } } },
      department: true,
      glCode: true,
      quotes: true,
      anomalies: true,
    },
    orderBy: { submittedAt: 'asc' },
  })
  res.json({ success: true, data: items })
})

// GET /api/v1/procurement/anomalies
router.get('/anomalies', requireRole('finance', 'admin'), async (_req, res: Response) => {
  const anomalies = await prisma.procurementAnomaly.findMany({
    include: {
      pr: {
        include: {
          requestor: { include: { user: { select: { displayName: true } } } },
          department: true,
        },
      },
    },
    orderBy: { detectedAt: 'desc' },
  })
  res.json({ success: true, data: anomalies })
})

async function generatePO(pr: any) {
  const year = new Date().getFullYear()
  const count = await prisma.purchaseOrder.count()
  const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`

  if (!pr.recommendedVendorId) return

  await prisma.purchaseOrder.create({
    data: {
      poNumber,
      prId: pr.id,
      vendorId: pr.recommendedVendorId,
      totalAmount: pr.totalAmount,
      glCodeId: pr.glCodeId,
      status: 'issued',
    },
  })

  await prisma.purchaseRequest.update({
    where: { id: pr.id },
    data: { status: 'converted_to_po' },
  })
}

export default router
