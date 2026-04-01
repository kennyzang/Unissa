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
      status: 'under_review',
      submittedAt: new Date('2026-03-10'),
    },
    update: { userId: uNoor.id, status: 'under_review' },
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

  // ── Student: Noor (accepted) ─────────────────────────────────
  const studentNoor = await prisma.student.upsert({
    where: { studentId: '2026001' },
    create: {
      studentId: '2026001',
      userId: uNoor.id,
      applicantId: applicantNoor.id,
      programmeId: progBSC.id,
      intakeId: intakeBSC.id,
      modeOfStudy: 'full_time',
      nationality: 'Brunei Darussalam',
      studentType: 'standard',
      currentCgpa: 3.10,
      scholarshipPct: 0,
      campusCardNo: 'CC-2026001',
      libraryAccountActive: true,
      emailAccountActive: true,
      status: 'active',
      enrolledAt: new Date('2026-04-01'),
    },
    update: {},
  })

  // Library account for Noor
  await prisma.libraryAccount.upsert({
    where: { studentId: studentNoor.id },
    create: { studentId: studentNoor.id, accountNo: 'LIB-2026001', isActive: true, activatedAt: new Date('2026-04-01') },
    update: {},
  })

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
    const isAccepted = d <= 12
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

  // ── Enrolments: Noor ─────────────────────────────────────────
  for (const offering of [offeringIFN101, offeringIFN102, offeringIFN201, offeringARA101]) {
    await prisma.enrolment.upsert({
      where: { studentId_offeringId: { studentId: studentNoor.id, offeringId: offering.id } },
      create: { studentId: studentNoor.id, offeringId: offering.id, semesterId: semSep2026.id, status: 'registered', registeredAt: new Date('2026-04-05') },
      update: {},
    })
  }

  // Enrol risk students in IFN101 + IFN201
  for (const s of riskStudents) {
    for (const o of [offeringIFN101, offeringIFN201]) {
      await prisma.enrolment.upsert({
        where: { studentId_offeringId: { studentId: s.id, offeringId: o.id } },
        create: { studentId: s.id, offeringId: o.id, semesterId: semSep2026.id, status: 'registered' },
        update: {},
      })
    }
  }

  // ── Fee Invoice: Noor ─────────────────────────────────────────
  await prisma.feeInvoice.upsert({
    where: { invoiceNo: 'INV-2026-0001' },
    create: {
      invoiceNo: 'INV-2026-0001',
      studentId: studentNoor.id,
      semesterId: semSep2026.id,
      tuitionFee: 3200,   // 4 courses × 3CH × BND 800/CH = 3200 (but invoice shows rounded)
      libraryFee: 50,
      hostelDeposit: 200,
      scholarshipDeduction: 0,
      totalAmount: 3450,
      amountPaid: 0,
      outstandingBalance: 3450,
      dueDate: new Date('2026-04-19'),
      status: 'unpaid',
    },
    update: {},
  })

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
    { id: 'asn-t-01', offeringId: offeringIFN101.id, title: 'Weekly Quiz 1 – Variables & Loops',          maxMarks: 20,  weight: 5  },
    { id: 'asn-t-02', offeringId: offeringIFN101.id, title: 'Lab Exercise: Flowchart Design',              maxMarks: 30,  weight: 5  },
    { id: 'asn-t-03', offeringId: offeringIFN101.id, title: 'Reflection Journal Week 4',                   maxMarks: 10,  weight: 2  },
    { id: 'asn-t-04', offeringId: offeringIFN102.id, title: 'Lab Report 1 – Linked List Implementation',  maxMarks: 50,  weight: 10 },
    { id: 'asn-t-05', offeringId: offeringIFN102.id, title: 'Quiz 2 – Tree Traversal Algorithms',         maxMarks: 25,  weight: 5  },
    { id: 'asn-t-06', offeringId: offeringIFN102.id, title: 'Problem Set 3 – Sorting Comparisons',        maxMarks: 40,  weight: 8  },
    { id: 'asn-t-07', offeringId: offeringIFN201.id, title: 'ER Diagram Assignment – Library System',     maxMarks: 100, weight: 15 },
    { id: 'asn-t-08', offeringId: offeringIFN201.id, title: 'SQL Query Lab – Normalisation Exercise',     maxMarks: 50,  weight: 10 },
    { id: 'asn-t-09', offeringId: offeringIFN201.id, title: 'Weekly Quiz – Relational Algebra',           maxMarks: 20,  weight: 5  },
    { id: 'asn-t-10', offeringId: offeringARA101.id, title: 'Vocabulary Exercise Week 4',                 maxMarks: 30,  weight: 5  },
    { id: 'asn-t-11', offeringId: offeringARA101.id, title: 'Listening Comprehension Task 2',             maxMarks: 20,  weight: 4  },
    { id: 'asn-t-12', offeringId: offeringClashDemo.id, title: 'Arabic Writing Assessment – Unit 3',      maxMarks: 50,  weight: 10 },
    { id: 'asn-t-13', offeringId: offeringClashDemo.id, title: 'Grammar Quiz – Verb Conjugations',        maxMarks: 20,  weight: 4  },
    { id: 'asn-t-14', offeringId: offeringFND101.id, title: 'Foundation Maths – Calculus Problem Set',   maxMarks: 60,  weight: 10 },
  ]
  for (const a of todayAssignments) {
    await prisma.assignment.upsert({
      where: { id: a.id },
      create: { id: a.id, offeringId: a.offeringId, title: a.title, description: a.title, dueDate: dueToday, maxMarks: a.maxMarks, weightPct: a.weight },
      update: {},
    })
  }

  // Pre-seeded submission for Noor with AI scores
  const assetSub = await prisma.fileAsset.upsert({
    where: { id: 'asset-noor-sub1' },
    create: {
      id: 'asset-noor-sub1', uploadedById: uNoor.id,
      fileName: 'noor_00-123456_case_study_1.pdf',
      originalName: 'Case_Study_1_Noor.pdf',
      fileUrl: '/uploads/submissions/noor_case_study_1.pdf',
      mimeType: 'application/pdf', fileSizeBytes: 245760,
    },
    update: {},
  })

  await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: assignment1.id, studentId: studentNoor.id } },
    create: {
      assignmentId: assignment1.id,
      studentId: studentNoor.id,
      assetId: assetSub.id,
      aiRubricScores: JSON.stringify([
        { criterion: 'Clarity', ai_score: 20, ai_comment: 'Well-structured argument with clear thesis. Minor grammar issues.' },
        { criterion: 'References', ai_score: 12, ai_comment: 'Only 3 sources cited. Needs more citations from peer-reviewed sources.' },
        { criterion: 'Analysis', ai_score: 28, ai_comment: 'Correct Big-O analysis for QuickSort and MergeSort. BubbleSort derivation has minor error.' },
        { criterion: 'Presentation', ai_score: 18, ai_comment: 'Excellent formatting and organisation. Good use of tables.' },
      ]),
      aiGeneratedAt: new Date(),
    },
    update: {},
  })

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
  for (const s of [studentNoor, ...riskStudents]) {
    await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: atSess1.id, studentId: s.id } },
      create: { sessionId: atSess1.id, studentId: s.id, status: 'present' },
      update: {},
    })
  }

  // ── GL Codes ──────────────────────────────────────────────────
  // Finance budget: BND 45M total | BND 28.3M committed (62.9%) | BND 16.7M remaining
  const glTnL = await upsertGl({ code: 'OPEX-TNL-2026', desc: 'Teaching & Learning Operations',  deptId: deptIFN.id, budget: 15000000, committed:  9435000, spent:  7200000 })
  const glADM = await upsertGl({ code: 'OPEX-ADM-2026', desc: 'Administration & Operations',      deptId: deptADM.id, budget:  8000000, committed:  5040000, spent:  3800000 })
  const glFAC = await upsertGl({ code: 'CAPEX-FAC-2026',desc: 'Facilities & Capital Projects',    deptId: deptFND.id, budget: 12000000, committed:  7548000, spent:  5900000 })
  const glHR  = await upsertGl({ code: 'OPEX-HR-2026',  desc: 'HR & Staffing Budget',             deptId: deptADM.id, budget:  7000000, committed:  4403000, spent:  3200000 })
  const glIT  = await upsertGl({ code: 'OPEX-IT-2026',  desc: 'IT & Digital Infrastructure',      deptId: deptIFN.id, budget:  3000000, committed:  1874000, spent:  1400000 })
  void glTnL; void glFAC; void glHR // used for finance dashboard totals

  // ── Item Categories ───────────────────────────────────────────
  const catIT   = await upsertCat({ code: 'IT-EQP',  name: 'IT Equipment' })
  const catFURN = await upsertCat({ code: 'FURN',    name: 'Office Furniture' })
  const catOFF  = await upsertCat({ code: 'OFF-SUP', name: 'Office Supplies' })
  const catFAC  = await upsertCat({ code: 'FAC-EQP', name: 'Facilities Equipment' })

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

  // One fully approved PR
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
      quoteTrafficLight: 'green', status: 'rector_approved',
      submittedAt: new Date(Date.now() - 10 * 86400000),
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
  // Noor: passing
  await prisma.studentRiskScore.upsert({
    where: { studentId_offeringId: { studentId: studentNoor.id, offeringId: offeringIFN101.id } },
    create: {
      studentId: studentNoor.id, offeringId: offeringIFN101.id,
      attendancePct: 92, quizAvg: 78, submissionRate: 90,
      riskScore: 0.12, predictedOutcome: 'pass', confidence: 91,
    },
    update: {},
  })

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
  const expiresNext = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.notification.deleteMany({})
  await prisma.executiveInsight.deleteMany({})
  for (const ins of [
    { insightType: 'enrollment', title: 'Enrolment Ahead of Target', body: "Enrolment is 4% ahead of last year's Sep intake (1,204 vs 1,158). Early applications suggest strong demand for BSC-IFN.", severity: 'info', expiresAt: expiresNext },
    { insightType: 'finance', title: 'Budget Utilisation On Track', body: 'Finance budget utilisation at 62.9% (BND 28.3M / BND 45M) — on track for year-end. 3 overdue invoices require follow-up.', severity: 'info', expiresAt: expiresNext },
    { insightType: 'research', title: 'Research Pipeline Active', body: 'Research grant pipeline: 5 proposals pending review (total value BND 380K). RG-2026-001 utilisation at 38%.', severity: 'info', expiresAt: expiresNext },
    { insightType: 'lms', title: 'At-Risk Student Count Rising', body: 'At-risk student count increased this week (2 students flagged in IFN101 with attendance below 60%). Early intervention recommended.', severity: 'warning', expiresAt: expiresNext },
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
  console.log('  noor        / Demo@2026  → Student Portal (fully enrolled student)')
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

async function upsertVendor(v: { name: string; cat: string; email: string }) {
  const existing = await prisma.vendor.findFirst({ where: { name: v.name } })
  if (existing) return existing
  return prisma.vendor.create({ data: { name: v.name, categoryId: v.cat, contactEmail: v.email } })
}

async function upsertGrant(g: { ref: string; title: string; piId: string; deptId: string; budget: number; utilised: number; status: string }) {
  return prisma.researchGrant.upsert({
    where: { referenceNo: g.ref },
    create: {
      referenceNo: g.ref, title: g.title, principalInvestigatorId: g.piId,
      departmentId: g.deptId, abstract: `Research project: ${g.title}. This grant aims to advance knowledge and innovation in the relevant field at UNISSA.`,
      durationMonths: 24, totalBudget: g.budget, amountUtilised: g.utilised, status: g.status,
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
