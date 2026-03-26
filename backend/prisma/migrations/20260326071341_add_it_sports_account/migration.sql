-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "itAccountActive" BOOLEAN NOT NULL DEFAULT false,
    "sportsAccountActive" BOOLEAN NOT NULL DEFAULT false,
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
