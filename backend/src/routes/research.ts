import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { upload } from '../lib/upload'

const router = Router()
router.use(authenticate)

// GET /api/v1/research/grants
router.get('/grants', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const role   = req.user!.role

  let where: any = {}
  // Lecturers see their own grants; managers/admin see all
  if (role === 'lecturer') {
    const staff = await prisma.staff.findUnique({ where: { userId } })
    if (staff) where = { principalInvestigatorId: staff.id }
  }

  const grants = await prisma.researchGrant.findMany({
    where,
    include: {
      pi: { include: { user: { select: { displayName: true } } } },
      department: { select: { name: true, code: true } },
    },
    orderBy: { submittedAt: 'desc' },
  })
  res.json({ success: true, data: grants })
})

// GET /api/v1/research/grants/:id
router.get('/grants/:id', async (req: AuthRequest, res: Response) => {
  const grant = await prisma.researchGrant.findUnique({
    where: { id: req.params.id },
    include: {
      pi: { include: { user: { select: { displayName: true } } } },
      department: true,
    },
  })
  if (!grant) { res.status(404).json({ success: false, message: 'Grant not found' }); return }
  res.json({ success: true, data: grant })
})

// GET /api/v1/research/stats
router.get('/stats', requireRole('manager', 'admin', 'finance'), async (_req: AuthRequest, res: Response) => {
  const [total, submitted, approved, rejected] = await Promise.all([
    prisma.researchGrant.count(),
    prisma.researchGrant.count({ where: { status: 'proposal_submitted' } }),
    prisma.researchGrant.count({ where: { status: 'approved' } }),
    prisma.researchGrant.count({ where: { status: 'rejected' } }),
  ])
  const totalBudget = await prisma.researchGrant.aggregate({
    _sum: { totalBudget: true },
    where: { status: 'approved' },
  })
  res.json({ success: true, data: { total, submitted, approved, rejected, approvedBudget: totalBudget._sum.totalBudget ?? 0 } })
})

// POST /api/v1/research/grants  (lecturers submit)
router.post('/grants', requireRole('lecturer', 'admin'), upload.array('files', 10), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const { title, abstract, durationMonths, totalBudget, departmentId } = req.body
  const files = req.files as Express.Multer.File[] || []

  const staff = await prisma.staff.findUnique({ where: { userId } })
  if (!staff) { res.status(404).json({ success: false, message: 'Staff record not found' }); return }

  const year = new Date().getFullYear()
  const seq  = String(Math.floor(Math.random() * 90000) + 10000)
  const referenceNo = `RG-${year}-${seq}`

  // Create research grant
  const grant = await prisma.researchGrant.create({
    data: {
      referenceNo,
      title,
      principalInvestigatorId: staff.id,
      departmentId: departmentId ?? staff.departmentId,
      abstract,
      durationMonths: Number(durationMonths),
      totalBudget: Number(totalBudget),
      status: 'proposal_submitted',
      submittedAt: new Date(),
    },
  })

  // Create file assets for uploaded files
  if (files.length > 0) {
    const fileAssets = []
    for (const file of files) {
      const asset = await prisma.fileAsset.create({
        data: {
          fileName: file.filename,
          originalName: file.originalname,
          fileUrl: `/uploads/submissions/${file.filename}`,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          uploadedById: userId,
        },
      })
      
      // Associate file with research grant
      await prisma.researchGrantFile.create({
        data: {
          researchGrantId: grant.id,
          fileAssetId: asset.id,
        },
      })
      
      fileAssets.push(asset)
    }
  }

  res.json({ success: true, data: grant, message: `Grant proposal submitted. Reference: ${referenceNo}` })
})

// PATCH /api/v1/research/grants/:id/review  (L1: dept head)
router.patch('/grants/:id/review', requireRole('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body as { action: 'dept_approved' | 'rejected'; remarks?: string }
  const userId = req.user!.userId

  const grant = await prisma.researchGrant.findUnique({ where: { id: req.params.id } })
  if (!grant) { res.status(404).json({ success: false, message: 'Grant not found' }); return }

  const updated = await prisma.researchGrant.update({
    where: { id: req.params.id },
    data: {
      status:      action === 'dept_approved' ? 'dept_approved' : 'rejected',
      l1DeptHeadId: userId,
      l1ActedAt:   new Date(),
      l1Remarks:   remarks,
    },
  })

  res.json({ success: true, data: updated, message: `Grant ${action} by department head` })
})

// PATCH /api/v1/research/grants/:id/finance  (L3: finance approve)
router.patch('/grants/:id/finance', requireRole('finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body as { action: 'approved' | 'rejected'; remarks?: string }
  const userId = req.user!.userId

  const grant = await prisma.researchGrant.findUnique({ where: { id: req.params.id } })
  if (!grant) { res.status(404).json({ success: false, message: 'Grant not found' }); return }

  const updated = await prisma.researchGrant.update({
    where: { id: req.params.id },
    data: {
      status:                action,
      l3FinanceApprovedById: userId,
      l3ActedAt:             new Date(),
      l3Remarks:             remarks,
    },
  })

  res.json({ success: true, data: updated, message: `Grant ${action} by finance` })
})

export default router
