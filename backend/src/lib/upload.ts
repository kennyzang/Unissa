import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const submissionDir = path.join(uploadsDir, 'submissions')
    if (!fs.existsSync(submissionDir)) {
      fs.mkdirSync(submissionDir, { recursive: true })
    }
    cb(null, submissionDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (extname && mimetype) {
      return cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, PDF, DOC, DOCX, and TXT files are allowed.'))
    }
  }
})

// Session materials upload — broader types, 50 MB limit
const sessionMaterialStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsDir, 'session-materials')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'material-' + uniqueSuffix + path.extname(file.originalname))
  },
})

export const sessionMaterialUpload = multer({
  storage: sessionMaterialStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(pdf|ppt|pptx|doc|docx|xls|xlsx|txt|zip|png|jpg|jpeg)$/i
    if (allowedExt.test(path.extname(file.originalname))) {
      return cb(null, true)
    }
    cb(new Error('Unsupported file type. Allowed: PDF, PPT, DOC, XLS, TXT, ZIP, images.'))
  },
})