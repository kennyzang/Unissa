// ============================================================
// UNISSA POC – Demo Seed Data v5.0
// Run: pnpm --filter backend seed
// ============================================================
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding UNISSA demo data...\n')

  // ── System Configs ─────────────────────────────────────────
  const configs = [
    { key: 'max_ch_standard', value: '18', description: 'Max credit hours for standard students' },
    { key: 'max_ch_overload', value: '21', description: 'Max CH if CGPA >= 3.5' },
    { key: 'min_ch_probation', value: '6', description: 'Min CH for probation students' },
    { key: 'min_ch_standard', value: '12', description: 'Min CH for standard students' },
    { key: 'late_fee_per_day', value: '10', description: 'BND per day late fee' },
    { key: 'add_drop_weeks', value: '2', description: 'Add/drop period in weeks' },
    { key: 'session_timeout', value: '14400', description: 'JWT session timeout (seconds)' },
    { key: 'procurement_tender_threshold', value: '2000', description: 'Amount requiring tender' },
    { key: 'procurement_auto_approve_threshold', value: '500', description: 'Amount for auto L3 approval' },
    { key: 'procurement_min_quotes_above_500', value: '3', description: 'Min quotes for amount > 500' },
    { key: 'anomaly_zscore_threshold', value: '2.0', description: 'Z-score threshold for flagging' },
    { key: 'lms_active_learners', value: '89', description: 'Dashboard: active LMS learners now' },
    { key: 'demo_version', value: 'v5.0', description: 'POC demo version' },
    // AI Configuration (enabled by default with Deepseek)
    { key: 'ai_enabled',       value: 'true',                                  description: 'Enable real AI responses (requires API key)' },
    { key: 'ai_provider',      value: 'custom',                                description: 'AI provider: openai | anthropic | custom' },
    { key: 'ai_api_key',       value: 'sk-8062c00427f442f494c210bb9dc0f1b0',  description: 'AI provider API key' },
    { key: 'ai_model',         value: 'deepseek-chat',                         description: 'AI model ID' },
    { key: 'ai_base_url',      value: 'https://api.deepseek.com/v1',           description: 'Custom API base URL (leave empty for defaults)' },
    { key: 'max_selectable_courses', value: '10',                              description: 'Maximum number of courses a student can select per registration' },
    { key: 'ai_temperature',   value: '0.7',          description: 'LLM temperature (0-1)' },
    { key: 'ai_max_tokens',    value: '2048',         description: 'Max response tokens' },
    { key: 'ai_system_prompt', value: '',             description: 'Custom system prompt (empty = default UNIBOT prompt)' },
    // Dashboard KPI reference values (pre-seeded for demo display)
    { key: 'dashboard_enrollment_total',    value: '1216',                             description: 'Total enrolled students this semester' },
    { key: 'dashboard_enrollment_trend_7d', value: '[1197,1202,1207,1210,1213,1215,1216]', description: '7-day enrollment sparkline data' },
    { key: 'hr_total_staff',                value: '312',                              description: 'Total active staff headcount' },
    { key: 'hr_on_leave_today',             value: '7',                               description: 'Staff on approved leave today' },
    { key: 'hr_pending_approvals',          value: '4',                               description: 'Pending HR approval requests' },
    { key: 'hr_new_hires_month',            value: '2',                               description: 'New staff joined this month' },
    { key: 'lms_assignments_due_today',     value: '14',                              description: 'LMS assignments with due date today' },
    { key: 'lms_avg_completion_pct',        value: '82',                              description: 'Average course completion percentage' },
    { key: 'lms_at_risk_count',             value: '2',                               description: 'At-risk students flagged in LMS' },
    { key: 'campus_total_rooms',            value: '60',                              description: 'Total bookable campus rooms' },
    { key: 'campus_vehicle_total',          value: '10',                              description: 'Total campus vehicles' },
    { key: 'campus_vehicle_in_use',         value: '6',                               description: 'Vehicles currently in use' },
    { key: 'student_default_status',        value: 'active',                          description: 'Default status for new enrolled students' },
    { key: 'applicant_default_status',      value: 'draft',                           description: 'Default status for new applicants' },
    // Email Configuration (Resend)
    { key: 'resend_api_key', value: 're_R3wt6Yxx_CMvSqwFdFKE3qVkxXUEfn4co', description: 'Resend API key for transactional emails' },
  ]
  for (const c of configs) {
    await prisma.systemConfig.upsert({ where: { key: c.key }, create: c, update: {} })
  }

  // ── Academic Year ───────────────────────────────────────────
  const ay2026 = await prisma.academicYear.upsert({
    where: { year: 2026 },
    create: { year: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true },
    update: { isCurrent: true },
  })

  const semSep2026 = await prisma.semester.upsert({
    where: { academicYearId_semesterNumber: { academicYearId: ay2026.id, semesterNumber: 1 } },
    create: {
      academicYearId: ay2026.id, name: 'Sep 2026', semesterNumber: 1,
      startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'),
      addDropEnd: new Date('2026-09-15'), isActive: true,
    },
    update: {},
  })

  const semFeb2027 = await prisma.semester.upsert({
    where: { academicYearId_semesterNumber: { academicYearId: ay2026.id, semesterNumber: 2 } },
    create: {
      academicYearId: ay2026.id, name: 'Feb 2027', semesterNumber: 2,
      startDate: new Date('2027-02-01'), endDate: new Date('2027-06-30'),
      addDropEnd: new Date('2027-02-15'), isActive: false,
    },
    update: {},
  })

  // ── Departments ─────────────────────────────────────────────
  const deptIFN = await upsertDept({ code: 'IFN', name: 'Faculty of Information Technology' })
  const deptARA = await upsertDept({ code: 'ARA', name: 'Faculty of Arabic Studies' })
  const deptFND = await upsertDept({ code: 'FND', name: 'Faculty of Foundation Sciences' })
  const deptADM = await upsertDept({ code: 'ADM', name: 'Administration Department' })
  const deptFIN = await upsertDept({ code: 'FIN', name: 'Finance Department' })

  // ── Users ───────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hashSync(pw, 10)
  const PASS = 'Demo@2026'

  const uNoor       = await upsertUser({ username: 'noor',       displayName: 'Noor (Demo Student)', role: 'student',    email: 'noor@unissa.edu.bn',       hash: hash(PASS) })
  // Scene-1 demo account: fresh applicant — always reset so demo starts from the very beginning
  const uZara       = await upsertUser({ username: 'zara',       displayName: 'Noor Aisyah Binti Hassan', role: 'student',    email: 'zara@unissa.edu.bn',       hash: hash(PASS) })
  const uAdmissions = await upsertUser({ username: 'admissions', displayName: 'Admissions Officer',  role: 'admissions', email: 'admissions@unissa.edu.bn',  hash: hash(PASS) })
  const uDrSiti     = await upsertUser({ username: 'drsiti',     displayName: 'Dr. Siti (Lecturer)', role: 'lecturer',   email: 'drsiti@unissa.edu.bn',      hash: hash(PASS) })
  const uManager    = await upsertUser({ username: 'manager',    displayName: 'Dept Manager',        role: 'manager',    email: 'manager@unissa.edu.bn',     hash: hash(PASS) })
  const uFinance    = await upsertUser({ username: 'finance',    displayName: 'Finance Officer',     role: 'finance',    email: 'finance@unissa.edu.bn',     hash: hash(PASS) })
  const uAdmin      = await upsertUser({ username: 'admin',      displayName: 'System Admin',        role: 'admin',      email: 'admin@unissa.edu.bn',       hash: hash(PASS) })
  const uAhmad      = await upsertUser({ username: 'drahmad',    displayName: 'Dr. Ahmad (PI)',      role: 'lecturer',   email: 'drahmad@unissa.edu.bn',     hash: hash(PASS) })
  const uHrAdmin    = await upsertUser({ username: 'hradmin',    displayName: 'HR Administrator',    role: 'manager',    email: 'hradmin@unissa.edu.bn',     hash: hash(PASS) })

  // ── Staff ────────────────────────────────────────────────────
  const staffSiti    = await upsertStaff({ staffId: 'STF-001', userId: uDrSiti.id,  departmentId: deptIFN.id, fullName: 'Dr. Siti Aminah',     designation: 'Senior Lecturer',       salary: 4500 })
  const staffManager = await upsertStaff({ staffId: 'STF-002', userId: uManager.id, departmentId: deptADM.id, fullName: 'Ahmad Fauzi',          designation: 'Department Head',       salary: 5500 })
  const staffFinance = await upsertStaff({ staffId: 'STF-003', userId: uFinance.id, departmentId: deptFIN.id, fullName: 'Saleha Mohd',          designation: 'Finance Officer',       salary: 3800 })
  const staffAhmad   = await upsertStaff({ staffId: 'STF-004', userId: uAhmad.id,   departmentId: deptIFN.id, fullName: 'Dr. Ahmad Rashid',     designation: 'Associate Professor',   salary: 6000 })
  const staffHr      = await upsertStaff({ staffId: 'STF-005', userId: uHrAdmin.id,  departmentId: deptADM.id, fullName: 'Nurul Huda',           designation: 'HR Administrator',      salary: 3200 })

  // Update dept heads
  await prisma.department.update({ where: { id: deptIFN.id }, data: { headStaffId: staffSiti.id } })
  await prisma.department.update({ where: { id: deptADM.id }, data: { headStaffId: staffManager.id } })

  // ── New Hires This Month (HR dashboard: 2 new hires) ─────────
  const uNewHire1 = await upsertUser({ username: 'faizal', displayName: 'Mohd Faizal Bin Aziz', role: 'lecturer', email: 'faizal@unissa.edu.bn', hash: hash(PASS) })
  const uNewHire2 = await upsertUser({ username: 'aishah', displayName: 'Aishah Binti Yusof',   role: 'manager',  email: 'aishah@unissa.edu.bn',  hash: hash(PASS) })
  await prisma.staff.upsert({
    where: { staffId: 'STF-006' },
    create: { staffId: 'STF-006', userId: uNewHire1.id, departmentId: deptIFN.id, fullName: 'Mohd Faizal Bin Aziz', icPassport: 'IC-STF-006', dateOfBirth: new Date('1990-03-15'), gender: 'male',   designation: 'Lecturer',               employmentType: 'permanent', joinDate: new Date('2026-04-01'), payrollBasicSalary: 3500, lmsInstructorActive: true  },
    update: {},
  })
  await prisma.staff.upsert({
    where: { staffId: 'STF-007' },
    create: { staffId: 'STF-007', userId: uNewHire2.id, departmentId: deptADM.id, fullName: 'Aishah Binti Yusof',   icPassport: 'IC-STF-007', dateOfBirth: new Date('1992-07-20'), gender: 'female', designation: 'Administrative Officer', employmentType: 'permanent', joinDate: new Date('2026-04-15'), payrollBasicSalary: 2800, lmsInstructorActive: false },
    update: {},
  })

  // ── Bulk Staff Creation (Total: 312 active staff) ──────────────
  const staffDepts = [deptIFN.id, deptADM.id, deptFIN.id, deptARA.id, deptFND.id]
  const staffDesignations = ['Lecturer', 'Senior Lecturer', 'Associate Professor', 'Administrative Officer', 'Finance Officer', 'Lab Technician', 'Research Assistant', 'Department Secretary']
  const firstNames = ['Ahmad', 'Muhammad', 'Haji', 'Abdul', 'Mohd', 'Ismail', 'Hassan', 'Ibrahim', 'Yusof', 'Rahman', 'Ali', 'Omar', 'Khalid', 'Faisal', 'Nasir', 'Zainal', 'Hamid', 'Aziz', 'Karim', 'Latif']
  const lastNames = ['Bin Haji Ali', 'Bin Mohd Said', 'Bin Abdul Rahman', 'Bin Haji Ibrahim', 'Bin Abdullah', 'Bin Haji Hassan', 'Bin Mohd Yusof', 'Bin Haji Ahmad', 'Bin Abdul Latif', 'Bin Haji Mahmud', 'Binti Haji Ali', 'Binti Mohd Said', 'Binti Abdul Rahman', 'Binti Haji Ibrahim', 'Binti Abdullah', 'Binti Haji Hassan', 'Binti Mohd Yusof', 'Binti Haji Ahmad', 'Binti Abdul Latif', 'Binti Haji Mahmud']
  
  for (let i = 8; i <= 312; i++) {
    const staffId = `STF-${String(i).padStart(3, '0')}`
    const firstName = firstNames[(i - 8) % firstNames.length]
    const lastName = lastNames[(i - 8) % lastNames.length]
    const fullName = `${firstName} ${lastName}`
    const deptId = staffDepts[(i - 8) % staffDepts.length]
    const designation = staffDesignations[(i - 8) % staffDesignations.length]
    const salary = 2800 + ((i - 8) % 15) * 200
    
    const existingUser = await prisma.user.findUnique({ where: { username: `staff${i}` } })
    let userId: string
    if (existingUser) {
      userId = existingUser.id
    } else {
      const newUser = await prisma.user.create({
        data: {
          username: `staff${i}`,
          passwordHash: hash(PASS),
          displayName: fullName,
          role: designation.includes('Lecturer') || designation.includes('Professor') ? 'lecturer' : 'manager',
          email: `staff${i}@unissa.edu.bn`,
        },
      })
      userId = newUser.id
    }

    await prisma.staff.upsert({
      where: { staffId },
      create: {
        staffId,
        userId,
        departmentId: deptId,
        fullName,
        icPassport: `IC-${staffId}`,
        dateOfBirth: new Date(1980 + ((i - 8) % 15), ((i - 8) % 12), ((i - 8) % 28) + 1),
        gender: (i - 8) % 3 === 0 ? 'female' : 'male',
        designation,
        employmentType: 'permanent',
        joinDate: new Date(2018 + ((i - 8) % 8), ((i - 8) % 12), 1),
        payrollBasicSalary: salary,
        lmsInstructorActive: designation.includes('Lecturer') || designation.includes('Professor'),
      },
      update: {},
    })
  }

  // ── Payroll Records (all staff — last 3 months for Payroll Management demo) ─
  // Brunei statutory: TAP employee 5% + SCP employee 3.5% = 8.5% of basic salary
  const payrollStaff = [
    // staffId, fullName, basicSalary, monthlyAllowances
    { ref: staffSiti,    basic: 4500, allowances: 300  },
    { ref: staffManager, basic: 5500, allowances: 500  },
    { ref: staffFinance, basic: 3800, allowances: 200  },
    { ref: staffAhmad,   basic: 6000, allowances: 600  },
    { ref: staffHr,      basic: 3200, allowances: 150  },
  ]

  for (const s of payrollStaff) {
    const deductions = parseFloat((s.basic * 0.085).toFixed(2))
    const netSalary  = parseFloat((s.basic + s.allowances - deductions).toFixed(2))

    for (const [monthOffset, status] of [[-2, 'paid'], [-1, 'paid'], [0, 'draft']] as [number, string][]) {
      const d = new Date(2026, 3 + monthOffset, 1) // April 2026 = month index 3
      await prisma.payrollRecord.upsert({
        where: { staffId_payrollMonth: { staffId: s.ref.id, payrollMonth: d } },
        create: {
          staffId: s.ref.id, payrollMonth: d,
          basicSalary: s.basic, allowances: s.allowances, deductions, netSalary, status,
          ...(status === 'paid' ? { paidAt: new Date(d.getFullYear(), d.getMonth() + 1, 5) } : {}),
        },
        update: {},
      })
    }
  }

  // ── Onboarding Request (new hire Mohd Faizal — pending approval demo) ─
  const staffFaizal = await prisma.staff.findUnique({ where: { staffId: 'STF-006' } })
  if (staffFaizal) {
    await prisma.onboardingRequest.upsert({
      where: { staffId: staffFaizal.id },
      create: { staffId: staffFaizal.id, initiatedById: uHrAdmin.id, status: 'pending_approval' },
      update: {},
    })
  }

  // ── Leave Requests (HR dashboard: 7 on leave today, 4 pending) ─
  // 5 approved leaves overlapping today (2026-04-01)
  for (const lr of [
    { id: 'lr-001', staffId: staffSiti.id,    type: 'annual',  days: 4, start: '2026-03-30', end: '2026-04-02', reason: 'Family vacation leave' },
    { id: 'lr-002', staffId: staffManager.id, type: 'medical', days: 1, start: '2026-04-01', end: '2026-04-01', reason: 'Medical appointment' },
    { id: 'lr-003', staffId: staffFinance.id, type: 'annual',  days: 2, start: '2026-04-01', end: '2026-04-02', reason: 'Personal leave' },
    { id: 'lr-004', staffId: staffAhmad.id,   type: 'annual',  days: 1, start: '2026-04-01', end: '2026-04-01', reason: 'Conference travel day' },
    { id: 'lr-005', staffId: staffHr.id,      type: 'medical', days: 2, start: '2026-03-31', end: '2026-04-01', reason: 'Medical leave' },
  ]) {
    await prisma.leaveRequest.upsert({
      where: { id: lr.id },
      create: {
        id: lr.id, staffId: lr.staffId, leaveType: lr.type,
        startDate: new Date(lr.start), endDate: new Date(lr.end),
        durationDays: lr.days, reason: lr.reason,
        coveringOfficerId: staffManager.id,
        status: 'approved', l1ApproverId: uAdmin.id, l1ActedAt: new Date('2026-03-28'),
      },
      update: {},
    })
    await prisma.staff.update({ where: { id: lr.staffId }, data: { status: 'on_leave' } })
  }
  // 2 additional staff on leave today (total 7)
  const staffOnLeave1 = await prisma.staff.findFirst({ where: { staffId: 'STF-008' } })
  const staffOnLeave2 = await prisma.staff.findFirst({ where: { staffId: 'STF-009' } })
  if (staffOnLeave1) {
    await prisma.staff.update({ where: { id: staffOnLeave1.id }, data: { status: 'on_leave' } })
    await prisma.leaveRequest.upsert({
      where: { id: 'lr-006' },
      create: {
        id: 'lr-006', staffId: staffOnLeave1.id, leaveType: 'annual',
        startDate: new Date('2026-04-01'), endDate: new Date('2026-04-03'),
        durationDays: 3, reason: 'Annual leave',
        coveringOfficerId: staffManager.id,
        status: 'approved', l1ApproverId: uAdmin.id, l1ActedAt: new Date('2026-03-28'),
      },
      update: {},
    })
  }
  if (staffOnLeave2) {
    await prisma.staff.update({ where: { id: staffOnLeave2.id }, data: { status: 'on_leave' } })
    await prisma.leaveRequest.upsert({
      where: { id: 'lr-007' },
      create: {
        id: 'lr-007', staffId: staffOnLeave2.id, leaveType: 'medical',
        startDate: new Date('2026-04-01'), endDate: new Date('2026-04-01'),
        durationDays: 1, reason: 'Medical leave',
        coveringOfficerId: staffManager.id,
        status: 'approved', l1ApproverId: uAdmin.id, l1ActedAt: new Date('2026-03-28'),
      },
      update: {},
    })
  }
  // 4 pending leave requests (pending approvals count)
  for (const lr of [
    { id: 'lr-p01', staffId: staffSiti.id,    type: 'annual',  days: 5, start: '2026-04-15', end: '2026-04-19' },
    { id: 'lr-p02', staffId: staffAhmad.id,   type: 'annual',  days: 3, start: '2026-04-22', end: '2026-04-24' },
    { id: 'lr-p03', staffId: staffFinance.id, type: 'medical', days: 2, start: '2026-04-10', end: '2026-04-11' },
    { id: 'lr-p04', staffId: staffManager.id, type: 'annual',  days: 4, start: '2026-05-02', end: '2026-05-06' },
  ]) {
    await prisma.leaveRequest.upsert({
      where: { id: lr.id },
      create: {
        id: lr.id, staffId: lr.staffId, leaveType: lr.type,
        startDate: new Date(lr.start), endDate: new Date(lr.end),
        durationDays: lr.days, reason: 'Leave request pending HR approval',
        coveringOfficerId: staffManager.id, status: 'pending',
      },
      update: {},
    })
  }

  // ── Programmes ───────────────────────────────────────────────
  const progBSC = await upsertProgramme({
    code: 'BSC-IFN', name: 'Bachelor of Science in Information Technology',
    departmentId: deptIFN.id, level: 'degree', durationYears: 4,
    feeLocal: 800, feeIntl: 1500,
  })
  const progBA = await upsertProgramme({
    code: 'BA-ARA', name: 'Bachelor of Arts in Arabic Studies',
    departmentId: deptARA.id, level: 'degree', durationYears: 4,
    feeLocal: 600, feeIntl: 1200,
  })
  const progFND = await upsertProgramme({
    code: 'FND-SCI', name: 'Foundation in Sciences',
    departmentId: deptFND.id, level: 'certificate', durationYears: 1,
    feeLocal: 400, feeIntl: 800,
  })

  // ── Intakes ──────────────────────────────────────────────────
  const intakeBSC = await prisma.intake.upsert({
    where: { programmeId_semesterId: { programmeId: progBSC.id, semesterId: semSep2026.id } },
    create: { programmeId: progBSC.id, semesterId: semSep2026.id, intakeStart: new Date('2026-09-01'), intakeEnd: new Date('2026-08-31'), isOpen: true, maxCapacity: 100 },
    update: {},
  })
  const intakeBA = await prisma.intake.upsert({
    where: { programmeId_semesterId: { programmeId: progBA.id, semesterId: semFeb2027.id } },
    create: { programmeId: progBA.id, semesterId: semFeb2027.id, intakeStart: new Date('2027-02-01'), intakeEnd: new Date('2027-01-31'), isOpen: true, maxCapacity: 80 },
    update: {},
  })

  // ── Courses ──────────────────────────────────────────────────
  const cIFN101 = await upsertCourse({ code: 'IFN101', name: 'Introduction to Programming', departmentId: deptIFN.id, ch: 3, level: 100 })
  const cIFN102 = await upsertCourse({ code: 'IFN102', name: 'Data Structures & Algorithms', departmentId: deptIFN.id, ch: 3, level: 100 })
  const cIFN201 = await upsertCourse({ code: 'IFN201', name: 'Database Management Systems',  departmentId: deptIFN.id, ch: 3, level: 200 })
  const cARA101 = await upsertCourse({ code: 'ARA101', name: 'Arabic Language I',             departmentId: deptARA.id, ch: 3, level: 100 })
  const cARA102 = await upsertCourse({ code: 'ARA102', name: 'Arabic Language II',            departmentId: deptARA.id, ch: 3, level: 100 })
  const cFND101 = await upsertCourse({ code: 'FND101', name: 'Foundation Mathematics',        departmentId: deptFND.id, ch: 3, level: 100 })
  // New courses (4 additional courses to reach 10 total)
  const cIFN202 = await upsertCourse({ code: 'IFN202', name: 'Web Development Fundamentals', departmentId: deptIFN.id, ch: 3, level: 200 })
  const cIFN301 = await upsertCourse({ code: 'IFN301', name: 'Software Engineering', departmentId: deptIFN.id, ch: 3, level: 300 })
  const cARA201 = await upsertCourse({ code: 'ARA201', name: 'Arabic Literature', departmentId: deptARA.id, ch: 3, level: 200 })
  const cFND102 = await upsertCourse({ code: 'FND102', name: 'Foundation English', departmentId: deptFND.id, ch: 3, level: 100 })

  // Prerequisites: IFN102 requires IFN101
  await prisma.coursePrerequisite.upsert({
    where: { courseId_prerequisiteCourseId: { courseId: cIFN102.id, prerequisiteCourseId: cIFN101.id } },
    create: { courseId: cIFN102.id, prerequisiteCourseId: cIFN101.id, minGrade: 'D' },
    update: {},
  })

  // ── Campus Facilities ────────────────────────────────────────
  const roomLab3  = await upsertFacility({ code: 'LAB-3', name: 'Lab 3', type: 'lab', capacity: 40, building: 'Block B' })
  const roomLH_A  = await upsertFacility({ code: 'LH-A',  name: 'Lecture Hall A', type: 'lecture_hall', capacity: 120, building: 'Block A' })
  const roomLH_B  = await upsertFacility({ code: 'LH-B',  name: 'Lecture Hall B', type: 'lecture_hall', capacity: 100, building: 'Block A' })
  const roomMR1   = await upsertFacility({ code: 'MR-1',  name: 'Meeting Room 1', type: 'meeting_room', capacity: 20, building: 'Block C' })

  for (let i = 2; i <= 5; i++) {
    await upsertFacility({ code: `MR-${i}`, name: `Meeting Room ${i}`, type: 'meeting_room', capacity: 20, building: 'Block C' })
  }
  for (let i = 1; i <= 4; i++) {
    await upsertFacility({ code: `LAB-${i}`, name: `Computer Lab ${i}`, type: 'lab', capacity: 35, building: 'Block B' })
  }
  // Tutorial rooms TR-01 to TR-20 (20 rooms) — Block D
  for (let i = 1; i <= 20; i++) {
    await upsertFacility({ code: `TR-${String(i).padStart(2, '0')}`, name: `Tutorial Room ${i}`, type: 'classroom', capacity: 30, building: 'Block D' })
  }
  // Classrooms CR-01 to CR-20 (20 rooms) — Block E
  for (let i = 1; i <= 20; i++) {
    await upsertFacility({ code: `CR-${String(i).padStart(2, '0')}`, name: `Classroom ${i}`, type: 'classroom', capacity: 45, building: 'Block E' })
  }
  // Staff offices OFF-01 to OFF-09 (9 rooms) — Block F
  for (let i = 1; i <= 9; i++) {
    await upsertFacility({ code: `OFF-${String(i).padStart(2, '0')}`, name: `Staff Office ${i}`, type: 'office', capacity: 10, building: 'Block F' })
  }
  // Total: 2 LH + 5 MR + 4 LAB + 20 TR + 20 CR + 9 OFF = 60 rooms ✓

  // Maintenance ticket for Lab 3 HVAC
  await prisma.maintenanceTicket.upsert({
    where: { id: 'mt-lab3-hvac' },
    create: {
      id: 'mt-lab3-hvac',
      facilityId: roomLab3.id, reportedById: uAdmin.id,
      title: 'Lab 3 HVAC – Air conditioning fault',
      description: 'Temperature regulation system not functioning correctly. Classroom temperature exceeds 30°C.',
      priority: 'high', status: 'open',
    },
    update: {},
  })

  // Maintenance tickets for dashboard count = 3
  await prisma.maintenanceTicket.upsert({
    where: { id: 'mt-lh-projector' },
    create: { id: 'mt-lh-projector', facilityId: roomLH_A.id, reportedById: uAdmin.id, title: 'LH-A Projector bulb replacement', priority: 'medium', status: 'open' },
    update: {},
  })
  await prisma.maintenanceTicket.upsert({
    where: { id: 'mt-mr1-wifi' },
    create: { id: 'mt-mr1-wifi', facilityId: roomMR1.id, reportedById: uAdmin.id, title: 'Meeting Room 1 WiFi AP offline', priority: 'medium', status: 'open' },
    update: {},
  })

  // ── Demo Facility Bookings (pending — manager can approve) ────
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0)
  const dayAfter  = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);  dayAfter.setHours(0, 0, 0, 0)

  const demoPendingBookings = [
    { id: 'fb-demo-001', facilityId: roomMR1.id,  bookedById: uManager.id, bookingDate: tomorrow, startTime: '09:00', endTime: '11:00', purpose: 'Quarterly Department Review Meeting',      status: 'pending' },
    { id: 'fb-demo-002', facilityId: roomLH_A.id, bookedById: uDrSiti.id,  bookingDate: tomorrow, startTime: '14:00', endTime: '17:00', purpose: 'Guest Lecture: AI in Healthcare',          status: 'pending' },
    { id: 'fb-demo-003', facilityId: roomLab3.id, bookedById: uAhmad.id,   bookingDate: dayAfter,  startTime: '10:00', endTime: '12:00', purpose: 'Research Group Workshop – NLP Experiments', status: 'pending' },
  ]
  for (const b of demoPendingBookings) {
    const exists = await prisma.facilityBooking.findUnique({ where: { id: b.id } })
    if (!exists) {
      await prisma.facilityBooking.create({ data: b })
    }
  }

  // ── Course Offerings ──────────────────────────────────────────
  const offeringIFN101 = await upsertOffering({
    courseId: cIFN101.id, semesterId: semSep2026.id, lecturerId: staffSiti.id,
    departmentId: deptIFN.id, day: 'Monday', start: '09:00', end: '11:00', room: 'Lab 3',
    roomId: roomLab3.id,
  })
  const offeringIFN102 = await upsertOffering({
    courseId: cIFN102.id, semesterId: semSep2026.id, lecturerId: staffSiti.id,
    departmentId: deptIFN.id, day: 'Wednesday', start: '09:00', end: '11:00', room: 'Lab 3',
    roomId: roomLab3.id,
  })
  const offeringIFN201 = await upsertOffering({
    courseId: cIFN201.id, semesterId: semSep2026.id, lecturerId: staffSiti.id,
    departmentId: deptIFN.id, day: 'Tuesday', start: '14:00', end: '16:00', room: 'Lecture Hall A',
    roomId: roomLH_A.id,
  })
  const offeringARA101 = await upsertOffering({
    courseId: cARA101.id, semesterId: semSep2026.id, lecturerId: staffAhmad.id,
    departmentId: deptARA.id, day: 'Thursday', start: '10:00', end: '12:00', room: 'Lecture Hall B',
    roomId: roomLH_B.id,
  })
  // Clash demo: IFN102 and this offering both on Wednesday 09:00
  const offeringClashDemo = await upsertOffering({
    courseId: cARA102.id, semesterId: semSep2026.id, lecturerId: staffAhmad.id,
    departmentId: deptARA.id, day: 'Wednesday', start: '09:00', end: '11:00', room: 'Lecture Hall B',
    roomId: roomLH_B.id,
  })
  // FND101 offering — gives Noor a 4th no-prereq course (3+3+3+3 = 12 CH minimum)
  const offeringFND101 = await upsertOffering({
    courseId: cFND101.id, semesterId: semSep2026.id, lecturerId: staffSiti.id,
    departmentId: deptFND.id, day: 'Friday', start: '09:00', end: '11:00', room: 'Lecture Hall A',
    roomId: roomLH_A.id,
  })
  // New course offerings (4 additional offerings for new courses)
  const offeringIFN202 = await upsertOffering({
    courseId: cIFN202.id, semesterId: semSep2026.id, lecturerId: staffSiti.id,
    departmentId: deptIFN.id, day: 'Monday', start: '14:00', end: '16:00', room: 'Lab 3',
    roomId: roomLab3.id,
  })
  const offeringIFN301 = await upsertOffering({
    courseId: cIFN301.id, semesterId: semSep2026.id, lecturerId: staffAhmad.id,
    departmentId: deptIFN.id, day: 'Tuesday', start: '09:00', end: '11:00', room: 'Lecture Hall A',
    roomId: roomLH_A.id,
  })
  const offeringARA201 = await upsertOffering({
    courseId: cARA201.id, semesterId: semSep2026.id, lecturerId: staffAhmad.id,
    departmentId: deptARA.id, day: 'Wednesday', start: '14:00', end: '16:00', room: 'Lecture Hall B',
    roomId: roomLH_B.id,
  })
  const offeringFND102 = await upsertOffering({
    courseId: cFND102.id, semesterId: semSep2026.id, lecturerId: staffSiti.id,
    departmentId: deptFND.id, day: 'Thursday', start: '14:00', end: '16:00', room: 'Lecture Hall A',
    roomId: roomLH_A.id,
  })

  // ── Clean up existing Noor student/applicant data for a fresh demo state ──
  const existingStudentNoor = await prisma.student.findFirst({ where: { userId: uNoor.id } })
  if (existingStudentNoor) {
    await prisma.studentGpaRecord.deleteMany({ where: { studentId: existingStudentNoor.id } })
    await prisma.studentRiskScore.deleteMany({ where: { studentId: existingStudentNoor.id } })
    await prisma.attendanceRecord.deleteMany({ where: { studentId: existingStudentNoor.id } })
    await prisma.submission.deleteMany({ where: { studentId: existingStudentNoor.id } })
    const feeInvoices = await prisma.feeInvoice.findMany({ where: { studentId: existingStudentNoor.id }, select: { id: true } })
    for (const inv of feeInvoices) {
      await prisma.payment.deleteMany({ where: { invoiceId: inv.id } })
    }
    await prisma.feeInvoice.deleteMany({ where: { studentId: existingStudentNoor.id } })
    await prisma.enrolment.deleteMany({ where: { studentId: existingStudentNoor.id } })
    await prisma.libraryAccount.deleteMany({ where: { studentId: existingStudentNoor.id } })
    const campusCard = await prisma.campusCard.findUnique({ where: { studentId: existingStudentNoor.id } })
    if (campusCard) {
      await prisma.campusCardTransaction.deleteMany({ where: { cardId: campusCard.id } })
      await prisma.campusCard.delete({ where: { id: campusCard.id } })
    }
    await prisma.student.delete({ where: { id: existingStudentNoor.id } })
  }
  await prisma.applicant.deleteMany({ where: { userId: uNoor.id } })

  // ── Applicant: Noor ──────────────────────────────────────────
  const applicantNoor = await prisma.applicant.upsert({
    where: { icPassport: '00-123456' },
    create: {
      applicationRef: 'APP-2026-0001',
      userId: uNoor.id,
      fullName: 'Noor Aisyah Binti Hassan',
      icPassport: '00-123456',
      dateOfBirth: new Date('2000-05-14'),
      gender: 'female',
      nationality: 'Brunei Darussalam',
      email: 'noor@unissa.edu.bn',
      mobile: '+673-8123456',
      homeAddress: '12 Jalan Gadong, Bandar Seri Begawan, BS8411, Brunei Darussalam',
      highestQualification: 'a_level',
      previousInstitution: 'Maktab Sains Paduka Seri Begawan Sultan',
      yearOfCompletion: 2025,
      cgpa: null,
      intakeId: intakeBSC.id,
      programmeId: progBSC.id,
      modeOfStudy: 'full_time',
      scholarshipApplied: false,
      status: 'offered',
      offerRef: 'UNISSA-2026-0001',
      offerLetterSentAt: new Date('2026-03-25'),
      submittedAt: new Date('2026-03-10'),
      decisionMadeAt: new Date('2026-03-25'),
    },
    update: { userId: uNoor.id, status: 'offered', offerRef: 'UNISSA-2026-0001', offerLetterSentAt: new Date('2026-03-25') },
  })

  // Subject grades for Noor
  const grades = [
    { subject: 'Mathematics', grade: 'A', type: 'a_level' },
    { subject: 'Physics', grade: 'B', type: 'a_level' },
    { subject: 'Chemistry', grade: 'B', type: 'a_level' },
    { subject: 'English', grade: 'A', type: 'a_level' },
    { subject: 'Malay Language', grade: 'A', type: 'a_level' },
  ]
  for (const g of grades) {
    await prisma.applicantSubjectGrade.upsert({
      where: { id: `noor-grade-${g.subject}` },
      create: { id: `noor-grade-${g.subject}`, applicantId: applicantNoor.id, subjectName: g.subject, grade: g.grade, qualificationType: g.type },
      update: {},
    })
  }

  // ── Noor is a pre-enrollment applicant (offered status) — no Student/Enrolment/FeeInvoice records
  // Demo flow starts from receiving the offer letter

  // ── Noor Aisyah (Scene-1 demo): clean state — no applicant, no student ───────
  // noor_apply / Demo@2026 — always reset so demo starts from the very beginning.
  
  // Reset demo account: wipe any prior student/applicant data so demo always starts clean
  const existingStudentNoorApply = await prisma.student.findFirst({ where: { userId: uZara.id } })
  if (existingStudentNoorApply) {
    await prisma.studentGpaRecord.deleteMany({ where: { studentId: existingStudentNoorApply.id } })
    await prisma.studentRiskScore.deleteMany({ where: { studentId: existingStudentNoorApply.id } })
    await prisma.attendanceRecord.deleteMany({ where: { studentId: existingStudentNoorApply.id } })
    await prisma.submission.deleteMany({ where: { studentId: existingStudentNoorApply.id } })
    await prisma.feeInvoice.deleteMany({ where: { studentId: existingStudentNoorApply.id } })
    await prisma.enrolment.deleteMany({ where: { studentId: existingStudentNoorApply.id } })
    await prisma.libraryAccount.deleteMany({ where: { studentId: existingStudentNoorApply.id } })
  }
  await prisma.student.deleteMany({ where: { userId: uZara.id } })
  await prisma.notification.deleteMany({ where: { userId: uZara.id } })
  await prisma.applicant.deleteMany({ where: { userId: uZara.id } })

  // ── Clean up existing new student records for clean seed ───────
  const newStudentUsernames = ['ali', 'fatimah', 'ahmad', 'aisyah', 'mohd', 'siti', 'hassan', 'nor', 'osman', 'halimah', 'rashid', 'zahra', 'farid', 'diana', 'kamil', 'linda', 'aziz', 'sarah', 'razi', 'maya', 'faisal', 'nadia', 'wafi', 'hanna']
  for (const username of newStudentUsernames) {
    const user = await prisma.user.findUnique({ where: { username } })
    if (user) {
      const student = await prisma.student.findFirst({ where: { userId: user.id } })
      if (student) {
        await prisma.studentGpaRecord.deleteMany({ where: { studentId: student.id } })
        await prisma.studentRiskScore.deleteMany({ where: { studentId: student.id } })
        await prisma.attendanceRecord.deleteMany({ where: { studentId: student.id } })
        await prisma.submission.deleteMany({ where: { studentId: student.id } })
        await prisma.feeInvoice.deleteMany({ where: { studentId: student.id } })
        await prisma.enrolment.deleteMany({ where: { studentId: student.id } })
        await prisma.libraryAccount.deleteMany({ where: { studentId: student.id } })
      }
      await prisma.student.deleteMany({ where: { userId: user.id } })
      await prisma.notification.deleteMany({ where: { userId: user.id } })
      await prisma.applicant.deleteMany({ where: { userId: user.id } })
    }
  }

  // ── 11 Additional Students for Risk Analytics Demo ────────────
  const riskStudents = []
  for (let i = 2; i <= 12; i++) {
    const uStub = await upsertUser({
      username: `student${i}`,
      displayName: `Student ${String(i).padStart(3, '0')}`,
      role: 'student',
      email: `student${i}@unissa.edu.bn`,
      hash: hash(PASS),
    })
    const appStub = await prisma.applicant.upsert({
      where: { icPassport: `99-${String(i).padStart(6, '0')}` },
      create: {
        applicationRef: `APP-2026-${String(i).padStart(4, '0')}`,
        fullName: `Student ${String(i).padStart(3, '0')}`,
        icPassport: `99-${String(i).padStart(6, '0')}`,
        dateOfBirth: new Date('2001-01-01'),
        gender: 'male', nationality: 'Brunei Darussalam',
        email: `student${i}@unissa.edu.bn`, mobile: '+673-0000000',
        homeAddress: 'Bandar Seri Begawan, Brunei',
        highestQualification: 'a_level', previousInstitution: 'SMSA',
        yearOfCompletion: 2025, intakeId: intakeBSC.id, programmeId: progBSC.id,
        modeOfStudy: 'full_time', status: 'accepted', submittedAt: new Date('2026-01-15'), decisionMadeAt: new Date('2026-02-01'),
      },
      update: {},
    })
    const s = await prisma.student.upsert({
      where: { studentId: `20260${String(i).padStart(2, '0')}` },
      create: {
        studentId: `20260${String(i).padStart(2, '0')}`,
        userId: uStub.id, applicantId: appStub.id,
        programmeId: progBSC.id, intakeId: intakeBSC.id,
        modeOfStudy: 'full_time', nationality: 'Brunei Darussalam',
        studentType: 'standard', currentCgpa: 2.5 + Math.random() * 1.5,
        campusCardNo: `CC-20260${String(i).padStart(2, '0')}`,
        libraryAccountActive: true, emailAccountActive: true,
        status: 'active', enrolledAt: new Date('2026-04-01'),
      },
      update: {},
    })
    riskStudents.push(s)
  }

  // ── 12 New Students with Complete Information ───────────────
  const newStudentsData = [
    { studentId: '2026013', username: 'ali', fullName: 'Ali Bin Abdullah', gender: 'male', dob: '2002-03-15', ic: 'IC-2002031501', mobile: '+673-7123456', address: 'Kampong Kiulap, Bandar Seri Begawan', email: 'ali@unissa.edu.bn', prevSchool: 'Sekolah Menengah Sayyidina Ali', yearComp: 2025, qualification: 'a_level', cgpa: 3.2 },
    { studentId: '2026014', username: 'fatimah', fullName: 'Fatimah Binti Hassan', gender: 'female', dob: '2002-05-20', ic: 'IC-2002052002', mobile: '+673-7123457', address: 'Kampong Manggis, Bandar Seri Begawan', email: 'fatimah@unissa.edu.bn', prevSchool: 'Sekolah Menengah Pengiran Anak Puteri Hajah Rashidah', yearComp: 2025, qualification: 'a_level', cgpa: 3.5 },
    { studentId: '2026015', username: 'ahmad', fullName: 'Ahmad Bin Omar', gender: 'male', dob: '2002-07-10', ic: 'IC-2002071003', mobile: '+673-7123458', address: 'Kampong Sengkurong, Brunei-Muara', email: 'ahmad@unissa.edu.bn', prevSchool: 'Sekolah Menengah Paduka Seri Begawan Sultan', yearComp: 2025, qualification: 'a_level', cgpa: 2.8 },
    { studentId: '2026016', username: 'aisyah', fullName: 'Aisyah Binti Rahman', gender: 'female', dob: '2002-09-25', ic: 'IC-2002092504', mobile: '+673-7123459', address: 'Kampong Jerudong, Brunei-Muara', email: 'aisyah@unissa.edu.bn', prevSchool: 'Sekolah Menengah Masin', yearComp: 2025, qualification: 'a_level', cgpa: 3.7 },
    { studentId: '2026017', username: 'mohd', fullName: 'Mohd Bin Ibrahim', gender: 'male', dob: '2002-11-08', ic: 'IC-2002110805', mobile: '+673-7123460', address: 'Kampong Tutong, Tutong', email: 'mohd@unissa.edu.bn', prevSchool: 'Sekolah Menengah Muda Hashim', yearComp: 2025, qualification: 'a_level', cgpa: 3.0 },
    { studentId: '2026018', username: 'siti', fullName: 'Siti Binti Ahmad', gender: 'female', dob: '2002-01-30', ic: 'IC-2002013006', mobile: '+673-7123461', address: 'Kampong Serasa, Brunei-Muara', email: 'siti@unissa.edu.bn', prevSchool: 'Sekolah Menengah Sultan Sharif Ali', yearComp: 2025, qualification: 'a_level', cgpa: 3.4 },
    { studentId: '2026019', username: 'hassan', fullName: 'Hassan Bin Yusof', gender: 'male', dob: '2002-04-12', ic: 'IC-2002041207', mobile: '+673-7123462', address: 'Kampong Kuala Belait, Belait', email: 'hassan@unissa.edu.bn', prevSchool: 'Sekolah Menengah Anthony Abell', yearComp: 2025, qualification: 'a_level', cgpa: 2.9 },
    { studentId: '2026020', username: 'nor', fullName: 'Nor Binti Zainal', gender: 'female', dob: '2002-06-18', ic: 'IC-2002061808', mobile: '+673-7123463', address: 'Kampong Mentiri, Brunei-Muara', email: 'nor@unissa.edu.bn', prevSchool: 'Sekolah Menengah Berakas', yearComp: 2025, qualification: 'a_level', cgpa: 3.6 },
    { studentId: '2026021', username: 'osman', fullName: 'Osman Bin Bakar', gender: 'male', dob: '2002-08-22', ic: 'IC-2002082209', mobile: '+673-7123464', address: 'Kampong Tanah Jambu, Brunei-Muara', email: 'osman@unissa.edu.bn', prevSchool: 'Sekolah Menengah Rimba', yearComp: 2025, qualification: 'a_level', cgpa: 3.1 },
    { studentId: '2026022', username: 'halimah', fullName: 'Halimah Binti Kassim', gender: 'female', dob: '2002-10-05', ic: 'IC-2002100510', mobile: '+673-7123465', address: 'Kampong Lumapas, Brunei-Muara', email: 'halimah@unissa.edu.bn', prevSchool: 'Sekolah Menengah SOAS', yearComp: 2025, qualification: 'a_level', cgpa: 3.3 },
    { studentId: '2026023', username: 'rashid', fullName: 'Rashid Bin Haji', gender: 'male', dob: '2002-12-14', ic: 'IC-2002121411', mobile: '+673-7123466', address: 'Kampong Gadong, Brunei-Muara', email: 'rashid@unissa.edu.bn', prevSchool: 'Sekolah Menengah STPRI', yearComp: 2025, qualification: 'a_level', cgpa: 2.7 },
    { studentId: '2026024', username: 'zahra', fullName: 'Zahra Binti Mohd', gender: 'female', dob: '2002-02-28', ic: 'IC-2002022812', mobile: '+673-7123467', address: 'Kampong Batu Satu, Bandar Seri Begawan', email: 'zahra@unissa.edu.bn', prevSchool: 'Sekolah Menengah PAP Hajah Masnah', yearComp: 2025, qualification: 'a_level', cgpa: 3.8 },
  ]

  for (const ns of newStudentsData) {
    const user = await upsertUser({
      username: ns.username,
      displayName: ns.fullName,
      role: 'student',
      email: ns.email,
      hash: hash(PASS),
    })

    const applicant = await upsertApplicant({
      userId: user.id,
      applicationRef: `APP-2026-${ns.studentId}`,
      fullName: ns.fullName,
      icPassport: ns.ic,
      dateOfBirth: new Date(ns.dob),
      gender: ns.gender,
      nationality: 'Brunei Darussalam',
      email: ns.email,
      mobile: ns.mobile,
      homeAddress: ns.address,
      highestQualification: ns.qualification,
      previousInstitution: ns.prevSchool,
      yearOfCompletion: ns.yearComp,
      intakeId: intakeBSC.id,
      programmeId: progBSC.id,
      modeOfStudy: 'full_time',
      status: 'accepted',
      submittedAt: new Date('2026-03-01'),
      decisionMadeAt: new Date('2026-03-15'),
    })

    const student = await upsertStudent({
      studentId: ns.studentId,
      userId: user.id,
      applicantId: applicant.id,
      programmeId: progBSC.id,
      intakeId: intakeBSC.id,
      modeOfStudy: 'full_time',
      nationality: 'Brunei Darussalam',
      studentType: 'standard',
      currentCgpa: ns.cgpa,
      campusCardNo: `CC-${ns.studentId}`,
      libraryAccountActive: true,
      emailAccountActive: true,
      status: 'active',
      enrolledAt: new Date('2026-04-01'),
    })

    await prisma.libraryAccount.upsert({
      where: { studentId: student.id },
      create: { studentId: student.id, accountNo: `LIB-${ns.studentId}`, isActive: true, activatedAt: new Date('2026-04-01') },
      update: {},
    })
  }

  // ── 12 Additional New Students (Status: Accepted) ───────────────
  const additionalStudentsData = [
    { studentId: '2026025', username: 'farid', fullName: 'Farid Bin Ismail', gender: 'male', dob: '2002-01-12', ic: 'IC-2002011213', mobile: '+673-7123468', address: 'Kampong Lambak, Brunei-Muara', email: 'farid@unissa.edu.bn', prevSchool: 'Sekolah Menengah Lambak', yearComp: 2025, qualification: 'a_level', cgpa: 3.3 },
    { studentId: '2026026', username: 'diana', fullName: 'Diana Binti Abdullah', gender: 'female', dob: '2002-03-18', ic: 'IC-2002031814', mobile: '+673-7123469', address: 'Kampong Berakas, Brunei-Muara', email: 'diana@unissa.edu.bn', prevSchool: 'Sekolah Menengah Berakas', yearComp: 2025, qualification: 'a_level', cgpa: 3.6 },
    { studentId: '2026027', username: 'kamil', fullName: 'Kamil Bin Rahman', gender: 'male', dob: '2002-05-22', ic: 'IC-2002052215', mobile: '+673-7123470', address: 'Kampong Kilanas, Brunei-Muara', email: 'kamil@unissa.edu.bn', prevSchool: 'Sekolah Menengah Kilanas', yearComp: 2025, qualification: 'a_level', cgpa: 2.9 },
    { studentId: '2026028', username: 'linda', fullName: 'Linda Binti Mahmud', gender: 'female', dob: '2002-07-30', ic: 'IC-2002073016', mobile: '+673-7123471', address: 'Kampong Sengkurong, Brunei-Muara', email: 'linda@unissa.edu.bn', prevSchool: 'Sekolah Menengah Sengkurong', yearComp: 2025, qualification: 'a_level', cgpa: 3.4 },
    { studentId: '2026029', username: 'aziz', fullName: 'Aziz Bin Hamid', gender: 'male', dob: '2002-09-14', ic: 'IC-2002091417', mobile: '+673-7123472', address: 'Kampong Mulia, Brunei-Muara', email: 'aziz@unissa.edu.bn', prevSchool: 'Sekolah Menengah Mulia', yearComp: 2025, qualification: 'a_level', cgpa: 3.1 },
    { studentId: '2026030', username: 'sarah', fullName: 'Sarah Binti Kamal', gender: 'female', dob: '2002-11-28', ic: 'IC-2002112818', mobile: '+673-7123473', address: 'Kampong Rimba, Brunei-Muara', email: 'sarah@unissa.edu.bn', prevSchool: 'Sekolah Menengah Rimba', yearComp: 2025, qualification: 'a_level', cgpa: 3.7 },
    { studentId: '2026031', username: 'razi', fullName: 'Razi Bin Othman', gender: 'male', dob: '2002-02-06', ic: 'IC-2002020619', mobile: '+673-7123474', address: 'Kampong Bengkurong, Brunei-Muara', email: 'razi@unissa.edu.bn', prevSchool: 'Sekolah Menengah Bengkurong', yearComp: 2025, qualification: 'a_level', cgpa: 2.8 },
    { studentId: '2026032', username: 'maya', fullName: 'Maya Binti Salleh', gender: 'female', dob: '2002-04-20', ic: 'IC-2002042020', mobile: '+673-7123475', address: 'Kampong Katok, Brunei-Muara', email: 'maya@unissa.edu.bn', prevSchool: 'Sekolah Menengah Katok', yearComp: 2025, qualification: 'a_level', cgpa: 3.5 },
    { studentId: '2026033', username: 'faisal', fullName: 'Faisal Bin Yusof', gender: 'male', dob: '2002-06-08', ic: 'IC-2002060821', mobile: '+673-7123476', address: 'Kampong Tanah Jambu, Brunei-Muara', email: 'faisal@unissa.edu.bn', prevSchool: 'Sekolah Menengah Tanah Jambu', yearComp: 2025, qualification: 'a_level', cgpa: 3.2 },
    { studentId: '2026034', username: 'nadia', fullName: 'Nadia Binti Hashim', gender: 'female', dob: '2002-08-16', ic: 'IC-2002081622', mobile: '+673-7123477', address: 'Kampong Salambigar, Brunei-Muara', email: 'nadia@unissa.edu.bn', prevSchool: 'Sekolah Menengah Salambigar', yearComp: 2025, qualification: 'a_level', cgpa: 3.9 },
    { studentId: '2026035', username: 'wafi', fullName: 'Wafi Bin Azlan', gender: 'male', dob: '2002-10-24', ic: 'IC-2002102423', mobile: '+673-7123478', address: 'Kampong Jerudong, Brunei-Muara', email: 'wafi@unissa.edu.bn', prevSchool: 'Sekolah Menengah Jerudong', yearComp: 2025, qualification: 'a_level', cgpa: 3.0 },
    { studentId: '2026036', username: 'hanna', fullName: 'Hanna Binti Karim', gender: 'female', dob: '2002-12-02', ic: 'IC-2002120224', mobile: '+673-7123479', address: 'Kampong Mata-Mata, Brunei-Muara', email: 'hanna@unissa.edu.bn', prevSchool: 'Sekolah Menengah Mata-Mata', yearComp: 2025, qualification: 'a_level', cgpa: 3.4 },
  ]

  for (const ns of additionalStudentsData) {
    const user = await upsertUser({
      username: ns.username,
      displayName: ns.fullName,
      role: 'student',
      email: ns.email,
      hash: hash(PASS),
    })

    const applicant = await upsertApplicant({
      userId: user.id,
      applicationRef: `APP-2026-${ns.studentId}`,
      fullName: ns.fullName,
      icPassport: ns.ic,
      dateOfBirth: new Date(ns.dob),
      gender: ns.gender,
      nationality: 'Brunei Darussalam',
      email: ns.email,
      mobile: ns.mobile,
      homeAddress: ns.address,
      highestQualification: ns.qualification,
      previousInstitution: ns.prevSchool,
      yearOfCompletion: ns.yearComp,
      intakeId: intakeBSC.id,
      programmeId: progBSC.id,
      modeOfStudy: 'full_time',
      status: 'accepted',
      submittedAt: new Date('2026-03-05'),
      decisionMadeAt: new Date('2026-03-20'),
    })

    const student = await upsertStudent({
      studentId: ns.studentId,
      userId: user.id,
      applicantId: applicant.id,
      programmeId: progBSC.id,
      intakeId: intakeBSC.id,
      modeOfStudy: 'full_time',
      nationality: 'Brunei Darussalam',
      studentType: 'standard',
      currentCgpa: ns.cgpa,
      campusCardNo: `CC-${ns.studentId}`,
      libraryAccountActive: true,
      emailAccountActive: true,
      status: 'active',
      enrolledAt: new Date('2026-04-01'),
    })

    await prisma.libraryAccount.upsert({
      where: { studentId: student.id },
      create: { studentId: student.id, accountNo: `LIB-${ns.studentId}`, isActive: true, activatedAt: new Date('2026-04-01') },
      update: {},
    })
  }

  // ── Dashboard Demo: 12 New Applications Today ────────────────
  // 12 accepted = 12 admitted students today
  const todayAt = new Date(); todayAt.setHours(9, 0, 0, 0)
  const todayNames = [
    'Haziq Bin Rosli', 'Nurul Fatin Binti Hamzah', 'Muhammad Aiman Bin Ishak',
    'Siti Rahmah Binti Ariffin', 'Izzatul Akmal Bin Daud', 'Nor Hidayah Binti Saari',
    'Amirul Hakimi Bin Rashid', 'Farhana Binti Zakaria',
    'Khairul Anwar Bin Osman', 'Zulaikha Binti Mansor',
    'Hafizuddin Bin Abdullah', 'Maisarah Binti Ismail',
  ]
  for (let d = 1; d <= 12; d++) {
    const isAccepted = d <= 8
    await prisma.applicant.upsert({
      where: { applicationRef: `APP-2026-T${String(d).padStart(2, '0')}` },
      create: {
        applicationRef: `APP-2026-T${String(d).padStart(2, '0')}`,
        fullName: todayNames[d - 1],
        icPassport: `TD-${String(d).padStart(6, '0')}`,
        dateOfBirth: new Date('2001-06-15'),
        gender: d % 2 === 0 ? 'female' : 'male',
        nationality: 'Brunei Darussalam',
        email: `applicant.today${d}@example.com`,
        mobile: '+673-9000000',
        homeAddress: 'Bandar Seri Begawan, Brunei Darussalam',
        highestQualification: 'a_level',
        previousInstitution: 'Sekolah Menengah Brunei',
        yearOfCompletion: 2025,
        intakeId: intakeBSC.id,
        programmeId: progBSC.id,
        modeOfStudy: 'full_time',
        status: isAccepted ? 'accepted' : 'under_review',
        submittedAt: todayAt,
        decisionMadeAt: isAccepted ? todayAt : null,
      },
      update: {},
    })
  }

  // ── Bulk Student Creation (Total: 1,204 active students) ──────
  const studentFirstNames = ['Ahmad', 'Muhammad', 'Haji', 'Abdul', 'Mohd', 'Ismail', 'Hassan', 'Ibrahim', 'Yusof', 'Rahman', 'Ali', 'Omar', 'Khalid', 'Faisal', 'Nasir', 'Zainal', 'Hamid', 'Aziz', 'Karim', 'Latif', 'Siti', 'Nurul', 'Fatimah', 'Aminah', 'Zainab', 'Khadijah', 'Maryam', 'Aishah', 'Hajar', 'Sarah']
  const studentLastNames = ['Bin Haji Ali', 'Bin Mohd Said', 'Bin Abdul Rahman', 'Bin Haji Ibrahim', 'Bin Abdullah', 'Bin Haji Hassan', 'Bin Mohd Yusof', 'Bin Haji Ahmad', 'Bin Abdul Latif', 'Bin Haji Mahmud', 'Binti Haji Ali', 'Binti Mohd Said', 'Binti Abdul Rahman', 'Binti Haji Ibrahim', 'Binti Abdullah', 'Binti Haji Hassan', 'Binti Mohd Yusof', 'Binti Haji Ahmad', 'Binti Abdul Latif', 'Binti Haji Mahmud']
  const programmes = [progBSC.id, progBA.id]
  const intakes = [intakeBSC.id, intakeBA.id]
  
  for (let i = 37; i <= 1204; i++) {
    const studentId = `2026${String(i).padStart(4, '0')}`
    const firstName = studentFirstNames[(i - 37) % studentFirstNames.length]
    const lastName = studentLastNames[(i - 37) % studentLastNames.length]
    const fullName = `${firstName} ${lastName}`
    const progIdx = (i - 37) % 2
    
    const existingUser = await prisma.user.findUnique({ where: { username: `student${i}` } })
    let userId: string
    if (existingUser) {
      userId = existingUser.id
    } else {
      const newUser = await prisma.user.create({
        data: {
          username: `student${i}`,
          passwordHash: hash(PASS),
          displayName: fullName,
          role: 'student',
          email: `student${i}@unissa.edu.bn`,
        },
      })
      userId = newUser.id
    }

    const applicant = await prisma.applicant.upsert({
      where: { icPassport: `IC-${studentId}` },
      create: {
        applicationRef: `APP-2026-${studentId}`,
        fullName,
        icPassport: `IC-${studentId}`,
        dateOfBirth: new Date(2000 + ((i - 37) % 6), ((i - 37) % 12), ((i - 37) % 28) + 1),
        gender: (i - 37) % 3 === 0 ? 'female' : 'male',
        nationality: 'Brunei Darussalam',
        email: `student${i}@unissa.edu.bn`,
        mobile: `+673-71${String(i).padStart(5, '0')}`,
        homeAddress: 'Bandar Seri Begawan, Brunei Darussalam',
        highestQualification: 'a_level',
        previousInstitution: 'Sekolah Menengah Brunei',
        yearOfCompletion: 2025,
        intakeId: intakes[progIdx],
        programmeId: programmes[progIdx],
        modeOfStudy: 'full_time',
        status: 'accepted',
        submittedAt: new Date('2026-01-15'),
        decisionMadeAt: new Date('2026-02-01'),
      },
      update: {},
    })

    await prisma.student.upsert({
      where: { studentId },
      create: {
        studentId,
        userId,
        applicantId: applicant.id,
        programmeId: programmes[progIdx],
        intakeId: intakes[progIdx],
        modeOfStudy: 'full_time',
        nationality: 'Brunei Darussalam',
        studentType: 'standard',
        currentCgpa: 2.5 + ((i - 37) % 20) * 0.1,
        campusCardNo: `CC-${studentId}`,
        libraryAccountActive: true,
        emailAccountActive: true,
        status: 'active',
        enrolledAt: new Date('2026-04-01'),
      },
      update: {},
    })
  }

  // ── Enrolments: risk students only (Noor is pre-enrollment, not yet enrolled) ──
  for (const s of riskStudents) {
    for (const o of [offeringIFN101, offeringIFN201]) {
      await prisma.enrolment.upsert({
        where: { studentId_offeringId: { studentId: s.id, offeringId: o.id } },
        create: { studentId: s.id, offeringId: o.id, semesterId: semSep2026.id, status: 'registered' },
        update: {},
      })
    }
  }

  // ── Fee Invoices: risk students only (Noor is pre-enrollment, no invoice yet) ──

  // ── Overdue Fee Invoices (Finance dashboard: 3 overdue) ──────
  for (let oi = 0; oi < 3; oi++) {
    const s = riskStudents[oi]
    const pastDue = new Date('2026-02-28')
    pastDue.setDate(pastDue.getDate() - oi * 14)
    await prisma.feeInvoice.upsert({
      where: { invoiceNo: `INV-2026-OD${String(oi + 1).padStart(2, '0')}` },
      create: {
        invoiceNo: `INV-2026-OD${String(oi + 1).padStart(2, '0')}`,
        studentId: s.id,
        semesterId: semSep2026.id,
        tuitionFee: 2400,
        libraryFee: 50,
        hostelDeposit: 0,
        scholarshipDeduction: 0,
        totalAmount: 2450,
        amountPaid: 0,
        outstandingBalance: 2450,
        dueDate: pastDue,
        status: 'overdue',
      },
      update: {},
    })
  }

  // ── Assignment ────────────────────────────────────────────────
  const assignment1 = await prisma.assignment.upsert({
    where: { id: 'asn-ifn101-cs1' },
    create: {
      id: 'asn-ifn101-cs1',
      offeringId: offeringIFN101.id,
      title: 'Case Study 1 – Algorithm Analysis',
      description: 'Analyse the time and space complexity of three sorting algorithms. Provide a comparative study with examples and Big-O notation.',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      maxMarks: 100,
      weightPct: 20,
      rubricCriteria: JSON.stringify([
        { criterion: 'Clarity', max_marks: 25, ai_suggestion: 'Award marks for structured presentation and clear writing' },
        { criterion: 'References', max_marks: 20, ai_suggestion: 'Peer-reviewed sources from IEEE or ACM preferred' },
        { criterion: 'Analysis', max_marks: 35, ai_suggestion: 'Check for correct Big-O derivation' },
        { criterion: 'Presentation', max_marks: 20, ai_suggestion: 'Formatting, headings, and visual aids' },
      ]),
    },
    update: {},
  })

  // ── 14 Assignments Due Today (LMS dashboard) ─────────────────
  const dueToday = new Date(); dueToday.setHours(23, 59, 59, 0)
  const todayAssignments = [
    {
      id: 'asn-t-01', offeringId: offeringIFN101.id, title: 'Weekly Quiz 1 – Variables & Loops',
      description: 'Answer 10 multiple-choice questions on variable declaration, data types, and loop constructs (for, while, do-while). Show your working for any calculation-based questions.',
      maxMarks: 20, weight: 5,
      rubric: [
        { criterion: 'Correctness', max_marks: 14, ai_suggestion: 'Check each answer against the expected output' },
        { criterion: 'Clarity of Working', max_marks: 6, ai_suggestion: 'Award marks for clearly shown steps' },
      ],
    },
    {
      id: 'asn-t-02', offeringId: offeringIFN101.id, title: 'Lab Exercise: Flowchart Design',
      description: 'Design a flowchart for a student grade calculator. The program reads three exam scores, computes the average, and outputs a letter grade (A–F). Include decision diamonds for each grade boundary.',
      maxMarks: 30, weight: 5,
      rubric: [
        { criterion: 'Correctness of Logic', max_marks: 15, ai_suggestion: 'Verify all grade boundary conditions are covered' },
        { criterion: 'Flowchart Notation', max_marks: 10, ai_suggestion: 'Standard symbols for start/end, process, decision' },
        { criterion: 'Readability', max_marks: 5, ai_suggestion: 'Clear labelling and arrow direction' },
      ],
    },
    {
      id: 'asn-t-03', offeringId: offeringIFN101.id, title: 'Reflection Journal Week 4',
      description: 'Write a 200–300 word reflective entry on what you found most challenging this week (loops and conditions) and how you overcame it. Reference at least one specific programming exercise.',
      maxMarks: 10, weight: 2,
      rubric: [
        { criterion: 'Depth of Reflection', max_marks: 5, ai_suggestion: 'Look for genuine insight beyond surface-level observations' },
        { criterion: 'Use of Examples', max_marks: 3, ai_suggestion: 'Specific code or exercise referenced' },
        { criterion: 'Writing Quality', max_marks: 2, ai_suggestion: 'Clear sentences, within word count' },
      ],
    },
    {
      id: 'asn-t-04', offeringId: offeringIFN102.id, title: 'Lab Report 1 – Linked List Implementation',
      description: 'Implement a singly linked list in Python with operations: insert_head, insert_tail, delete_node, search, and display. Include a report (500 words) analysing time complexity of each operation with Big-O justification.',
      maxMarks: 50, weight: 10,
      rubric: [
        { criterion: 'Implementation Correctness', max_marks: 20, ai_suggestion: 'All five operations work on edge cases (empty list, single node)' },
        { criterion: 'Big-O Analysis', max_marks: 15, ai_suggestion: 'Each operation analysed separately with justification' },
        { criterion: 'Code Quality', max_marks: 10, ai_suggestion: 'Readable naming, comments on non-trivial logic' },
        { criterion: 'Report Writing', max_marks: 5, ai_suggestion: 'Clear structure: introduction, analysis, conclusion' },
      ],
    },
    {
      id: 'asn-t-05', offeringId: offeringIFN102.id, title: 'Quiz 2 – Tree Traversal Algorithms',
      description: 'Given a binary search tree diagram, write out the node visit order for: (a) in-order, (b) pre-order, and (c) post-order traversal. Then answer 4 short-answer questions on BST insertion and deletion.',
      maxMarks: 25, weight: 5,
      rubric: [
        { criterion: 'Traversal Sequences', max_marks: 15, ai_suggestion: '5 marks per traversal type; partial credit for mostly correct sequences' },
        { criterion: 'Short Answers', max_marks: 10, ai_suggestion: '2.5 marks each; accept equivalent correct answers' },
      ],
    },
    {
      id: 'asn-t-06', offeringId: offeringIFN102.id, title: 'Problem Set 3 – Sorting Comparisons',
      description: 'Implement Bubble Sort, Merge Sort, and Quick Sort. Run each on arrays of 100, 1,000, and 10,000 random integers. Record execution times, plot a graph, and write a 400-word discussion on your observations vs. theoretical complexity.',
      maxMarks: 40, weight: 8,
      rubric: [
        { criterion: 'Algorithm Implementations', max_marks: 15, ai_suggestion: 'Each algorithm runs correctly on all three input sizes' },
        { criterion: 'Timing Methodology', max_marks: 10, ai_suggestion: 'Reproducible timing approach, multiple runs averaged' },
        { criterion: 'Graph Quality', max_marks: 8, ai_suggestion: 'Axes labelled, legend included, data points visible' },
        { criterion: 'Discussion', max_marks: 7, ai_suggestion: 'Links empirical results to Big-O theory correctly' },
      ],
    },
    {
      id: 'asn-t-07', offeringId: offeringIFN201.id, title: 'ER Diagram Assignment – Library System',
      description: 'Model a university library system with entities: Member, Book, Author, Loan, and Fine. Identify all attributes, primary keys, and relationships (1:1, 1:N, M:N). Normalise to 3NF and justify each step.',
      maxMarks: 100, weight: 15,
      rubric: [
        { criterion: 'Entity & Attribute Completeness', max_marks: 25, ai_suggestion: 'All required entities and their key attributes present' },
        { criterion: 'Relationship Cardinality', max_marks: 25, ai_suggestion: 'Correct multiplicity for all relationships' },
        { criterion: 'Normalisation to 3NF', max_marks: 35, ai_suggestion: 'Demonstrate 1NF → 2NF → 3NF steps with examples' },
        { criterion: 'Diagram Presentation', max_marks: 15, ai_suggestion: 'Standard ER notation, readable layout' },
      ],
    },
    {
      id: 'asn-t-08', offeringId: offeringIFN201.id, title: 'SQL Query Lab – Normalisation Exercise',
      description: 'Given an unnormalised student_enrolment table, write SQL to: (1) identify repeating groups, (2) create a normalised schema, (3) write SELECT queries including at least two JOINs, a GROUP BY, and a HAVING clause.',
      maxMarks: 50, weight: 10,
      rubric: [
        { criterion: 'Normalisation Steps', max_marks: 20, ai_suggestion: 'Correct 1NF/2NF/3NF decomposition with SQL CREATE statements' },
        { criterion: 'Query Correctness', max_marks: 20, ai_suggestion: 'All required clauses present; queries return expected results' },
        { criterion: 'SQL Style', max_marks: 10, ai_suggestion: 'Consistent capitalisation, aliases used appropriately' },
      ],
    },
    {
      id: 'asn-t-09', offeringId: offeringIFN201.id, title: 'Weekly Quiz – Relational Algebra',
      description: 'Translate 6 relational algebra expressions into SQL and vice versa. Expressions involve σ (selection), π (projection), ⋈ (join), and ∪ (union). Show intermediate steps for multi-step expressions.',
      maxMarks: 20, weight: 5,
      rubric: [
        { criterion: 'RA to SQL Translation', max_marks: 12, ai_suggestion: '2 marks each; deduct 1 for wrong clause, 2 for wrong output' },
        { criterion: 'SQL to RA Translation', max_marks: 8, ai_suggestion: 'Correct operator sequence required' },
      ],
    },
    {
      id: 'asn-t-10', offeringId: offeringARA101.id, title: 'Vocabulary Exercise Week 4',
      description: 'Complete 15 fill-in-the-blank sentences using vocabulary from Unit 4 (family, home, and daily routines). Then write 5 original sentences using any 5 new words from this week\'s word list.',
      maxMarks: 30, weight: 5,
      rubric: [
        { criterion: 'Fill-in-the-Blank Accuracy', max_marks: 15, ai_suggestion: '1 mark each; accept contextually correct variants' },
        { criterion: 'Original Sentences', max_marks: 10, ai_suggestion: 'Each sentence is grammatically correct and uses the target word naturally' },
        { criterion: 'Script & Spelling', max_marks: 5, ai_suggestion: 'Check Arabic script accuracy for handwritten submissions' },
      ],
    },
    {
      id: 'asn-t-11', offeringId: offeringARA101.id, title: 'Listening Comprehension Task 2',
      description: 'Listen to the provided audio recording (a 3-minute dialogue about shopping at a market). Answer 8 comprehension questions in Arabic — 4 short-answer and 4 true/false with correction.',
      maxMarks: 20, weight: 4,
      rubric: [
        { criterion: 'Short-Answer Responses', max_marks: 12, ai_suggestion: '3 marks each; deduct 1 for incomplete or partially incorrect answers' },
        { criterion: 'True/False with Correction', max_marks: 8, ai_suggestion: '2 marks each: 1 for correct T/F, 1 for correct written correction' },
      ],
    },
    {
      id: 'asn-t-12', offeringId: offeringClashDemo.id, title: 'Arabic Writing Assessment – Unit 3',
      description: 'Write a 150-word paragraph in Arabic describing your daily university schedule. Use at least 6 time expressions (e.g. بعد الظهر, في الصباح) and 4 verbs in the present tense. Attach a hand-drawn or digital timetable.',
      maxMarks: 50, weight: 10,
      rubric: [
        { criterion: 'Content & Task Completion', max_marks: 20, ai_suggestion: 'All required elements present; word count within range' },
        { criterion: 'Grammar & Verb Usage', max_marks: 15, ai_suggestion: 'Present-tense conjugation checked for subject–verb agreement' },
        { criterion: 'Vocabulary Range', max_marks: 10, ai_suggestion: 'Time expressions varied; not all from the same category' },
        { criterion: 'Script Accuracy', max_marks: 5, ai_suggestion: 'Correct letter forms and connectivity in Arabic script' },
      ],
    },
    {
      id: 'asn-t-13', offeringId: offeringClashDemo.id, title: 'Grammar Quiz – Verb Conjugations',
      description: 'Conjugate 12 Arabic verbs across all singular and plural pronouns (past, present, future tenses). Then identify the root letters (جذر) for each verb and classify its pattern (وزن).',
      maxMarks: 20, weight: 4,
      rubric: [
        { criterion: 'Conjugation Accuracy', max_marks: 12, ai_suggestion: '0.5 marks per correct form; 24 forms total across 12 verbs' },
        { criterion: 'Root & Pattern Identification', max_marks: 8, ai_suggestion: '1 mark each: 0.5 for root, 0.5 for pattern' },
      ],
    },
    {
      id: 'asn-t-14', offeringId: offeringFND101.id, title: 'Foundation Maths – Calculus Problem Set',
      description: 'Solve 6 differentiation problems (product rule, chain rule, implicit) and 4 integration problems (substitution, by parts). Show all working. Final answer must be simplified to lowest terms.',
      maxMarks: 60, weight: 10,
      rubric: [
        { criterion: 'Differentiation (Q1–Q6)', max_marks: 36, ai_suggestion: '6 marks each: 4 for method, 2 for correct simplified answer' },
        { criterion: 'Integration (Q7–Q10)', max_marks: 20, ai_suggestion: '5 marks each: 3 for method, 2 for correct simplified answer' },
        { criterion: 'Working Shown', max_marks: 4, ai_suggestion: 'Deduct 2 if method steps are skipped even where answer is correct' },
      ],
    },
  ]
  for (const a of todayAssignments) {
    await prisma.assignment.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        offeringId: a.offeringId,
        title: a.title,
        description: a.description,
        dueDate: dueToday,
        maxMarks: a.maxMarks,
        weightPct: a.weight,
        rubricCriteria: JSON.stringify(a.rubric),
      },
      update: {},
    })
  }

  // Submissions: risk students only (Noor is pre-enrollment, no submissions yet)

  // ── Attendance ────────────────────────────────────────────────
  const atSess1 = await prisma.attendanceSession.upsert({
    where: { sessionToken: 'demo-session-token-1' },
    create: {
      offeringId: offeringIFN101.id,
      sessionToken: 'demo-session-token-1',
      qrExpiresAt: new Date('2099-01-01'),
      startedAt: new Date('2026-09-08T09:00:00'),
      endedAt: new Date('2026-09-08T11:00:00'),
    },
    update: {},
  })

  // Attendance records: riskStudents[0] = 38%, [1] = 55%
  for (const s of riskStudents) {
    await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: atSess1.id, studentId: s.id } },
      create: { sessionId: atSess1.id, studentId: s.id, status: 'present' },
      update: {},
    })
  }

  // ── GL Codes ──────────────────────────────────────────────────
  // Finance budget: BND 45M total | BND 18.4M committed (40.9%) | BND 13.15M available
  // Each GL Code: committed + spent < totalBudget, leaving at least BND 1M available
  // glIT committed includes BND 900 from the demo completed PR (PR-2026-0035)
  const glTnL = await upsertGl({ code: 'OPEX-TNL-2026', desc: 'Teaching & Learning Operations',  deptId: deptIFN.id, budget: 15000000, committed: 5800000, spent: 4200000 }) // available: 5,000,000
  const glADM = await upsertGl({ code: 'OPEX-ADM-2026', desc: 'Administration & Operations',      deptId: deptADM.id, budget:  8000000, committed: 3100000, spent: 2200000 }) // available: 2,700,000
  const glFAC = await upsertGl({ code: 'CAPEX-FAC-2026',desc: 'Facilities & Capital Projects',    deptId: deptFND.id, budget: 12000000, committed: 5100000, spent: 4000000 }) // available: 2,900,000
  const glHR  = await upsertGl({ code: 'OPEX-HR-2026',  desc: 'HR & Staffing Budget',             deptId: deptADM.id, budget:  7000000, committed: 3200000, spent: 2350000 }) // available: 1,450,000
  const glIT  = await upsertGl({ code: 'OPEX-IT-2026',  desc: 'IT & Digital Infrastructure',      deptId: deptIFN.id, budget:  3000000, committed: 1200000, spent:  700000 }) // available: 1,100,000
  void glTnL; void glFAC; void glHR // used for finance dashboard totals

  // ── Item Categories ───────────────────────────────────────────
  const catIT   = await upsertCat({ code: 'IT-EQP',  name: 'IT Equipment' })
  const catFURN = await upsertCat({ code: 'FURN',    name: 'Office Furniture' })
  const catOFF  = await upsertCat({ code: 'OFF-SUP', name: 'Office Supplies' })
  const catFAC  = await upsertCat({ code: 'FAC-EQP', name: 'Facilities Equipment' })
  const catLAB  = await upsertCat({ code: 'LAB-MAT', name: 'Laboratory Materials' })
  const catMED  = await upsertCat({ code: 'MED-SUP', name: 'Medical & Safety Supplies' })

  // ── Products ──────────────────────────────────────────────────
  // IT Equipment
  await upsertProduct({ code: 'IT-001', name: 'Laptop Computer',              unit: 'unit', defaultUnitPrice: 1200, categoryId: catIT.id,   description: 'Standard business laptop 15"' })
  await upsertProduct({ code: 'IT-002', name: 'Desktop Computer',             unit: 'unit', defaultUnitPrice: 900,  categoryId: catIT.id,   description: 'Office desktop workstation' })
  await upsertProduct({ code: 'IT-003', name: 'Network Switch (24-port)',     unit: 'unit', defaultUnitPrice: 450,  categoryId: catIT.id,   description: '24-port managed network switch' })
  await upsertProduct({ code: 'IT-004', name: 'Wireless Access Point',       unit: 'unit', defaultUnitPrice: 280,  categoryId: catIT.id,   description: 'Enterprise wireless access point' })
  await upsertProduct({ code: 'IT-005', name: 'Projector',                   unit: 'unit', defaultUnitPrice: 750,  categoryId: catIT.id,   description: 'Full HD classroom projector' })
  await upsertProduct({ code: 'IT-006', name: 'Laser Printer',               unit: 'unit', defaultUnitPrice: 320,  categoryId: catIT.id,   description: 'A4 monochrome laser printer' })
  await upsertProduct({ code: 'IT-007', name: 'UPS Battery Backup (1KVA)',   unit: 'unit', defaultUnitPrice: 380,  categoryId: catIT.id,   description: '1KVA uninterruptible power supply' })
  await upsertProduct({ code: 'IT-008', name: 'External Hard Drive (2TB)',   unit: 'unit', defaultUnitPrice: 130,  categoryId: catIT.id,   description: '2TB portable USB external drive' })
  // Office Furniture
  await upsertProduct({ code: 'FN-001', name: 'Ergonomic Office Chair',      unit: 'unit', defaultUnitPrice: 120,  categoryId: catFURN.id, description: 'Height-adjustable ergonomic chair' })
  await upsertProduct({ code: 'FN-002', name: 'Executive Office Chair',      unit: 'unit', defaultUnitPrice: 380,  categoryId: catFURN.id, description: 'High-back executive leather chair' })
  await upsertProduct({ code: 'CHAIR-EXEC-001', name: 'Executive Office Chair (Premium)', unit: 'unit', defaultUnitPrice: 450, categoryId: catFURN.id, description: 'Premium high-back executive chair with lumbar support' })
  await upsertProduct({ code: 'FN-003', name: 'Office Desk (1.2m)',          unit: 'unit', defaultUnitPrice: 250,  categoryId: catFURN.id, description: '1.2m standard office desk' })
  await upsertProduct({ code: 'FN-004', name: 'Filing Cabinet (3-drawer)',   unit: 'unit', defaultUnitPrice: 180,  categoryId: catFURN.id, description: '3-drawer metal filing cabinet' })
  await upsertProduct({ code: 'FN-005', name: 'Bookshelf (5-tier)',          unit: 'unit', defaultUnitPrice: 160,  categoryId: catFURN.id, description: '5-tier adjustable metal bookshelf' })
  await upsertProduct({ code: 'FN-006', name: 'Meeting Table (6-seater)',    unit: 'unit', defaultUnitPrice: 680,  categoryId: catFURN.id, description: '6-seater rectangular conference table' })
  // Office Supplies
  await upsertProduct({ code: 'OS-001', name: 'A4 Paper (Box)',              unit: 'box',  defaultUnitPrice: 22,   categoryId: catOFF.id,  description: '5 reams A4 80gsm copy paper' })
  await upsertProduct({ code: 'OS-002', name: 'Stationery Pack',             unit: 'set',  defaultUnitPrice: 45,   categoryId: catOFF.id,  description: 'Monthly office stationery bundle' })
  await upsertProduct({ code: 'OS-003', name: 'Whiteboard Marker Set',       unit: 'set',  defaultUnitPrice: 12,   categoryId: catOFF.id,  description: 'Assorted colour whiteboard markers' })
  await upsertProduct({ code: 'OS-004', name: 'Toner Cartridge',             unit: 'unit', defaultUnitPrice: 85,   categoryId: catOFF.id,  description: 'Laser printer toner cartridge' })
  await upsertProduct({ code: 'OS-005', name: 'Correction Tape (10-pack)',   unit: 'pack', defaultUnitPrice: 18,   categoryId: catOFF.id,  description: 'Desk correction tape, pack of 10' })
  await upsertProduct({ code: 'OS-006', name: 'Ballpoint Pen (Box of 50)',   unit: 'box',  defaultUnitPrice: 15,   categoryId: catOFF.id,  description: 'Blue ballpoint pens, box of 50' })
  // Facilities Equipment
  await upsertProduct({ code: 'FC-001', name: 'Air Conditioner (1.5HP)',     unit: 'unit', defaultUnitPrice: 960,  categoryId: catFAC.id,  description: 'Split-type air conditioner 1.5HP' })
  await upsertProduct({ code: 'FC-002', name: 'Water Dispenser',             unit: 'unit', defaultUnitPrice: 280,  categoryId: catFAC.id,  description: 'Hot and cold water dispenser' })
  await upsertProduct({ code: 'FC-003', name: 'Industrial Fan (Stand)',      unit: 'unit', defaultUnitPrice: 95,   categoryId: catFAC.id,  description: 'Heavy-duty standing industrial fan' })
  await upsertProduct({ code: 'FC-004', name: 'CCTV Camera Kit (4-ch)',      unit: 'set',  defaultUnitPrice: 620,  categoryId: catFAC.id,  description: '4-channel CCTV kit with DVR' })
  // Laboratory Materials
  await upsertProduct({ code: 'LB-001', name: 'Microscope (Binocular)',      unit: 'unit', defaultUnitPrice: 1450, categoryId: catLAB.id,  description: 'Binocular compound microscope, 40-1000x' })
  await upsertProduct({ code: 'LB-002', name: 'Digital Weighing Scale',      unit: 'unit', defaultUnitPrice: 220,  categoryId: catLAB.id,  description: 'Lab precision scale, 0.001g accuracy' })
  await upsertProduct({ code: 'LB-003', name: 'Beaker Set (Borosilicate)',   unit: 'set',  defaultUnitPrice: 65,   categoryId: catLAB.id,  description: 'Borosilicate glass beaker set 5 pcs' })
  await upsertProduct({ code: 'LB-004', name: 'Reagent Grade Ethanol (1L)',  unit: 'unit', defaultUnitPrice: 38,   categoryId: catLAB.id,  description: '95% reagent grade ethanol 1 litre' })
  await upsertProduct({ code: 'LB-005', name: 'Safety Gloves (Latex, 100)', unit: 'box',  defaultUnitPrice: 22,   categoryId: catLAB.id,  description: 'Disposable latex gloves box of 100' })
  await upsertProduct({ code: 'LB-006', name: 'Lab Coat (Medium)',           unit: 'unit', defaultUnitPrice: 35,   categoryId: catLAB.id,  description: 'White cotton lab coat, medium size' })
  await upsertProduct({ code: 'LB-007', name: 'pH Meter (Digital)',          unit: 'unit', defaultUnitPrice: 185,  categoryId: catLAB.id,  description: 'Digital pH meter with calibration kit' })
  await upsertProduct({ code: 'LB-008', name: 'Bunsen Burner',               unit: 'unit', defaultUnitPrice: 75,   categoryId: catLAB.id,  description: 'Laboratory Bunsen burner with gas fitting' })
  // Medical & Safety Supplies
  await upsertProduct({ code: 'MD-001', name: 'First Aid Kit (Standard)',    unit: 'unit', defaultUnitPrice: 85,   categoryId: catMED.id,  description: 'Standard 50-item first aid kit' })
  await upsertProduct({ code: 'MD-002', name: 'Fire Extinguisher (CO2)',     unit: 'unit', defaultUnitPrice: 145,  categoryId: catMED.id,  description: '2kg CO2 fire extinguisher' })
  await upsertProduct({ code: 'MD-003', name: 'Safety Helmet (Hard Hat)',    unit: 'unit', defaultUnitPrice: 28,   categoryId: catMED.id,  description: 'ANSI-rated construction hard hat' })
  await upsertProduct({ code: 'MD-004', name: 'Face Mask (N95, 20-pack)',    unit: 'pack', defaultUnitPrice: 45,   categoryId: catMED.id,  description: 'N95 respirator masks, pack of 20' })

  // ── Vendors ───────────────────────────────────────────────────
  const vTechMart   = await upsertVendor({ name: 'TechMart BN',          cat: catIT.id,   email: 'sales@techmart.com.bn' })
  const vOffSupplies= await upsertVendor({ name: 'Office Supplies Co.',   cat: catOFF.id,  email: 'info@officesupplies.com.bn' })
  const vFurniture  = await upsertVendor({ name: 'Furniture World BN',    cat: catFURN.id, email: 'orders@furnitureworld.com.bn' })
  const vITSol      = await upsertVendor({ name: 'IT Solutions Brunei',   cat: catIT.id,   email: 'sales@itsolutions.com.bn' })
  const vStation    = await upsertVendor({ name: 'Stationery Hub',        cat: catOFF.id,  email: 'hub@stationery.com.bn' })

  // ── Vendor Price History (for anomaly detection baseline) ─────
  for (const price of [350, 380, 360, 370]) {
    await prisma.vendorPriceHistory.create({
      data: { vendorId: vFurniture.id, categoryId: catFURN.id, itemDesc: 'Office Chair', unitPrice: price, recordedAt: new Date(Date.now() - Math.random() * 180 * 86400000) },
    })
  }
  // Outlier price for anomaly
  await prisma.vendorPriceHistory.create({
    data: { vendorId: vITSol.id, categoryId: catFURN.id, itemDesc: 'Office Chair', unitPrice: 500, recordedAt: new Date(Date.now() - 10 * 86400000) },
  })

  // ── Purchase Requests ─────────────────────────────────────────
  // Main demo PR: Chairs BND 1,200 — pending L1 approval
  const prChairs = await prisma.purchaseRequest.upsert({
    where: { prNumber: 'PR-2026-0042' },
    create: {
      prNumber: 'PR-2026-0042',
      requestorId: staffManager.id,
      departmentId: deptADM.id,
      itemCategoryId: catFURN.id,
      itemDescription: 'Ergonomic office chairs for Administration Department. Required to replace worn-out chairs in main office area. 12 units needed for staff workstations.',
      quantity: 12,
      estimatedUnitPrice: 100,
      totalAmount: 1200,
      glCodeId: glADM.id,
      requiredByDate: new Date(Date.now() + 14 * 86400000),
      recommendedVendorId: vFurniture.id,
      vendorSelectionJustification: null,
      quoteTrafficLight: 'green',
      status: 'submitted',
      submittedAt: new Date(Date.now() - 2 * 86400000),
    },
    update: {},
  })

  // 3 quotes for main PR
  for (const q of [
    { quoteNumber: 1, vendorName: 'Furniture World BN', vendorId: vFurniture.id, quotedPrice: 100 },
    { quoteNumber: 2, vendorName: 'Office Supplies Co.', vendorId: vOffSupplies.id, quotedPrice: 115 },
    { quoteNumber: 3, vendorName: 'Stationery Hub', vendorId: vStation.id, quotedPrice: 128 },
  ]) {
    await prisma.prQuote.upsert({
      where: { prId_quoteNumber: { prId: prChairs.id, quoteNumber: q.quoteNumber } },
      create: { prId: prChairs.id, ...q },
      update: {},
    })
  }

  // PR-2026-0038: price anomaly (z-score 2.4)
  const prAnomaly1 = await prisma.purchaseRequest.upsert({
    where: { prNumber: 'PR-2026-0038' },
    create: {
      prNumber: 'PR-2026-0038',
      requestorId: staffManager.id,
      departmentId: deptADM.id,
      itemCategoryId: catFURN.id,
      itemDescription: 'Executive office chairs for management suite',
      quantity: 5,
      estimatedUnitPrice: 500,
      totalAmount: 2000 - 1, // just under threshold
      glCodeId: glADM.id,
      requiredByDate: new Date(Date.now() + 7 * 86400000),
      recommendedVendorId: vITSol.id,
      quoteTrafficLight: 'green',
      status: 'dept_approved',
      submittedAt: new Date(Date.now() - 5 * 86400000),
      anomalyFlags: JSON.stringify([{ type: 'price_outlier', description: 'Vendor price 34% above market average', severity: 'high' }]),
    },
    update: {},
  })

  await prisma.procurementAnomaly.upsert({
    where: { id: 'anom-pr-0038' },
    create: {
      id: 'anom-pr-0038',
      prId: prAnomaly1.id,
      anomalyType: 'price_outlier',
      description: 'Vendor price BND 500/unit is 34% above market average for similar office chairs in the last 6 months (avg: BND 365/unit)',
      severity: 'high',
      zScore: 2.4,
      comparisonData: JSON.stringify([
        { vendor: 'Furniture World BN', price: 100, date: '2026-01-15' },
        { vendor: 'Office Supplies Co.', price: 115, date: '2026-02-10' },
        { vendor: 'Furniture World BN', price: 95, date: '2025-11-20' },
        { vendor: 'IT Solutions Brunei', price: 500, date: '2026-03-14', flagged: true },
      ]),
      status: 'open',
    },
    update: {},
  })

  // PR-2026-0041: split-billing anomaly
  const prAnomaly2 = await prisma.purchaseRequest.upsert({
    where: { prNumber: 'PR-2026-0041' },
    create: {
      prNumber: 'PR-2026-0041',
      requestorId: staffManager.id,
      departmentId: deptADM.id,
      itemCategoryId: catOFF.id,
      itemDescription: 'Office stationery bulk purchase – monthly supply',
      quantity: 10,
      estimatedUnitPrice: 95,
      totalAmount: 950,
      glCodeId: glADM.id,
      requiredByDate: new Date(Date.now() + 5 * 86400000),
      recommendedVendorId: vStation.id,
      quoteTrafficLight: 'green',
      status: 'submitted',
      submittedAt: new Date(Date.now() - 1 * 86400000),
      anomalyFlags: JSON.stringify([{ type: 'split_billing', description: 'Same vendor 8 times this month', severity: 'medium' }]),
    },
    update: {},
  })

  await prisma.procurementAnomaly.upsert({
    where: { id: 'anom-pr-0041' },
    create: {
      id: 'anom-pr-0041',
      prId: prAnomaly2.id,
      anomalyType: 'split_billing',
      description: 'Stationery Hub has been used 8 times this month by the same department, totalling BND 7,600 — possible split-billing to avoid the BND 2,000 tender threshold.',
      severity: 'medium',
      zScore: null,
      status: 'open',
    },
    update: {},
  })

  // ── Complete PR lifecycle: submitted → approved (3 levels) → PO generated ──
  // Demonstrates committed budget update end-to-end (900 already in glIT.committedAmount)
  const prApproved = await prisma.purchaseRequest.upsert({
    where: { prNumber: 'PR-2026-0035' },
    create: {
      prNumber: 'PR-2026-0035',
      requestorId: staffSiti.id,
      departmentId: deptIFN.id,
      itemCategoryId: catIT.id,
      itemDescription: 'Network switch for Lab 3 infrastructure upgrade',
      quantity: 2, estimatedUnitPrice: 450, totalAmount: 900,
      glCodeId: glIT.id,
      requiredByDate: new Date(Date.now() + 21 * 86400000),
      recommendedVendorId: vTechMart.id,
      quoteTrafficLight: 'green', status: 'converted_to_po',
      submittedAt: new Date(Date.now() - 10 * 86400000),
    },
    update: { status: 'converted_to_po' },
  })

  // Approval trail — create only once (no unique key on prId+level, guard with count)
  const existingApprovals = await prisma.prApproval.count({ where: { prId: prApproved.id } })
  if (existingApprovals === 0) {
    await prisma.prApproval.createMany({
      data: [
        { prId: prApproved.id, level: 1, approverId: uManager.id, action: 'approved', remarks: 'Approved — required for lab infrastructure upgrade',        actedAt: new Date(Date.now() - 9 * 86400000) },
        { prId: prApproved.id, level: 2, approverId: uFinance.id, action: 'approved', remarks: 'Budget confirmed — OPEX-IT-2026 has sufficient funds',       actedAt: new Date(Date.now() - 8 * 86400000) },
        { prId: prApproved.id, level: 3, approverId: uAdmin.id,   action: 'approved', remarks: 'Final approval granted. Proceed with purchase order.',       actedAt: new Date(Date.now() - 7 * 86400000) },
      ],
    })
  }

  // PO record for the completed PR
  await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-2026-0001' },
    create: {
      poNumber: 'PO-2026-0001',
      prId: prApproved.id,
      vendorId: vTechMart.id,
      totalAmount: 900,
      glCodeId: glIT.id,
      status: 'issued',
    },
    update: {},
  })

  // ── Research Grants ───────────────────────────────────────────
  // 12 active grants totalling BND 2.1M | utilisation 38% = BND 798K
  // 5 proposals pending review
  await upsertGrant({ ref: 'RG-2026-001', title: 'AI-Enhanced Adaptive Learning Systems for Tertiary Education',  piId: staffAhmad.id, deptId: deptIFN.id, budget: 450000, utilised: 171000, status: 'active' })
  await upsertGrant({ ref: 'RG-2026-002', title: 'Digital Preservation of Brunei Islamic Manuscripts',            piId: staffAhmad.id, deptId: deptARA.id, budget: 380000, utilised:  95000, status: 'active' })
  await upsertGrant({ ref: 'RG-2026-003', title: 'Cybersecurity Framework for Smart Campus Infrastructure',       piId: staffSiti.id,  deptId: deptIFN.id, budget: 220000, utilised:       0, status: 'proposal_submitted' })
  // Additional active grants (10 more → 12 active total; 10 × BND 127K = BND 1,270K → 2.1M total)
  const additionalActiveGrants = [
    { ref: 'RG-2026-004', title: 'Green Energy Solutions for UNISSA Campus',                     piId: staffSiti.id,  deptId: deptFND.id },
    { ref: 'RG-2026-005', title: 'Islamic Finance Innovation in Digital Banking',                 piId: staffAhmad.id, deptId: deptARA.id },
    { ref: 'RG-2026-006', title: 'Biodiversity Assessment of Brunei Mangrove Ecosystems',        piId: staffSiti.id,  deptId: deptFND.id },
    { ref: 'RG-2026-007', title: 'Machine Learning for Halal Food Authentication',               piId: staffAhmad.id, deptId: deptIFN.id },
    { ref: 'RG-2026-008', title: 'Smart Transportation Systems for Bandar Seri Begawan',         piId: staffSiti.id,  deptId: deptIFN.id },
    { ref: 'RG-2026-009', title: 'Arabic NLP Toolkits for Digital Learning Platforms',           piId: staffAhmad.id, deptId: deptARA.id },
    { ref: 'RG-2026-010', title: 'Quantum Computing Applications in Post-Quantum Cryptography',  piId: staffSiti.id,  deptId: deptIFN.id },
    { ref: 'RG-2026-011', title: 'Traditional Medicine Knowledge Digitisation Project',          piId: staffAhmad.id, deptId: deptFND.id },
    { ref: 'RG-2026-012', title: 'Water Quality Monitoring IoT System for Brunei Rivers',        piId: staffSiti.id,  deptId: deptFND.id },
    { ref: 'RG-2026-013', title: 'Cultural Heritage 3D Digitalisation and Virtual Museum',       piId: staffAhmad.id, deptId: deptARA.id },
  ]
  for (const g of additionalActiveGrants) {
    await upsertGrant({ ref: g.ref, title: g.title, piId: g.piId, deptId: g.deptId, budget: 127000, utilised: 53200, status: 'active' })
  }
  // 4 additional proposals (→ 5 proposals total including RG-2026-003)
  const additionalProposals = [
    { ref: 'RG-2026-014', title: 'Carbon Footprint Reduction in University Campus Operations',   piId: staffSiti.id,  deptId: deptFND.id },
    { ref: 'RG-2026-015', title: 'Social Media Impact on Youth Mental Health in Brunei',         piId: staffAhmad.id, deptId: deptADM.id },
    { ref: 'RG-2026-016', title: 'Advanced Robotics for Industrial Automation Applications',     piId: staffSiti.id,  deptId: deptIFN.id },
    { ref: 'RG-2026-017', title: 'Islamic Architecture Digital Archive and Pattern Analysis',    piId: staffAhmad.id, deptId: deptARA.id },
  ]
  for (const g of additionalProposals) {
    await upsertGrant({ ref: g.ref, title: g.title, piId: g.piId, deptId: g.deptId, budget: 180000, utilised: 0, status: 'proposal_submitted' })
  }

  // ── Student Risk Scores ───────────────────────────────────────
  // Student A (riskStudents[0]): high risk
  await prisma.studentRiskScore.upsert({
    where: { studentId_offeringId: { studentId: riskStudents[0].id, offeringId: offeringIFN101.id } },
    create: {
      studentId: riskStudents[0].id, offeringId: offeringIFN101.id,
      attendancePct: 38, quizAvg: 41, submissionRate: 40,
      riskScore: 0.85, predictedOutcome: 'fail', confidence: 85,
    },
    update: {},
  })
  // Student B (riskStudents[1]): at risk
  await prisma.studentRiskScore.upsert({
    where: { studentId_offeringId: { studentId: riskStudents[1].id, offeringId: offeringIFN101.id } },
    create: {
      studentId: riskStudents[1].id, offeringId: offeringIFN101.id,
      attendancePct: 55, quizAvg: 58, submissionRate: 60,
      riskScore: 0.62, predictedOutcome: 'at_risk', confidence: 72,
    },
    update: {},
  })
  // Risk scores: risk students only (Noor is pre-enrollment, no risk score yet)

  // ── Campus Vehicles ───────────────────────────────────────────
  const vehicles = [
    { plate: 'B-1234', model: 'Toyota Hilux', type: 'truck', status: 'in_use' },
    { plate: 'B-2345', model: 'Toyota Hiace', type: 'van', status: 'in_use' },
    { plate: 'B-3456', model: 'Mitsubishi Fuso', type: 'bus', status: 'in_use' },
    { plate: 'B-4567', model: 'Honda Civic', type: 'sedan', status: 'in_use' },
    { plate: 'B-5678', model: 'Toyota Fortuner', type: 'sedan', status: 'in_use' },
    { plate: 'B-6789', model: 'Ford Ranger', type: 'truck', status: 'in_use' },
    { plate: 'B-7890', model: 'Toyota Camry', type: 'sedan', status: 'available' },
    { plate: 'B-8901', model: 'Honda CR-V', type: 'sedan', status: 'available' },
    { plate: 'B-9012', model: 'Nissan Urvan', type: 'van', status: 'available' },
    { plate: 'B-0123', model: 'Isuzu NPR', type: 'truck', status: 'maintenance' },
  ]
  for (const v of vehicles) {
    await prisma.campusVehicle.upsert({
      where: { plateNo: v.plate },
      create: { plateNo: v.plate, model: v.model, vehicleType: v.type, status: v.status },
      update: { status: v.status },
    })
  }

  // ── Facility Bookings (today = 34) ────────────────────────────
  const facilities = await prisma.campusFacility.findMany({ take: 10 })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 34; i++) {
    await prisma.facilityBooking.create({
      data: {
        facilityId: facilities[i % facilities.length].id,
        bookedById: uAdmin.id,
        bookingDate: today,
        startTime: `${8 + (i % 10)}:00`,
        endTime: `${9 + (i % 10)}:00`,
        purpose: `Class / Meeting ${i + 1}`,
        status: 'confirmed',
      },
    })
  }

  // ── Executive Insights ────────────────────────────────────────
  const expires30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await prisma.notification.deleteMany({})
  await prisma.executiveInsight.deleteMany({})
  for (const ins of [
    {
      insightType: 'procurement',
      title: '3 Purchase Requests Pending Approval',
      body: 'PR-2026-0042 (ergonomic chairs, BND 1,200), PR-2026-0041 (office stationery, BND 950), and PR-2026-0038 (executive chairs, BND 1,999) are awaiting approval — total value BND 4,149. Oldest request is 5 days old.',
      severity: 'warning',
      expiresAt: expires30d,
    },
    {
      insightType: 'procurement',
      title: '2 Open Procurement Anomalies Require Review',
      body: 'PR-2026-0038 flagged for price outlier: vendor quoted BND 500/unit vs. market average BND 365/unit (+34%, z-score 2.4). PR-2026-0041 flagged for split-billing: same vendor (Stationery Hub) used 8 times this month, totalling BND 7,600.',
      severity: 'critical',
      expiresAt: expires30d,
    },
    {
      insightType: 'finance',
      title: '3 Overdue Fee Invoices Total BND 7,350',
      body: 'Invoices INV-2026-OD01, INV-2026-OD02, and INV-2026-OD03 are past due (BND 2,450 each). The oldest is more than 35 days overdue. Student accounts require immediate follow-up by the Finance team.',
      severity: 'warning',
      expiresAt: expires30d,
    },
    {
      insightType: 'finance',
      title: 'Operating Budget 70.8% Committed — Year-End Review Needed',
      body: 'Total budget BND 45M across 5 GL codes: BND 18.4M committed and BND 13.45M spent, leaving BND 13.15M available. OPEX-FAC-2026 (Facilities) is the tightest at 75.8% of budget committed or spent.',
      severity: 'info',
      expiresAt: expires30d,
    },
    {
      insightType: 'academic',
      title: '2 Students At Risk of Academic Failure in IFN101',
      body: 'AI risk analysis flagged Student 001 (attendance 38%, quiz avg 41%, risk score 0.85 — predicted: fail) and Student 002 (attendance 55%, quiz avg 58%, risk score 0.72) in IFN101. Early intervention recommended.',
      severity: 'warning',
      expiresAt: expires30d,
    },
    {
      insightType: 'hr',
      title: '4 Leave Requests Awaiting HR Approval',
      body: '4 staff leave requests are pending approval. 7 out of 312 active staff are currently on approved leave (2.2%). 2 new hires joined this month — onboarding completion should be verified.',
      severity: 'info',
      expiresAt: expires30d,
    },
    {
      insightType: 'academic',
      title: 'Research Pipeline: 12 Active Grants, 5 Proposals Pending',
      body: '12 active research grants totalling BND 2.10M at 38% utilisation (BND 798K disbursed). 5 proposals are pending review, including Cybersecurity for Smart Campus (RG-2026-003) and Carbon Footprint Reduction (RG-2026-014). RG-2026-001 (AI-Enhanced Learning, BND 450K) is the largest active grant.',
      severity: 'info',
      expiresAt: expires30d,
    },
  ]) {
    await prisma.executiveInsight.create({ data: ins })
  }

  // ── Notification Templates ────────────────────────────────────
  const templates = [
    { eventKey: 'course_registration_confirmed', subjectTpl: 'Course Registration Confirmed – {{semester}}', bodyTpl: 'Dear {{studentName}}, your course registration for {{semester}} has been confirmed. {{courseCount}} courses, {{totalCH}} credit hours.', channels: '["email","push"]' },
    { eventKey: 'payment_received', subjectTpl: 'Payment Receipt – {{transactionRef}}', bodyTpl: 'Payment of BND {{amount}} received. Reference: {{transactionRef}}. Invoice {{invoiceNo}} is now PAID.', channels: '["email","push"]' },
    { eventKey: 'pr_approved_l1', subjectTpl: 'PR {{prNumber}} Approved – Level 1', bodyTpl: 'Your Purchase Request {{prNumber}} has been approved by the Department Head and forwarded to Finance.', channels: '["email","push"]' },
    { eventKey: 'admission_offer_letter', subjectTpl: 'Congratulations – Admission Offer from UNISSA', bodyTpl: 'Dear {{applicantName}}, we are pleased to offer you admission to {{programme}} commencing {{intake}}.', channels: '["email"]' },
    { eventKey: 'grade_released', subjectTpl: '{{courseCode}} – Grade Released', bodyTpl: 'Your grade for {{assignmentTitle}} has been released: {{grade}} ({{marks}}/100).', channels: '["push"]' },
  ]
  for (const t of templates) {
    await prisma.notificationTemplate.upsert({ where: { eventKey: t.eventKey }, create: t, update: {} })
  }

  console.log('\n✅ Seed complete! Demo data ready.\n')
  console.log('Demo Accounts:')
  console.log('  noor        / Demo@2026  → Student Portal (pre-enrollment applicant — offered)')
  console.log('  zara        / Demo@2026  → Scene 1 Demo: Noor Aisyah — clean state, apply for admission')
  console.log('  admissions  / Demo@2026  → Admission Dashboard')
  console.log('  drsiti      / Demo@2026  → LMS Instructor')
  console.log('  manager     / Demo@2026  → Approval Inbox')
  console.log('  finance     / Demo@2026  → Finance Dashboard')
  console.log('  admin       / Demo@2026  → Command Center\n')
}

