import PDFDocument from 'pdfkit'
import { Applicant, Programme, Intake, Semester, Department } from '@prisma/client'

interface OfferLetterData {
  applicant: Applicant
  programme: Programme & { department?: Department | null }
  intake: Intake & { semester?: Semester | null }
  offerRef: string
  offerDate: Date
  confirmDeadline: Date
}

export async function generateOfferLetterPDF(data: OfferLetterData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const { applicant, programme, intake, offerRef, offerDate, confirmDeadline } = data

    doc.fontSize(20).font('Helvetica-Bold').fillColor('#165DFF')
      .text('UNISSA', { align: 'center' })
    doc.fontSize(12).font('Helvetica').fillColor('#333333')
      .text('Universiti Islam Sultan Sharif Ali', { align: 'center' })
    doc.fontSize(10).fillColor('#666666')
      .text('Bandar Seri Begawan, Brunei Darussalam', { align: 'center' })
    doc.moveDown(0.5)
    
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#165DFF').lineWidth(2).stroke()
    doc.moveDown(1.5)

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
      .text('OFFER OF ADMISSION', { align: 'center' })
    doc.moveDown(1)

    doc.fontSize(10).font('Helvetica').fillColor('#333333')
    const rightColX = 350
    doc.text(`Offer Reference: ${offerRef}`, rightColX, doc.y, { align: 'left' })
    doc.text(`Date: ${formatDate(offerDate)}`, rightColX, doc.y + 15, { align: 'left' })
    doc.moveDown(1)

    doc.font('Helvetica').text(`Dear ${applicant.fullName},`)
    doc.moveDown(0.5)

    const intakeStart = intake.intakeStart 
      ? formatDate(intake.intakeStart, { month: 'long', year: 'numeric' })
      : 'the upcoming semester'

    const intakeName = intake.semester?.name || 'upcoming'

    doc.text(
      `We are pleased to offer you admission to the ${programme.name} programme ` +
      `for the ${intakeName} intake, commencing ${intakeStart}.`
    )
    doc.moveDown(0.5)

    doc.text('Congratulations on your successful application!')
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(11).text('Programme Details')
    doc.font('Helvetica').fontSize(10)
    doc.moveDown(0.3)

    const details = [
      ['Programme', programme.name],
      ['Programme Code', programme.code],
      ['Faculty', programme.department?.name || 'Faculty of Islamic Studies'],
      ['Mode of Study', (applicant.modeOfStudy || 'full_time').replace('_', ' ').toUpperCase()],
      ['Duration', `${programme.durationYears || 4} years`],
      ['Intake', intake.semester?.name || 'September 2026'],
    ]

    details.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}:`, 70, doc.y, { continued: true, width: 150 })
      doc.font('Helvetica').text(` ${value}`, { width: 350 })
    })

    doc.moveDown(1)
    doc.font('Helvetica-Bold').fontSize(11).text('Important Dates')
    doc.font('Helvetica').fontSize(10)
    doc.moveDown(0.3)

    const dates = [
      ['Semester Start', intake.intakeStart ? formatDate(intake.intakeStart) : 'To be announced'],
      ['Acceptance Deadline', formatDate(confirmDeadline)],
      ['Registration Period', 'To be announced via email'],
    ]

    dates.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}:`, 70, doc.y, { continued: true, width: 150 })
      doc.font('Helvetica').text(` ${value}`, { width: 350 })
    })

    doc.moveDown(1)
    doc.font('Helvetica-Bold').fontSize(11).text('Next Steps')
    doc.font('Helvetica').fontSize(10)
    doc.moveDown(0.3)

    const steps = [
      'Log in to the UNISSA Student Portal using your credentials',
      'Accept this offer before the deadline stated above',
      'Complete your course registration',
      'Pay your tuition fees before the due date',
    ]

    steps.forEach((step, i) => {
      doc.text(`${i + 1}. ${step}`, 70, doc.y)
    })

    doc.moveDown(1)
    doc.text(
      'If you have any questions or require assistance, please contact the Admissions Office ' +
      'at admissions@unissa.edu.bn or call +673-2-123456.'
    )
    doc.moveDown(1.5)

    doc.font('Helvetica-Bold').text('We look forward to welcoming you to UNISSA!')
    doc.moveDown(2)

    doc.font('Helvetica-Bold').text('Yours sincerely,')
    doc.moveDown(1.5)
    doc.text('_____________________________')
    doc.font('Helvetica').text('Admissions Office')
    doc.text('Universiti Islam Sultan Sharif Ali')
    doc.moveDown(2)

    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#CCCCCC').lineWidth(1).stroke()
    doc.moveDown(0.5)

    doc.fontSize(8).font('Helvetica').fillColor('#666666')
    doc.text('This is a computer-generated document. No signature is required.', { align: 'center' })
    doc.text('For inquiries, please contact admissions@unissa.edu.bn', { align: 'center' })
    doc.text(`Offer Reference: ${offerRef}`, { align: 'center' })

    doc.end()
  })
}

function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  return new Date(date).toLocaleDateString('en-GB', options || defaultOptions)
}

export function generateOfferRef(): string {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `OFFER-${year}-${seq}`
}

export function generateTempPassword(firstName: string): string {
  const initial = firstName.charAt(0).toUpperCase()
  const year = new Date().getFullYear()
  const random = String(Math.floor(Math.random() * 100)).padStart(2, '0')
  return `${initial}@UNISSA${year}${random}`
}

export function generateUsername(studentId: string): string {
  return studentId
}
