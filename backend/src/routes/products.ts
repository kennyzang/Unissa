import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/products  – list all active products (all authenticated users)
router.get('/', async (_req: AuthRequest, res: Response) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  })
  res.json({ success: true, data: products })
})

// GET /api/v1/products/all  – list all products including inactive (manager/admin)
router.get('/all', requireRole('manager', 'finance', 'admin'), async (_req: AuthRequest, res: Response) => {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  })
  res.json({ success: true, data: products })
})

// GET /api/v1/products/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { category: true },
  })
  if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return }
  res.json({ success: true, data: product })
})

// POST /api/v1/products  – create product (manager/admin)
router.post('/', requireRole('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { code, name, description, unit, defaultUnitPrice, categoryId } = req.body as {
    code: string; name: string; description?: string; unit?: string
    defaultUnitPrice: number; categoryId?: string
  }

  if (!code || !name || !defaultUnitPrice) {
    res.status(400).json({ success: false, message: 'code, name and defaultUnitPrice are required' })
    return
  }

  const existing = await prisma.product.findUnique({ where: { code } })
  if (existing) {
    res.status(409).json({ success: false, message: `Product code "${code}" already exists` })
    return
  }

  const product = await prisma.product.create({
    data: { code, name, description, unit: unit ?? 'pcs', defaultUnitPrice, categoryId },
    include: { category: true },
  })
  res.status(201).json({ success: true, data: product, message: 'Product created' })
})

// PUT /api/v1/products/:id  – update product (manager/admin)
router.put('/:id', requireRole('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { name, description, unit, defaultUnitPrice, categoryId } = req.body as {
    name?: string; description?: string; unit?: string; defaultUnitPrice?: number; categoryId?: string
  }

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { name, description, unit, defaultUnitPrice, categoryId },
    include: { category: true },
  })
  res.json({ success: true, data: product, message: 'Product updated' })
})

// PATCH /api/v1/products/:id/toggle  – toggle active status (admin)
router.patch('/:id/toggle', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return }

  const updated = await prisma.product.update({
    where: { id: req.params.id },
    data: { isActive: !product.isActive },
  })
  res.json({ success: true, data: updated, message: `Product ${updated.isActive ? 'activated' : 'deactivated'}` })
})

export default router