// ── Helper upsert functions ──────────────────────────────────

async function upsertDept(d: { code: string; name: string }) {
  return prisma.department.upsert({
    where: { code: d.code },
    create: { code: d.code, name: d.name },
    update: {},
  })
}

async function upsertUser(u: { username: string; displayName: string; role: string; email: string; hash: string }) {
  return prisma.user.upsert({
    where: { username: u.username },
    create: { username: u.username, passwordHash: u.hash, displayName: u.displayName, role: u.role, email: u.email },
    update: { displayName: u.displayName, email: u.email },
  })
}

async function upsertStaff(s: { staffId: string; userId: string; departmentId: string; fullName: string; designation: string; salary: number }) {
  return prisma.staff.upsert({
    where: { staffId: s.staffId },
    create: {
      staffId: s.staffId, userId: s.userId, departmentId: s.departmentId,
      fullName: s.fullName, icPassport: `IC-${s.staffId}`,
      dateOfBirth: new Date('1985-01-01'), gender: 'male',
      designation: s.designation, employmentType: 'permanent',
      joinDate: new Date('2020-01-01'), payrollBasicSalary: s.salary,
      lmsInstructorActive: true,
    },
    update: {},
  })
}

async function upsertProgramme(p: { code: string; name: string; departmentId: string; level: string; durationYears: number; feeLocal: number; feeIntl: number }) {
  return prisma.programme.upsert({
    where: { code: p.code },
    create: {
      code: p.code, name: p.name, departmentId: p.departmentId,
      level: p.level, durationYears: p.durationYears,
      feeLocalPerCh: p.feeLocal, feeInternationalPerCh: p.feeIntl,
      minEntryGrade: '{"Mathematics":"B","English":"C"}',
    },
    update: {},
  })
}

