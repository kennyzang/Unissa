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
    // AI Configuration (disabled by default – configure via Admin > Settings)
    { key: 'ai_enabled',       value: 'false',       description: 'Enable real AI responses (requires API key)' },
    { key: 'ai_provider',      value: 'openai',       description: 'AI provider: openai | anthropic | custom' },
    { key: 'ai_api_key',       value: '',             description: 'AI provider API key' },
    { key: 'ai_model',         value: 'gpt-4o-mini',  description: 'AI model ID' },
    { key: 'ai_base_url',      value: '',             description: 'Custom API base URL (leave empty for defaults)' },
    { key: 'ai_temperature',   value: '0.7',          description: 'LLM temperature (0-1)' },
    { key: 'ai_max_tokens',    value: '2048',         description: 'Max response tokens' },
    { key: 'ai_system_prompt', value: '',             description: 'Custom system prompt (empty = default UNIBOT prompt)' },
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

  // ── Applicant: Noor ──────────────────────────────────────────
  const applicantNoor = await prisma.applicant.upsert({
    where: { icPassport: '00-123456' },
    create: {
      applicationRef: 'APP-2026-0001',
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
      status: 'submitted',
      submittedAt: new Date('2026-03-10'),
    },
    update: {},
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

  // Update applicant status to accepted
  await prisma.applicant.update({ where: { id: applicantNoor.id }, data: { status: 'accepted', userId: uNoor.id, decisionMadeAt: new Date('2026-03-15') } })

  // Library account for Noor
  await prisma.libraryAccount.upsert({
    where: { studentId: studentNoor.id },
    create: { studentId: studentNoor.id, accountNo: 'LIB-2026001', isActive: true, activatedAt: new Date('2026-04-01') },
    update: {},
  })

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
        modeOfStudy: 'full_time', status: 'accepted', submittedAt: new Date(), decisionMadeAt: new Date(),
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
  const glIT  = await upsertGl({ code: 'OPEX-IT-2026',  desc: 'IT Operations Budget',     deptId: deptIFN.id, budget: 150000, committed: 45000, spent: 22000 })
  const glADM = await upsertGl({ code: 'OPEX-ADM-2026', desc: 'Administration Operations', deptId: deptADM.id, budget: 200000, committed: 75000, spent: 40000 })
  const glFAC = await upsertGl({ code: 'CAPEX-FAC-2026',desc: 'Facilities Capital Budget', deptId: deptFND.id, budget: 500000, committed: 120000, spent: 90000 })
  const glHR  = await upsertGl({ code: 'OPEX-HR-2026',  desc: 'HR Operations Budget',     deptId: deptADM.id, budget: 100000, committed: 38000, spent: 20000 })

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
  await upsertGrant({ ref: 'RG-2026-001', title: 'AI-Enhanced Adaptive Learning Systems for Tertiary Education', piId: staffAhmad.id, deptId: deptIFN.id, budget: 450000, utilised: 171000, status: 'active' })
  await upsertGrant({ ref: 'RG-2026-002', title: 'Digital Preservation of Brunei Islamic Manuscripts', piId: staffAhmad.id, deptId: deptARA.id, budget: 380000, utilised: 95000, status: 'active' })
  await upsertGrant({ ref: 'RG-2026-003', title: 'Cybersecurity Framework for Smart Campus Infrastructure', piId: staffSiti.id, deptId: deptIFN.id, budget: 220000, utilised: 0, status: 'proposal_submitted' })

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
  console.log('  noor        / Demo@2026  → Student Portal')
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
    update: {},
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
    update: {},
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
    update: {},
  })
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
