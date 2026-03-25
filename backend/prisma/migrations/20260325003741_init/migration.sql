-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "headStaffId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "semesterNumber" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "addDropEnd" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "semesters_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "file_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "programmes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "minEntryGrade" TEXT NOT NULL DEFAULT '{}',
    "feeLocalPerCh" REAL NOT NULL,
    "feeInternationalPerCh" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "programmes_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "intakes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programmeId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "intakeStart" DATETIME NOT NULL,
    "intakeEnd" DATETIME NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "maxCapacity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "intakes_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "intakes_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "applicants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "applicationRef" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "icPassport" TEXT NOT NULL,
    "dateOfBirth" DATETIME NOT NULL,
    "gender" TEXT NOT NULL,
    "nationality" TEXT NOT NULL DEFAULT 'Brunei Darussalam',
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "homeAddress" TEXT NOT NULL,
    "highestQualification" TEXT NOT NULL,
    "previousInstitution" TEXT NOT NULL,
    "yearOfCompletion" INTEGER NOT NULL,
    "cgpa" REAL,
    "intakeId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "modeOfStudy" TEXT NOT NULL,
    "scholarshipApplied" BOOLEAN NOT NULL DEFAULT false,
    "scholarshipType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "draftSavedAt" DATETIME,
    "submittedAt" DATETIME,
    "eligibilityCheckResult" TEXT,
    "officerRemarks" TEXT,
    "decisionMadeAt" DATETIME,
    "offerLetterAssetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "applicants_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intakes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "applicants_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "applicants_offerLetterAssetId_fkey" FOREIGN KEY ("offerLetterAssetId") REFERENCES "file_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "applicant_subject_grades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicantId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "qualificationType" TEXT NOT NULL,
    CONSTRAINT "applicant_subject_grades_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "applicant_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "applicant_documents_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "applicant_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "file_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "modeOfStudy" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "studentType" TEXT NOT NULL DEFAULT 'standard',
    "currentCgpa" REAL NOT NULL DEFAULT 0.00,
    "scholarshipPct" INTEGER NOT NULL DEFAULT 0,
    "campusCardNo" TEXT,
    "libraryAccountActive" BOOLEAN NOT NULL DEFAULT false,
    "emailAccountActive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intakes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "creditHours" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "isOpenToInternational" BOOLEAN NOT NULL DEFAULT true,
    "maxSeats" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "programme_courses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programmeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseType" TEXT NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    CONSTRAINT "programme_courses_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "programme_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "courseId" TEXT NOT NULL,
    "prerequisiteCourseId" TEXT NOT NULL,
    "minGrade" TEXT NOT NULL DEFAULT 'D',

    PRIMARY KEY ("courseId", "prerequisiteCourseId"),
    CONSTRAINT "course_prerequisites_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "course_prerequisites_prerequisiteCourseId_fkey" FOREIGN KEY ("prerequisiteCourseId") REFERENCES "courses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "course_offerings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "seatsTaken" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_offerings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "course_offerings_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "course_offerings_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "course_offerings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enrolments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "finalGrade" TEXT,
    "gradePoints" REAL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "droppedAt" DATETIME,
    CONSTRAINT "enrolments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "enrolments_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "enrolments_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "student_gpa_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "semesterGpa" REAL NOT NULL,
    "cumulativeGpa" REAL NOT NULL,
    "totalChPassed" INTEGER NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_gpa_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "student_gpa_records_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offeringId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "rubricCriteria" TEXT,
    "weightPct" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignments_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiRubricScores" TEXT,
    "aiGeneratedAt" DATETIME,
    "instructorScores" TEXT,
    "finalMarks" REAL,
    "gradedAt" DATETIME,
    "gradedById" TEXT,
    CONSTRAINT "submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "submissions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "file_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offeringId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "qrExpiresAt" DATETIME NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "attendance_sessions_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'present',
    CONSTRAINT "attendance_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attendance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "library_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" DATETIME,
    "booksBorrowed" INTEGER NOT NULL DEFAULT 0,
    "maxBorrow" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "library_accounts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fee_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "tuitionFee" REAL NOT NULL,
    "libraryFee" REAL NOT NULL DEFAULT 50.00,
    "hostelDeposit" REAL NOT NULL DEFAULT 0.00,
    "scholarshipDeduction" REAL NOT NULL DEFAULT 0.00,
    "totalAmount" REAL NOT NULL,
    "amountPaid" REAL NOT NULL DEFAULT 0.00,
    "outstandingBalance" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "lateFeeAccrued" REAL NOT NULL DEFAULT 0.00,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_invoices_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fee_invoices_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionRef" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "bankName" TEXT,
    "status" TEXT NOT NULL,
    "paidAt" DATETIME,
    "receiptAssetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_receiptAssetId_fkey" FOREIGN KEY ("receiptAssetId") REFERENCES "file_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "payrollMonth" DATETIME NOT NULL,
    "basicSalary" REAL NOT NULL,
    "allowances" REAL NOT NULL DEFAULT 0.00,
    "deductions" REAL NOT NULL DEFAULT 0.00,
    "netSalary" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_records_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gl_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "totalBudget" REAL NOT NULL,
    "committedAmount" REAL NOT NULL DEFAULT 0.00,
    "spentAmount" REAL NOT NULL DEFAULT 0.00,
    "fiscalYear" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gl_codes_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "item_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT,
    "contactEmail" TEXT,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalOrdersYtd" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendors_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vendor_price_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "itemDesc" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "sourcePrId" TEXT,
    CONSTRAINT "vendor_price_history_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vendor_price_history_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prNumber" TEXT NOT NULL,
    "requestorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "itemCategoryId" TEXT,
    "itemDescription" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "estimatedUnitPrice" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "glCodeId" TEXT NOT NULL,
    "requiredByDate" DATETIME NOT NULL,
    "recommendedVendorId" TEXT,
    "vendorSelectionJustification" TEXT,
    "quoteTrafficLight" TEXT NOT NULL DEFAULT 'red',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "anomalyFlags" TEXT,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_requests_requestorId_fkey" FOREIGN KEY ("requestorId") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_requests_itemCategoryId_fkey" FOREIGN KEY ("itemCategoryId") REFERENCES "item_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_requests_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "gl_codes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_requests_recommendedVendorId_fkey" FOREIGN KEY ("recommendedVendorId") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pr_quotes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prId" TEXT NOT NULL,
    "quoteNumber" INTEGER NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorId" TEXT,
    "quotedPrice" REAL NOT NULL,
    "assetId" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pr_quotes_prId_fkey" FOREIGN KEY ("prId") REFERENCES "purchase_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pr_quotes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pr_quotes_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "file_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pr_approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "actedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "esignatureId" TEXT,
    CONSTRAINT "pr_approvals_prId_fkey" FOREIGN KEY ("prId") REFERENCES "purchase_requests" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pr_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pr_approvals_esignatureId_fkey" FOREIGN KEY ("esignatureId") REFERENCES "esignatures" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "glCodeId" TEXT NOT NULL,
    "poAssetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentRef" TEXT,
    "paidAt" DATETIME,
    CONSTRAINT "purchase_orders_prId_fkey" FOREIGN KEY ("prId") REFERENCES "purchase_requests" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "gl_codes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_poAssetId_fkey" FOREIGN KEY ("poAssetId") REFERENCES "file_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "esignatures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    CONSTRAINT "esignatures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "icPassport" TEXT NOT NULL,
    "dateOfBirth" DATETIME NOT NULL,
    "gender" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "joinDate" DATETIME NOT NULL,
    "leaveBalanceAnnual" INTEGER NOT NULL DEFAULT 14,
    "leaveBalanceMedical" INTEGER NOT NULL DEFAULT 14,
    "payrollBasicSalary" REAL NOT NULL,
    "appointmentLetterAssetId" TEXT,
    "lmsInstructorActive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "staff_appointmentLetterAssetId_fkey" FOREIGN KEY ("appointmentLetterAssetId") REFERENCES "file_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "coveringOfficerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "l1ApproverId" TEXT,
    "l1ActedAt" DATETIME,
    "l2ApproverId" TEXT,
    "l2ActedAt" DATETIME,
    "rejectRemarks" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "onboarding_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "hrDirectorApprovedAt" DATETIME,
    "loginCreated" BOOLEAN NOT NULL DEFAULT false,
    "lmsProvisioned" BOOLEAN NOT NULL DEFAULT false,
    "payrollCreated" BOOLEAN NOT NULL DEFAULT false,
    "appointmentLetterGenerated" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "onboarding_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "research_grants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referenceNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "principalInvestigatorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "totalBudget" REAL NOT NULL,
    "amountUtilised" REAL NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'proposal_submitted',
    "l1DeptHeadId" TEXT,
    "l1ActedAt" DATETIME,
    "l1Remarks" TEXT,
    "l2CommitteeReview" TEXT,
    "l3FinanceApprovedById" TEXT,
    "l3ActedAt" DATETIME,
    "l3Remarks" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "research_grants_principalInvestigatorId_fkey" FOREIGN KEY ("principalInvestigatorId") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "research_grants_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campus_facilities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "building" TEXT NOT NULL,
    "floor" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "features" TEXT
);