async function upsertCourse(c: { code: string; name: string; departmentId: string; ch: number; level: number }) {
  return prisma.course.upsert({
    where: { code: c.code },
    create: { code: c.code, name: c.name, departmentId: c.departmentId, creditHours: c.ch, level: c.level, maxSeats: 40 },
    update: {},
  })
}

async function upsertFacility(f: { code: string; name: string; type: string; capacity: number; building: string }) {
  return prisma.campusFacility.upsert({
    where: { code: f.code },
    create: f,
    update: {},
  })
}

async function upsertOffering(o: { courseId: string; semesterId: string; lecturerId: string; departmentId: string; day: string; start: string; end: string; room: string; roomId: string }) {
  return prisma.courseOffering.upsert({
    where: { courseId_semesterId_dayOfWeek_startTime: { courseId: o.courseId, semesterId: o.semesterId, dayOfWeek: o.day, startTime: o.start } },
    create: { courseId: o.courseId, semesterId: o.semesterId, lecturerId: o.lecturerId, departmentId: o.departmentId, dayOfWeek: o.day, startTime: o.start, endTime: o.end, room: o.room },
    update: {},
  })
}

async function upsertGl(g: { code: string; desc: string; deptId: string; budget: number; committed: number; spent: number }) {
  return prisma.glCode.upsert({
    where: { code: g.code },
    create: { code: g.code, description: g.desc, departmentId: g.deptId, totalBudget: g.budget, committedAmount: g.committed, spentAmount: g.spent, fiscalYear: 2026 },
    update: { totalBudget: g.budget, committedAmount: g.committed, spentAmount: g.spent },
  })
}

