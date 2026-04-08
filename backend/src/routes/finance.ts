import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { generateInvoicePDF } from '../services/invoiceService'

const router = Router()
router.use(authenticate)

async function createNotification(userId: string, subject: string, body: string, type: string = 'info') {
  await prisma.notification.create({
    data: {
      userId,
      subject,
      body,
      type,
      isRead: false,
    },
  })
}

async function activateStudentServices(studentId: string, userId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { libraryAccount: true, campusCard: true },
  })

  if (!student) return

  const notifications: Promise<void>[] = []

  if (!student.libraryAccount) {
    await prisma.libraryAccount.create({
      data: {
        studentId,
        accountNo: `LIB-${student.studentId}`,
        isActive: true,
        activatedAt: new Date(),
        booksBorrowed: 0,
        maxBorrow: 10,
      },
    })
    
    const libraryGuide = `
📚 Library Account Activated Successfully!

Your library account has been activated. Here's how to use the library services:

📖 Borrowing Books:
• Present your student ID at the library counter
• Maximum 10 books can be borrowed at a time
• Loan period: 14 days (renewable once)
• Renew online via Student Portal > Library

🔍 Online Resources:
• Access e-books and journals via library.unissa.edu.bn
• Use your student ID to login

⏰ Library Hours:
• Monday-Friday: 8:00 AM - 9:00 PM
• Saturday: 9:00 AM - 5:00 PM
• Sunday: Closed

📞 Need Help?
• Library Help Desk: +673-2461-001
• Email: library@unissa.edu.bn

Happy reading! 🎓
    `.trim()
    
    notifications.push(
      createNotification(
        userId,
        'Library Account Activated',
        libraryGuide,
        'success'
      )
    )
  }

  if (!student.campusCard) {
    await prisma.campusCard.create({
      data: {
        studentId,
        balance: 0,
        status: 'active',
      },
    })
    
    const campusCardGuide = `
💳 Campus Card Activated Successfully!

Your campus card has been activated. Here's how to use it:

💰 Top-up Your Card:
• Visit the Finance Office (Building A, Ground Floor)
• Use the self-service kiosks around campus
• Top-up online via Student Portal > Campus Card

🏪 Where to Use:
• Cafeteria and food courts
• Campus bookshop
• Printing and photocopying services
• Parking fees

🔒 Security Tips:
• Keep your card safe at all times
• Report lost cards immediately to Finance Office
• Maximum balance: BND 500

📊 Check Balance:
• Student Portal > Campus Services > Campus Card
• Any card reader terminal

📞 Need Help?
• Finance Office: +673-2461-002
• Email: finance@unissa.edu.bn

Welcome to cashless campus life! 🎓
    `.trim()
    
    notifications.push(
      createNotification(
        userId,
        'Campus Card Activated',
        campusCardGuide,
        'success'
      )
    )
  }

  await Promise.all(notifications)
}

// GET /api/v1/finance/invoices/:studentId
// GET /api/v1/finance/students-search?q=noor  (finance/admin only)
router.get('/students-search', requireRole('finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const q = String(req.query.q ?? '').trim()
  const students = await prisma.student.findMany({
    where: q ? {
      OR: [
        { user: { displayName: { contains: q } } },
        { studentId: { contains: q } },
      ],
    } : {},
    select: {
      id: true,
      studentId: true,
      user: { select: { displayName: true } },
      programme: { select: { name: true } },
    },
    take: 20,
    orderBy: { studentId: 'asc' },
  })
  res.json({ success: true, data: students })
})

router.get('/invoices/:studentId', async (req: AuthRequest, res: Response) => {
  const studentId = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: studentId }, { studentId: studentId }] },
  })
  if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

  const invoices = await prisma.feeInvoice.findMany({
    where: { studentId: student.id },
    include: { semester: true, payments: true },
    orderBy: { generatedAt: 'desc' },
  })
  res.json({ success: true, data: invoices })
})

