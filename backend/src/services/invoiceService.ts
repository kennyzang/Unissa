import PDFDocument from 'pdfkit'
import { FeeInvoice, Student, Semester, Payment } from '@prisma/client'

interface InvoiceWithDetails extends FeeInvoice {
  student: Student & { user: { displayName: string; email: string } }
  semester: Semester
  payments: Payment[]
}

export const generateInvoicePDF = async (invoice: InvoiceWithDetails): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const { student, semester, payments } = invoice

    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'center' })
    doc.moveDown()

    doc.fontSize(12).font('Helvetica')
    doc.text('UNISSA - Universiti Islam Sultan Sharif Ali', { align: 'center' })
    doc.text('Bandar Seri Begawan, Brunei Darussalam', { align: 'center' })
    doc.moveDown()

    doc.fontSize(10).font('Helvetica')
    doc.text(`Invoice No: ${invoice.invoiceNo}`, { align: 'right' })
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, { align: 'right' })
    doc.moveDown()

    doc.fontSize(12).font('Helvetica-Bold').text('Bill To:')
    doc.fontSize(10).font('Helvetica')
    doc.text(student.user.displayName)
    doc.text(`Student ID: ${student.studentId}`)
    doc.text(student.user.email)
    doc.moveDown()

    doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details:')
    doc.fontSize(10).font('Helvetica')
    doc.text(`Semester: ${semester.name}`)
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-GB')}`)
    doc.text(`Status: ${invoice.status.toUpperCase()}`)
    doc.moveDown()

    const tableTop = doc.y
    const tableLeft = 50
    const tableWidth = 495
    const rowHeight = 25

    doc.fontSize(10).font('Helvetica-Bold')
    doc.rect(tableLeft, tableTop, tableWidth, rowHeight).fillAndStroke('#f0f0f0', '#000000')
    doc.fillColor('#000000')
    doc.text('Description', tableLeft + 5, tableTop + 8, { width: 300 })
    doc.text('Amount (BND)', tableLeft + 310, tableTop + 8, { width: 180, align: 'right' })

    let currentY = tableTop + rowHeight
    const items = [
      { description: 'Tuition Fee', amount: invoice.tuitionFee },
      { description: 'Library Fee', amount: invoice.libraryFee },
    ]

    if (invoice.hostelDeposit > 0) {
      items.push({ description: 'Hostel Deposit', amount: invoice.hostelDeposit })
    }

    if (invoice.scholarshipDeduction > 0) {
      items.push({ description: 'Scholarship Deduction', amount: -invoice.scholarshipDeduction })
    }

    items.forEach(item => {
      doc.fontSize(10).font('Helvetica')
      doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke()
      doc.text(item.description, tableLeft + 5, currentY + 8, { width: 300 })
      doc.text(`${item.amount >= 0 ? '' : '-'}BND ${Math.abs(item.amount).toLocaleString()}`, tableLeft + 310, currentY + 8, { width: 180, align: 'right' })
      currentY += rowHeight
    })

    currentY += 10
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('Total Amount:', tableLeft + 310, currentY, { width: 180, align: 'right' })
    doc.text(`BND ${invoice.totalAmount.toLocaleString()}`, tableLeft + 310, currentY + 15, { width: 180, align: 'right' })

    currentY += 30
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('Payment Summary:', tableLeft, currentY)
    currentY += 15
    doc.fontSize(10).font('Helvetica')
    doc.text(`Amount Paid: BND ${invoice.amountPaid.toLocaleString()}`, tableLeft, currentY)
    currentY += 15
    doc.text(`Outstanding Balance: BND ${invoice.outstandingBalance.toLocaleString()}`, tableLeft, currentY)

    if (payments.length > 0) {
      currentY += 25
      doc.fontSize(10).font('Helvetica-Bold').text('Payment History:')
      currentY += 15
      payments.forEach((payment, index) => {
        doc.fontSize(9).font('Helvetica')
        doc.text(`${index + 1}. ${payment.transactionRef} - BND ${payment.amount.toLocaleString()} (${payment.status})`, tableLeft, currentY)
        doc.text(`   Method: ${payment.method}${payment.cardLast4 ? ` (**** ${payment.cardLast4})` : ''}`, tableLeft, currentY + 12)
        if (payment.paidAt) {
          doc.text(`   Date: ${new Date(payment.paidAt).toLocaleDateString('en-GB')}`, tableLeft, currentY + 24)
        }
        currentY += 35
      })
    }

    currentY += 20
    doc.fontSize(8).font('Helvetica').fillColor('#666666')
    doc.text('This is a computer-generated invoice. No signature is required.', { align: 'center' })
    doc.text('For inquiries, please contact finance@unissa.edu.bn', { align: 'center' })

    doc.end()
  })
}