async function upsertCat(c: { code: string; name: string }) {
  return prisma.itemCategory.upsert({ where: { code: c.code }, create: c, update: {} })
}

async function upsertProduct(p: { code: string; name: string; unit: string; defaultUnitPrice: number; categoryId: string; description?: string }) {
  return prisma.product.upsert({
    where: { code: p.code },
    create: p,
    update: { name: p.name, defaultUnitPrice: p.defaultUnitPrice, unit: p.unit, description: p.description },
  })
}

async function upsertVendor(v: { name: string; cat: string; email: string }) {
  const existing = await prisma.vendor.findFirst({ where: { name: v.name } })
  if (existing) return existing
  return prisma.vendor.create({ data: { name: v.name, categoryId: v.cat, contactEmail: v.email } })
}

async function upsertGrant(g: { ref: string; title: string; piId: string; deptId: string; budget: number; utilised: number; status: string }) {
  const isProposal = g.status === 'proposal_submitted'
  const abstract = isProposal
    ? `This research investigates ${g.title.toLowerCase()} with the objective of advancing knowledge and practical applications within the UNISSA academic community. The methodology combines empirical data collection, quantitative analysis, and collaborative engagement with industry partners. Expected outcomes include peer-reviewed publications, a pilot implementation framework, and capacity-building workshops for faculty and students. The research addresses a gap identified in current literature and aligns with UNISSA's strategic research agenda for 2026–2028.`
    : `Research project: ${g.title}. This grant aims to advance knowledge and innovation in the relevant field at UNISSA.`
  return prisma.researchGrant.upsert({
    where: { referenceNo: g.ref },
    create: {
      referenceNo: g.ref, title: g.title, principalInvestigatorId: g.piId,
      departmentId: g.deptId, abstract,
      durationMonths: isProposal ? 18 : 24, totalBudget: g.budget, amountUtilised: g.utilised, status: g.status,
      submittedAt: isProposal ? new Date('2026-03-15T09:00:00Z') : undefined,
    },
    update: { totalBudget: g.budget, amountUtilised: g.utilised, status: g.status },
  })
}