-- CreateTable
CREATE TABLE "facility_bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "departmentId" TEXT,
    "bookingDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "facility_bookings_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "campus_facilities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facility_bookings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "maintenance_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedToId" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_tickets_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "campus_facilities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campus_vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plateNo" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "departmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "student_risk_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "attendancePct" REAL NOT NULL,
    "quizAvg" REAL NOT NULL,
    "submissionRate" REAL NOT NULL,
    "riskScore" REAL NOT NULL,
    "predictedOutcome" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "advisorNotifiedAt" DATETIME,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_risk_scores_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "student_risk_scores_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chatbot_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messages" TEXT NOT NULL,
    "contextData" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chatbot_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "procurement_anomalies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prId" TEXT NOT NULL,
    "anomalyType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "zScore" REAL,
    "comparisonData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "procurement_anomalies_prId_fkey" FOREIGN KEY ("prId") REFERENCES "purchase_requests" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventKey" TEXT NOT NULL,
    "subjectTpl" TEXT NOT NULL,
    "bodyTpl" TEXT NOT NULL,
    "channels" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "triggeredByEvent" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notifications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "executive_insights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "insightType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metricSnapshot" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_configs" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_year_key" ON "academic_years"("year");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_academicYearId_semesterNumber_key" ON "semesters"("academicYearId", "semesterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "programmes_code_key" ON "programmes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "intakes_programmeId_semesterId_key" ON "intakes"("programmeId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "applicants_userId_key" ON "applicants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "applicants_applicationRef_key" ON "applicants"("applicationRef");

-- CreateIndex
CREATE UNIQUE INDEX "applicants_icPassport_key" ON "applicants"("icPassport");

-- CreateIndex
CREATE UNIQUE INDEX "students_studentId_key" ON "students"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "students_applicantId_key" ON "students"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "students_campusCardNo_key" ON "students"("campusCardNo");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "programme_courses_programmeId_courseId_key" ON "programme_courses"("programmeId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "course_offerings_courseId_semesterId_dayOfWeek_startTime_key" ON "course_offerings"("courseId", "semesterId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "enrolments_studentId_offeringId_key" ON "enrolments"("studentId", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "student_gpa_records_studentId_semesterId_key" ON "student_gpa_records"("studentId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assetId_key" ON "submissions"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignmentId_studentId_key" ON "submissions"("assignmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_sessionToken_key" ON "attendance_sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_sessionId_studentId_key" ON "attendance_records"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "library_accounts_studentId_key" ON "library_accounts"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "library_accounts_accountNo_key" ON "library_accounts"("accountNo");

-- CreateIndex
CREATE UNIQUE INDEX "fee_invoices_invoiceNo_key" ON "fee_invoices"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionRef_key" ON "payments"("transactionRef");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_staffId_payrollMonth_key" ON "payroll_records"("staffId", "payrollMonth");

-- CreateIndex
CREATE UNIQUE INDEX "gl_codes_code_key" ON "gl_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_code_key" ON "item_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_prNumber_key" ON "purchase_requests"("prNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pr_quotes_prId_quoteNumber_key" ON "pr_quotes"("prId", "quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_prId_key" ON "purchase_orders"("prId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poAssetId_key" ON "purchase_orders"("poAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_staffId_key" ON "staff"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_requests_staffId_key" ON "onboarding_requests"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "research_grants_referenceNo_key" ON "research_grants"("referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "campus_facilities_code_key" ON "campus_facilities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "campus_vehicles_plateNo_key" ON "campus_vehicles"("plateNo");

-- CreateIndex
CREATE UNIQUE INDEX "student_risk_scores_studentId_offeringId_key" ON "student_risk_scores"("studentId", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_eventKey_key" ON "notification_templates"("eventKey");
