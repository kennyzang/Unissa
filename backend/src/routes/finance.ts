import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/v1/finance/invoices/:studentId
router.get('/invoices/:studentId', async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: req.params.studentId }, { studentId: req.params.studentId }] },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  const invoices = await prisma.feeInvoice.findMany({
    where: { studentId: student.id },
    include: { semester: true, payments: true },
    orderBy: { generatedAt: 'desc' },
  })
  res.json({ success: true, data: invoices })
})

// POST /api/v1/finance/payments
router.post('/payments', async (req: AuthRequest, res: Response) => {
  const { invoiceId, method, cardNumber, cardExpiry, cardCvv, cardHolder, bankName } =
    req.body as Record<string, string>

  const invoice = await prisma.feeInvoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) { res.status(404).json({ success: false, message: 'Invoice not found' }); return }
  if (invoice.status === 'paid') {
    res.status(400).json({ success: false, message: 'Invoice already paid' }); return
  }

  // Simulate 2-second processing delay (by returning immediately with "processing" — real delay on client)
  const amount = invoice.outstandingBalance

  // Demo: decline card 4000 0000 0000 0002
  const last4 = cardNumber?.replace(/\s/g, '').slice(-4)
  const isDeclined = cardNumber?.replace(/\s/g, '') === '4000000000000002'

  if (isDeclined) {
    const txRef = `TXN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`
    await prisma.payment.create({
      data: {
        transactionRef: txRef,
        invoiceId,
        amount,
        method,
        cardLast4: last4,
        cardBrand: detectCardBrand(cardNumber),
        status: 'failed',
      },
    })
    res.status(400).json({ success: false, message: 'Card declined – Insufficient funds' }); return
  }

  const txRef = `TXN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`
  const cardBrand = detectCardBrand(cardNumber)

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        transactionRef: txRef,
        invoiceId,
        amount,
        method,
        cardLast4: last4,
        cardBrand,
        bankName: method === 'online_banking' ? bankName : undefined,
        status: 'success',
        paidAt: new Date(),
      },
    }),
    prisma.feeInvoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', amountPaid: amount, outstandingBalance: 0 },
    }),
  ])

  res.json({
    success: true,
    data: { payment, transactionRef: txRef, amount },
    message: 'Payment successful',
  })
})

// GET /api/v1/finance/budget-summary
router.get('/budget-summary', requireRole('finance', 'admin', 'manager'), async (_req, res: Response) => {
  const summary = await prisma.glCode.aggregate({
    _sum: { totalBudget: true, committedAmount: true, spentAmount: true },
  })
  const glCodes = await prisma.glCode.findMany({
    where: { isActive: true },
    include: { department: true },
    orderBy: { totalBudget: 'desc' },
  })
  res.json({
    success: true,
    data: {
      totalBudget: summary._sum.totalBudget ?? 0,
      committed: summary._sum.committedAmount ?? 0,
      spent: summary._sum.spentAmount ?? 0,
      glCodes: glCodes.map(g => ({
        ...g,
        availableBalance: g.totalBudget - g.committedAmount - g.spentAmount,
      })),
    },
  })
})

// GET /api/v1/finance/gl-codes
router.get('/gl-codes', async (_req, res: Response) => {
  const codes = await prisma.glCode.findMany({
    where: { isActive: true },
    include: { department: true },
    orderBy: { code: 'asc' },
  })
  res.json({
    success: true,
    data: codes.map(g => ({
      ...g,
      availableBalance: g.totalBudget - g.committedAmount - g.spentAmount,
    })),
  })
})

function detectCardBrand(cardNumber?: string): string | undefined {
  if (!cardNumber) return undefined
  const n = cardNumber.replace(/\s/g, '')
  if (n.startsWith('4')) return 'visa'
  if (n.startsWith('5')) return 'mastercard'
  if (n.startsWith('35')) return 'jcb'
  return undefined
}

export default router
