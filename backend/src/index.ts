import 'dotenv/config'
// Patch Express 4 to propagate async route handler rejections to the error handler
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Layer = require('express/lib/router/layer') as { prototype: { handle_request: any; handle?: any } }
  const orig = Layer.prototype.handle_request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Layer.prototype.handle_request = function (this: any, req: unknown, res: unknown, next: (err?: unknown) => void) {
    if (((this.handle as { length?: number } | undefined)?.length ?? 0) > 3) return orig.call(this, req, res, next)
    try {
      const ret = orig.call(this, req, res, next) as Promise<unknown> | undefined
      if (ret && typeof ret.catch === 'function') ret.catch(next)
    } catch (err) {
      next(err)
    }
  }
}
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import fs from 'fs'
import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import studentRoutes from './routes/students'
import financeRoutes from './routes/finance'
import procurementRoutes from './routes/procurement'
import lmsRoutes from './routes/lms'
import aiRoutes from './routes/ai'
import admissionsRoutes from './routes/admissions'
import hrRoutes from './routes/hr'
import researchRoutes from './routes/research'
import notificationsRoutes from './routes/notifications'
import adminRoutes from './routes/admin'
import productsRoutes from './routes/products'
import { errorHandler, notFound } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT ?? 4000

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Security
app.use(helmet({ contentSecurityPolicy: false }))
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim())
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true)
    // Allow configured origins or any private LAN IP (192.168.x, 172.16-31.x, 10.x)
    const isLan = /^https?:\/\/(192\.168\.|172\.(1[6-9]|2\d|3[01])\.|10\.)/.test(origin)
    if (allowedOrigins.includes(origin) || isLan) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))

// Parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir))

// Logging
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'))

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', version: 'v5.0', ts: new Date().toISOString() }))

// Routes
app.use('/api/v1/auth',        authRoutes)
app.use('/api/v1/dashboard',   dashboardRoutes)
app.use('/api/v1/students',    studentRoutes)
app.use('/api/v1/finance',     financeRoutes)
app.use('/api/v1/procurement', procurementRoutes)
app.use('/api/v1/lms',         lmsRoutes)
app.use('/api/v1/ai',          aiRoutes)
app.use('/api/v1/admissions',  admissionsRoutes)
app.use('/api/v1/hr',            hrRoutes)
app.use('/api/v1/research',     researchRoutes)
app.use('/api/v1/notifications', notificationsRoutes)
app.use('/api/v1/admin',         adminRoutes)
app.use('/api/v1/products',      productsRoutes)

// API docs
app.get('/api-docs', (_req, res) => {
  res.json({
    message: 'UNISSA Smart University Platform API v5.0',
    version: '2.0.0',
    modules: {
      auth:        ['POST /api/v1/auth/login', 'GET /api/v1/auth/me'],
      dashboard:   ['GET /api/v1/dashboard/kpi', 'GET /api/v1/dashboard/insights'],
      admissions:  ['GET /api/v1/admissions/intakes', 'POST /api/v1/admissions/apply', 'PATCH /api/v1/admissions/applications/:id/decision'],
      students:    ['GET /api/v1/students/:id', 'POST /api/v1/students/:id/register-courses'],
      finance:     ['GET /api/v1/finance/invoices/:studentId', 'POST /api/v1/finance/payments'],
      lms:         ['GET /api/v1/lms/courses/:studentId', 'POST /api/v1/lms/submissions'],
      procurement: ['GET /api/v1/procurement/pr', 'POST /api/v1/procurement/pr', 'POST /api/v1/procurement/pr/:id/approve'],
      hr:          ['GET /api/v1/hr/staff', 'GET /api/v1/hr/leave', 'POST /api/v1/hr/leave', 'PATCH /api/v1/hr/leave/:id/approve'],
      research:    ['GET /api/v1/research/grants', 'POST /api/v1/research/grants', 'PATCH /api/v1/research/grants/:id/review'],
      ai:          ['POST /api/v1/ai/chat', 'GET /api/v1/ai/risk-dashboard/:offeringId', 'GET /api/v1/ai/config', 'PUT /api/v1/ai/config', 'POST /api/v1/ai/config/test'],
    },
  })
})

// Error handling
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`\n🚀 UNISSA API running at http://localhost:${PORT}`)
  console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`)
  console.log(`💚 Health:   http://localhost:${PORT}/health\n`)
})

export default app