async function upsertApplicant(a: {
  userId: string
  applicationRef: string
  fullName: string
  icPassport: string
  dateOfBirth: Date
  gender: string
  nationality: string
  email: string
  mobile: string
  homeAddress: string
  highestQualification: string
  previousInstitution: string
  yearOfCompletion: number
  intakeId: string
  programmeId: string
  modeOfStudy: string
  status: string
  submittedAt?: Date
  decisionMadeAt?: Date
}) {
  return prisma.applicant.upsert({
    where: { applicationRef: a.applicationRef },
    create: {
      userId: a.userId,
      applicationRef: a.applicationRef,
      fullName: a.fullName,
      icPassport: a.icPassport,
      dateOfBirth: a.dateOfBirth,
      gender: a.gender,
      nationality: a.nationality,
      email: a.email,
      mobile: a.mobile,
      homeAddress: a.homeAddress,
      highestQualification: a.highestQualification,
      previousInstitution: a.previousInstitution,
      yearOfCompletion: a.yearOfCompletion,
      intakeId: a.intakeId,
      programmeId: a.programmeId,
      modeOfStudy: a.modeOfStudy,
      status: a.status,
      submittedAt: a.submittedAt,
      decisionMadeAt: a.decisionMadeAt,
    },
    update: {},
  })
}

async function upsertStudent(s: {
  studentId: string
  userId: string
  applicantId: string
  programmeId: string
  intakeId: string
  modeOfStudy: string
  nationality: string
  studentType?: string
  currentCgpa?: number
  campusCardNo?: string
  libraryAccountActive?: boolean
  emailAccountActive?: boolean
  status?: string
  enrolledAt?: Date
}) {
  return prisma.student.upsert({
    where: { studentId: s.studentId },
    create: {
      studentId: s.studentId,
      userId: s.userId,
      applicantId: s.applicantId,
      programmeId: s.programmeId,
      intakeId: s.intakeId,
      modeOfStudy: s.modeOfStudy,
      nationality: s.nationality,
      studentType: s.studentType || 'standard',
      currentCgpa: s.currentCgpa || 0.00,
      campusCardNo: s.campusCardNo,
      libraryAccountActive: s.libraryAccountActive || false,
      emailAccountActive: s.emailAccountActive || false,
      status: s.status || 'active',
      enrolledAt: s.enrolledAt || new Date(),
    },
    update: {},
  })
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
