import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

const FROM_ADDRESS = process.env.RESEND_FROM ?? 'UNISSA <noreply@send.unissa.edu.bn>'

interface EmailOptions {
  to: string | string[]
  subject: string
  body: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  logId?: string
}

class EmailService {
  private resend: Resend | null = null
  private initialized: boolean = false

  async initialize(): Promise<void> {
    try {
      const envKey = process.env.RESEND_API_KEY
      if (envKey) {
        this.resend = new Resend(envKey)
        this.initialized = true
        return
      }
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'resend_api_key' },
      })

      const apiKey = config?.value?.trim()
      if (apiKey) {
        this.resend = new Resend(apiKey)
        this.initialized = true
      } else {
        this.initialized = false
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error)
      this.initialized = false
    }
  }

  async sendEmail(options: EmailOptions, retryCount: number = 0): Promise<EmailResult> {
    if (!this.initialized || !this.resend) {
      const logId = await this.logEmail(options, 'failed', 'Email service not configured')
      return { success: false, error: 'Email service not configured', logId }
    }

    const toList = Array.isArray(options.to) ? options.to : [options.to]

    try {
      const payload: Parameters<Resend['emails']['send']>[0] = {
        from: FROM_ADDRESS,
        to: toList,
        subject: options.subject,
        html: options.body,
      }

      if (options.attachments?.length) {
        payload.attachments = options.attachments.map((a) => ({
          filename: a.filename,
          content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content as string),
          contentType: a.contentType,
        }))
      }

      const { data, error } = await this.resend.emails.send(payload)

      if (error) {
        throw new Error(error.message)
      }

      const logId = await this.logEmail(options, 'sent', undefined, data?.id)
      return { success: true, messageId: data?.id, logId }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error'

      if (retryCount < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.sendEmail(options, retryCount + 1)
      }

      const logId = await this.logEmail(options, 'failed', errorMessage, undefined, retryCount + 1)
      return { success: false, error: errorMessage, logId }
    }
  }

  private async logEmail(
    options: EmailOptions,
    status: string,
    errorMessage?: string,
    messageId?: string,
    retries?: number
  ): Promise<string> {
    const log = await prisma.emailLog.create({
      data: {
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        body: options.body,
        status,
        errorMessage,
        messageId,
        retries: retries ?? 0,
        sentAt: status === 'sent' ? new Date() : null,
      },
    })
    return log.id
  }

  async sendTestEmail(to: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: 'UNISSA Email Service Test',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #165DFF;">Email Service Test</h2>
          <p>This is a test email from the UNISSA Student Management System.</p>
          <p>If you received this email, your email configuration is working correctly.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toLocaleString()}<br>
            From: UNISSA Student Management System
          </p>
        </div>
      `,
    })
  }

  async sendOfferLetterEmail(
    to: string,
    applicantName: string,
    programmeName: string,
    offerRef: string,
    pdfBuffer: Buffer
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: `Admission Offer - ${offerRef} | UNISSA`,
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #165DFF;">Congratulations, ${applicantName}!</h2>
          <p>We are pleased to inform you that your application to UNISSA has been successful.</p>
          <p>You have been offered admission to the <strong>${programmeName}</strong> programme.</p>
          <p>Please find your official offer letter attached to this email.</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0;"><strong>Offer Reference:</strong> ${offerRef}</p>
            <p style="margin: 10px 0 0 0;"><strong>Next Steps:</strong></p>
            <ol style="margin: 5px 0 0 0; padding-left: 20px;">
              <li>Review your offer letter</li>
              <li>Log in to the UNISSA Student Portal to accept your offer</li>
              <li>Complete your course registration</li>
            </ol>
          </div>
          <p>If you have any questions, please contact us at <a href="mailto:admissions@unissa.edu.bn">admissions@unissa.edu.bn</a>.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            UNISSA - Universiti Islam Sultan Sharif Ali<br>
            Bandar Seri Begawan, Brunei Darussalam
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Offer-Letter-${offerRef}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })
  }

  async sendAccountCredentialsEmail(
    to: string,
    applicantName: string,
    username: string,
    password: string,
    studentId: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: 'Your UNISSA Student Account Credentials',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #165DFF;">Welcome to UNISSA!</h2>
          <p>Dear ${applicantName},</p>
          <p>Your student account has been created. Below are your login credentials:</p>
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0;"><strong>Student ID:</strong> ${studentId}</p>
            <p style="margin: 10px 0;"><strong>Username:</strong> ${username}</p>
            <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px;">${password}</code></p>
          </div>
          <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Important:</strong> You will be required to change your password on first login.</p>
          </div>
          <p>You can access the student portal at: <a href="https://unissa.edu.bn/student">https://unissa.edu.bn/student</a></p>
          <p>If you have any questions, please contact IT Support at <a href="mailto:it.support@unissa.edu.bn">it.support@unissa.edu.bn</a>.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            UNISSA - Universiti Islam Sultan Sharif Ali<br>
            Bandar Seri Begawan, Brunei Darussalam
          </p>
        </div>
      `,
    })
  }

  async sendPaymentReceiptEmail(
    to: string,
    studentName: string,
    transactionRef: string,
    amount: number,
    invoiceNo: string,
    paymentMethod: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: `Payment Receipt - ${transactionRef} | UNISSA`,
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00B42A;">Payment Successful</h2>
          <p>Dear ${studentName},</p>
          <p>Your payment has been processed successfully.</p>
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0;"><strong>Transaction Reference:</strong> ${transactionRef}</p>
            <p style="margin: 10px 0;"><strong>Invoice Number:</strong> ${invoiceNo}</p>
            <p style="margin: 10px 0;"><strong>Amount Paid:</strong> BND ${amount.toLocaleString()}</p>
            <p style="margin: 0;"><strong>Payment Method:</strong> ${paymentMethod}</p>
          </div>
          <p>You can view and download your receipt from the student portal.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            UNISSA - Universiti Islam Sultan Sharif Ali<br>
            Finance Department
          </p>
        </div>
      `,
    })
  }

  async sendStaffWelcomeEmail(
    to: string,
    staffName: string,
    username: string,
    password: string,
    staffId: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: 'Welcome to UNISSA — Your Staff Account Credentials',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #165DFF;">Welcome to UNISSA, ${staffName}!</h2>
          <p>Your onboarding has been approved. Below are your login credentials:</p>
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0;"><strong>Staff ID:</strong> ${staffId}</p>
            <p style="margin: 10px 0;"><strong>Username:</strong> ${username}</p>
            <p style="margin: 0;"><strong>Temporary Password:</strong>
              <code style="background: #fff; padding: 2px 8px; border-radius: 4px;">${password}</code>
            </p>
          </div>
          <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Important:</strong> Please change your password after your first login.</p>
          </div>
          <p>You can access the staff portal at:
            <a href="https://unissa.edu.bn">https://unissa.edu.bn</a>
          </p>
          <p>If you have any questions, please contact HR at
            <a href="mailto:hr@unissa.edu.bn">hr@unissa.edu.bn</a>.
          </p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            UNISSA — Universiti Islam Sultan Sharif Ali<br>
            Bandar Seri Begawan, Brunei Darussalam
          </p>
        </div>
      `,
    })
  }

  isConfigured(): boolean {
    return this.initialized && this.resend !== null
  }
}

export const emailService = new EmailService()

export async function initEmailService(): Promise<void> {
  await emailService.initialize()
}
