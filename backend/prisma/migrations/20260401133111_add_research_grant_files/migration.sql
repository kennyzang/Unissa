/*
  Warnings:

  - You are about to drop the column `itAccountActive` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `sportsAccountActive` on the `students` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "applicant_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicantId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "applicant_history_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "course_materials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offeringId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "materialType" TEXT NOT NULL,
    "assetId" TEXT,
    "externalUrl" TEXT,
    "duration" INTEGER,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "course_materials_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "course_materials_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "file_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "course_materials_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "defaultUnitPrice" REAL NOT NULL,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "research_grant_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchGrantId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "research_grant_files_researchGrantId_fkey" FOREIGN KEY ("researchGrantId") REFERENCES "research_grants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "research_grant_files_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_purchase_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prNumber" TEXT NOT NULL,
    "requestorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "itemCategoryId" TEXT,
    "productId" TEXT,
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
    CONSTRAINT "purchase_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_requests_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "gl_codes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_requests_recommendedVendorId_fkey" FOREIGN KEY ("recommendedVendorId") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_purchase_requests" ("anomalyFlags", "createdAt", "departmentId", "estimatedUnitPrice", "glCodeId", "id", "itemCategoryId", "itemDescription", "prNumber", "quantity", "quoteTrafficLight", "recommendedVendorId", "requestorId", "requiredByDate", "status", "submittedAt", "totalAmount", "vendorSelectionJustification") SELECT "anomalyFlags", "createdAt", "departmentId", "estimatedUnitPrice", "glCodeId", "id", "itemCategoryId", "itemDescription", "prNumber", "quantity", "quoteTrafficLight", "recommendedVendorId", "requestorId", "requiredByDate", "status", "submittedAt", "totalAmount", "vendorSelectionJustification" FROM "purchase_requests";
DROP TABLE "purchase_requests";
ALTER TABLE "new_purchase_requests" RENAME TO "purchase_requests";
CREATE UNIQUE INDEX "purchase_requests_prNumber_key" ON "purchase_requests"("prNumber");
CREATE TABLE "new_students" (
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
INSERT INTO "new_students" ("applicantId", "campusCardNo", "createdAt", "currentCgpa", "emailAccountActive", "enrolledAt", "id", "intakeId", "libraryAccountActive", "modeOfStudy", "nationality", "programmeId", "scholarshipPct", "status", "studentId", "studentType", "userId") SELECT "applicantId", "campusCardNo", "createdAt", "currentCgpa", "emailAccountActive", "enrolledAt", "id", "intakeId", "libraryAccountActive", "modeOfStudy", "nationality", "programmeId", "scholarshipPct", "status", "studentId", "studentType", "userId" FROM "students";
DROP TABLE "students";
ALTER TABLE "new_students" RENAME TO "students";
CREATE UNIQUE INDEX "students_studentId_key" ON "students"("studentId");
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");
CREATE UNIQUE INDEX "students_applicantId_key" ON "students"("applicantId");
CREATE UNIQUE INDEX "students_campusCardNo_key" ON "students"("campusCardNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "course_materials_assetId_key" ON "course_materials"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "research_grant_files_researchGrantId_fileAssetId_key" ON "research_grant_files"("researchGrantId", "fileAssetId");