// GET /api/v1/finance/invoices/:invoiceId/pdf
router.get('/invoices/:invoiceId/pdf', async (req: AuthRequest, res: Response) => {
  const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId
  const invoice = await prisma.feeInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      student: { include: { user: true } },
      semester: true,
      payments: true,
    },
  })

  if (!invoice) {
    res.status(404).json({ success: false, message: 'Invoice not found' })
    return
  }

  if (invoice.status !== 'paid') {
    res.status(403).json({ success: false, message: 'Invoice can only be downloaded after payment is completed.' })
    return
  }

  try {
    const pdfBuffer = await generateInvoicePDF(invoice as any)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`)
    res.send(pdfBuffer)
  } catch (error) {
    console.error('Error generating PDF:', error)
    res.status(500).json({ success: false, message: 'Failed to generate PDF' })
  }
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

  const VALID_METHODS = ['card', 'online_banking', 'e_wallet', 'qr_pay', 'bank_transfer']
  if (!VALID_METHODS.includes(method)) {
    res.status(400).json({ success: false, message: `Invalid payment method: ${method}` }); return
  }

  const amount = invoice.outstandingBalance
  const txRef = `TXN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`

  // Demo: decline card 4000 0000 0000 0002
  const last4 = cardNumber?.replace(/\s/g, '').slice(-4)
  const isDeclined = method === 'card' && cardNumber?.replace(/\s/g, '') === '4000000000000002'

  if (isDeclined) {
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

  const cardBrand = method === 'card' ? detectCardBrand(cardNumber) : undefined

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        transactionRef: txRef,
        invoiceId,
        amount,
        method,
        cardLast4: method === 'card' ? last4 : undefined,
        cardBrand,
        bankName: ['online_banking', 'bank_transfer'].includes(method) ? bankName : undefined,
        status: 'success',
        paidAt: new Date(),
      },
    }),
    prisma.feeInvoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', amountPaid: amount, outstandingBalance: 0 },
    }),
  ])

  const methodLabel: Record<string, string> = {
    card: 'Credit/Debit Card', online_banking: 'Online Banking',
    e_wallet: 'E-Wallet', qr_pay: 'QR Pay', bank_transfer: 'Bank Transfer',
  }

  const student = await prisma.student.findUnique({
    where: { id: invoice.studentId },
    select: { userId: true },
  })

  if (student) {
    const paymentGuide = `
✅ Payment Successful!

Your tuition fee payment has been processed successfully.

💰 Payment Details:
• Amount: BND ${amount.toFixed(2)}
• Method: ${methodLabel[method] ?? method}
• Transaction Ref: ${txRef}
• Invoice No: ${invoice.invoiceNo}
• Date: ${new Date().toLocaleDateString()}

📄 Receipt:
• Download your receipt from Student Portal > Finance > Payment History

🎓 Next Steps:
• Your enrollment is now confirmed
• Check your registered courses in Student Portal
• Library and Campus Card services will be activated automatically

📞 Questions?
• Finance Office: +673-2461-002
• Email: finance@unissa.edu.bn

Thank you for your payment! 🎓
    `.trim()
    
    await createNotification(
      student.userId,
      'Payment Successful',
      paymentGuide,
      'success'
    )

    await activateStudentServices(invoice.studentId, student.userId)
  }

  res.json({
    success: true,
    data: { payment, transactionRef: txRef, amount },
    message: `Payment via ${methodLabel[method] ?? method} successful`,
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

// GET /api/v1/finance/gl-codes/:id/purchase-requests
router.get('/gl-codes/:id/purchase-requests', requireRole('finance', 'admin', 'manager'), async (req, res: Response) => {
  const id = String(req.params.id)
  const prs = await prisma.purchaseRequest.findMany({
    where: { glCodeId: id },
    include: { requestor: { select: { fullName: true } } },
    orderBy: { submittedAt: 'desc' },
  })
  res.json({
    success: true,
    data: prs.map(pr => ({
      id: pr.id,
      title: pr.itemDescription,
      amount: pr.totalAmount,
      status: pr.status,
      requester: pr.requestor?.fullName ?? '—',
      submittedAt: pr.submittedAt,
    })),
  })
})

// ── Payroll Management ────────────────────────────────────────

// GET /api/v1/finance/payroll  (list records, optionally filtered by month)
router.get('/payroll', requireRole('finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const { month, status, search } = req.query as Record<string, string>

  const where: any = {}
  if (month) {
    const d = new Date(month)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    where.payrollMonth = { gte: start, lte: end }
  }
  if (status && status !== 'all') where.status = status

  const records = await prisma.payrollRecord.findMany({
    where,
    include: {
      staff: {
        include: {
          user:       { select: { displayName: true } },
          department: { select: { name: true, code: true } },
        },
      },
    },
    orderBy: [{ payrollMonth: 'desc' }, { createdAt: 'asc' }],
  })

  const filtered = search
    ? records.filter(r =>
        r.staff.fullName.toLowerCase().includes(search.toLowerCase()) ||
        r.staff.staffId.toLowerCase().includes(search.toLowerCase()) ||
        r.staff.department.name.toLowerCase().includes(search.toLowerCase())
      )
    : records

  res.json({ success: true, data: filtered })
})

// GET /api/v1/finance/payroll/summary  (aggregate stats for a given month)
router.get('/payroll/summary', requireRole('finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const { month } = req.query as Record<string, string>

  const where: any = {}
  if (month) {
    const d = new Date(month)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    where.payrollMonth = { gte: start, lte: end }
  }

  const [agg, paidCount, draftCount, totalStaff] = await Promise.all([
    prisma.payrollRecord.aggregate({
      where,
      _sum: { basicSalary: true, allowances: true, deductions: true, netSalary: true },
      _count: { id: true },
    }),
    prisma.payrollRecord.count({ where: { ...where, status: 'paid' } }),
    prisma.payrollRecord.count({ where: { ...where, status: 'draft' } }),
    prisma.staff.count({ where: { status: 'active' } }),
  ])

  res.json({
    success: true,
    data: {
      totalRecords:   agg._count.id,
      totalBasic:     agg._sum.basicSalary  ?? 0,
      totalAllowances:agg._sum.allowances   ?? 0,
      totalDeductions:agg._sum.deductions   ?? 0,
      totalNetSalary: agg._sum.netSalary    ?? 0,
      paidCount,
      draftCount,
      totalStaff,
    },
  })
})

// POST /api/v1/finance/payroll/generate  (create draft records for all active staff for a month)
router.post('/payroll/generate', requireRole('finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const { month } = req.body as { month: string }
  if (!month) { res.status(400).json({ success: false, message: 'month is required (YYYY-MM-DD)' }); return }

  const d = new Date(month)
  const payrollMonth = new Date(d.getFullYear(), d.getMonth(), 1)

  const staff = await prisma.staff.findMany({
    where: { status: 'active' },
    select: { id: true, payrollBasicSalary: true },
  })

  if (staff.length === 0) {
    res.status(400).json({ success: false, message: 'No active staff found' }); return
  }

  let created = 0
  let skipped = 0

  for (const s of staff) {
    // Brunei statutory deductions: TAP 5% + SCP 3.5% = 8.5% of basic salary
    const deductions  = parseFloat((s.payrollBasicSalary * 0.085).toFixed(2))
    const netSalary   = parseFloat((s.payrollBasicSalary - deductions).toFixed(2))

    const existing = await prisma.payrollRecord.findUnique({
      where: { staffId_payrollMonth: { staffId: s.id, payrollMonth } },
    })

    if (existing) { skipped++; continue }

    await prisma.payrollRecord.create({
      data: {
        staffId:      s.id,
        payrollMonth,
        basicSalary:  s.payrollBasicSalary,
        allowances:   0,
        deductions,
        netSalary,
        status:       'draft',
      },
    })
    created++
  }

  res.json({
    success: true,
    message: `Payroll generated: ${created} records created, ${skipped} already existed.`,
    data: { created, skipped, month: payrollMonth },
  })
})

// PUT /api/v1/finance/payroll/:id  (update allowances / deductions)
router.put('/payroll/:id', requireRole('finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const { allowances, deductions } = req.body as { allowances: number; deductions: number }
  const id = String(req.params.id)

  const record = await prisma.payrollRecord.findUnique({ where: { id } })
  if (!record) { res.status(404).json({ success: false, message: 'Payroll record not found' }); return }
  if (record.status === 'paid') {
    res.status(400).json({ success: false, message: 'Cannot edit a paid payroll record' }); return
  }

  const a = typeof allowances === 'number' ? allowances : record.allowances
  const d = typeof deductions === 'number' ? deductions : record.deductions
  const netSalary = parseFloat((record.basicSalary + a - d).toFixed(2))

  const updated = await prisma.payrollRecord.update({
    where: { id },
    data:  { allowances: a, deductions: d, netSalary },
    include: {
      staff: {
        include: {
          user:       { select: { displayName: true } },
          department: { select: { name: true } },
        },
      },
    },
  })

  res.json({ success: true, data: updated, message: 'Payroll record updated' })
})

// PATCH /api/v1/finance/payroll/:id/pay  (mark single record as paid)
router.patch('/payroll/:id/pay', requireRole('finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id)
  const record = await prisma.payrollRecord.findUnique({ where: { id } })
  if (!record) { res.status(404).json({ success: false, message: 'Payroll record not found' }); return }
  if (record.status === 'paid') {
    res.status(400).json({ success: false, message: 'Record already marked as paid' }); return
  }

  const updated = await prisma.payrollRecord.update({
    where: { id },
    data:  { status: 'paid', paidAt: new Date() },
    include: {
      staff: {
        include: {
          user:       { select: { displayName: true } },
          department: { select: { name: true } },
        },
      },
    },
  })

  res.json({ success: true, data: updated, message: 'Payroll record marked as paid' })
})

// POST /api/v1/finance/payroll/bulk-pay  (mark multiple draft records as paid)
router.post('/payroll/bulk-pay', requireRole('finance', 'admin'), async (req: AuthRequest, res: Response) => {
  const { ids } = req.body as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, message: 'ids array is required' }); return
  }

  const now = new Date()
  const result = await prisma.payrollRecord.updateMany({
    where: { id: { in: ids }, status: 'draft' },
    data:  { status: 'paid', paidAt: now },
  })

  res.json({
    success: true,
    message: `${result.count} payroll record(s) marked as paid`,
    data: { count: result.count },
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

router.get('/revenue-summary', requireRole('finance', 'admin'), async (_req, res: Response) => {
  const tuitionPayments = await prisma.payment.aggregate({
    where: { status: 'success' },
    _sum: { amount: true },
    _count: true,
  })

  const campusCardTopUps = await prisma.campusCardTransaction.aggregate({
    where: { type: 'top_up' },
    _sum: { amount: true },
    _count: true,
  })

  const recentTuitionPayments = await prisma.payment.findMany({
    where: { status: 'success' },
    include: {
      invoice: {
        include: {
          student: {
            include: {
              user: { select: { displayName: true } },
            },
          },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
    take: 5,
  })

  const recentCampusCardTopUps = await prisma.campusCardTransaction.findMany({
    where: { type: 'top_up' },
    include: {
      card: {
        include: {
          student: {
            include: {
              user: { select: { displayName: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const totalTuitionRevenue = tuitionPayments._sum.amount ?? 0
  const totalCampusCardRevenue = campusCardTopUps._sum.amount ?? 0
  const totalRevenue = totalTuitionRevenue + totalCampusCardRevenue

  res.json({
    success: true,
    data: {
      totalRevenue,
      tuitionRevenue: totalTuitionRevenue,
      campusCardRevenue: totalCampusCardRevenue,
      tuitionPaymentCount: tuitionPayments._count,
      campusCardTopUpCount: campusCardTopUps._count,
      recentTuitionPayments: recentTuitionPayments.map(p => ({
        id: p.id,
        transactionRef: p.transactionRef,
        amount: p.amount,
        method: p.method,
        paidAt: p.paidAt,
        studentName: p.invoice.student.user.displayName,
      })),
      recentCampusCardTopUps: recentCampusCardTopUps.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        createdAt: t.createdAt,
        studentName: t.card.student.user.displayName,
      })),
    },
  })
})

export default router
