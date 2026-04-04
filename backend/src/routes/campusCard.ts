import { Router, Response } from 'express'
import { prisma } from '@/lib/prisma'
import { AuthRequest, authenticate } from '@/middleware/auth'
import { z } from 'zod'

const router = Router()

router.get('/my-card', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId

  const student = await prisma.student.findUnique({
    where: { userId },
  })

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' })
  }

  const studentId = student.id

  let card = await prisma.campusCard.findUnique({
    where: { studentId },
    include: {
      student: {
        select: {
          studentId: true,
          user: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!card) {
    card = await prisma.campusCard.create({
      data: {
        studentId,
        balance: 0,
        status: 'active',
      },
      include: {
        student: {
          select: {
            studentId: true,
            user: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        },
        transactions: true,
      },
    })
  }

  res.json({ success: true, data: card })
})

router.post('/top-up', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const { amount, method } = req.body

  const student = await prisma.student.findUnique({
    where: { userId },
  })

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' })
  }

  const studentId = student.id

  const schema = z.object({
    amount: z.number().positive().min(10).max(1000),
    method: z.enum(['credit_card', 'debit_card', 'bank_transfer', 'cash']),
  })

  const parsed = schema.safeParse({ amount, method })
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.errors })
  }

  const card = await prisma.campusCard.findUnique({ where: { studentId } })
  if (!card) {
    return res.status(404).json({ success: false, message: 'Campus card not found' })
  }

  if (card.status !== 'active') {
    return res.status(400).json({ success: false, message: 'Campus card is not active' })
  }

  const newBalance = card.balance + amount

  const [transaction] = await prisma.$transaction([
    prisma.campusCardTransaction.create({
      data: {
        cardId: card.id,
        type: 'top_up',
        amount,
        description: `Top up via ${method}`,
        balanceAfter: newBalance,
      },
    }),
    prisma.campusCard.update({
      where: { id: card.id },
      data: { balance: newBalance },
    }),
  ])

  await prisma.notification.create({
    data: {
      userId: student.userId,
      subject: 'Campus Card Top Up Successful',
      body: `
💳 Campus Card Top Up Successful!

Your campus card has been topped up successfully.

💰 Transaction Details:
• Amount: BND ${amount.toFixed(2)}
• Payment Method: ${method.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
• New Balance: BND ${newBalance.toFixed(2)}
• Date: ${new Date().toLocaleDateString()}
• Time: ${new Date().toLocaleTimeString()}

📊 Balance Check:
• Student Portal > Campus Services > Campus Card
• Any card reader terminal on campus

🏪 Where to Use:
• Cafeteria and food courts
• Campus bookshop
• Printing and photocopying services
• Parking fees

📞 Need Help?
• Finance Office: +673-2461-002
• Email: finance@unissa.edu.bn

Thank you for using Campus Card services! 🎓
      `.trim(),
      type: 'success',
      isRead: false,
    },
  })

  res.json({
    success: true,
    data: {
      transaction,
      newBalance,
    },
  })
})

router.get('/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const { limit = '50', offset = '0' } = req.query

  const student = await prisma.student.findUnique({
    where: { userId },
  })

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' })
  }

  const studentId = student.id

  const card = await prisma.campusCard.findUnique({ where: { studentId } })
  if (!card) {
    return res.status(404).json({ success: false, message: 'Campus card not found' })
  }

  const transactions = await prisma.campusCardTransaction.findMany({
    where: { cardId: card.id },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string, 10),
    skip: parseInt(offset as string, 10),
  })

  const total = await prisma.campusCardTransaction.count({
    where: { cardId: card.id },
  })

  res.json({
    success: true,
    data: {
      transactions,
      total,
      balance: card.balance,
    },
  })
})

export default router
