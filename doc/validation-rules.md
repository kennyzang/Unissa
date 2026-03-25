# Student Registration Validation Rules

> Source reference: frontend `frontend/src/pages/admission/AdmissionApplyPage.tsx`, backend `backend/src/routes/admissions.ts` and `backend/src/routes/students.ts`

---

## Frontend Validation (Zod + react-hook-form)

### Step 1: Personal Information

| Field | Type | Required | Constraint | Error Message |
|-------|------|----------|------------|---------------|
| `fullName` | string | Yes | Min 3 characters | "Full name required" |
| `icPassport` | string | Yes | Min 6 characters, DB unique | "IC/Passport required" |
| `dateOfBirth` | date | Yes | Must be a valid date | "Date of birth required" |
| `gender` | enum | Yes | `male` / `female` | — |
| `nationality` | string | Yes | Min 2 characters, default "Brunei Darussalam" | "Nationality required" |
| `email` | string | Yes | Valid email format | "Valid email required" |
| `mobile` | string | Yes | Min 7 characters | "Mobile required" |
| `homeAddress` | string | Yes | Min 5 characters | "Address required" |

### Step 2: Academic Background

| Field | Type | Required | Constraint | Error Message |
|-------|------|----------|------------|---------------|
| `highestQualification` | enum | Yes | `O_LEVEL` / `A_LEVEL` / `DIPLOMA` / `DEGREE` / `MASTERS` | "Qualification required" |
| `previousInstitution` | string | Yes | Min 2 characters | "Institution required" |
| `yearOfCompletion` | string | Yes | Min 4 digits (year) | "Year required" |
| `cgpa` | number | No | Optional, no format constraint | — |

### Step 3: Programme Selection

| Field | Type | Required | Constraint | Error Message |
|-------|------|----------|------------|---------------|
| `programmeId` | string | Yes | Min 1 character, must exist in DB | "Programme required" |
| `intakeId` | string | Yes | Min 1 character, must exist and `isOpen = true` | "Intake required" |
| `modeOfStudy` | enum | Yes | `full_time` / `part_time` | — |
| `scholarshipApplied` | boolean | No | Default `false` | — |
| `scholarshipType` | string | Conditional | Required only when `scholarshipApplied = true` | — |

---

## Backend Validation (`backend/src/routes/admissions.ts`)

### Submit Application `POST /api/v1/admissions/apply`

1. **Duplicate Application Check**
   - If the same `icPassport` already has a non-`draft` application, reject with:
     > `"Applicant with IC/Passport {icPassport} already has a submitted application ({applicationRef})"`

2. **Data Transformations**

   | Field | Transformation |
   |-------|----------------|
   | `dateOfBirth` | `new Date(dateOfBirth)` |
   | `yearOfCompletion` | `Number(yearOfCompletion)` |
   | `cgpa` | `Number(cgpa)`, `null` if not provided |
   | `scholarshipApplied` | `Boolean(scholarshipApplied)` |
   | `scholarshipType` | Forced to `null` when `scholarshipApplied = false` |

3. **Application Reference Generation**
   - Format: `APP-{current year}-{4-digit random number}`
   - Example: `APP-2026-5423`

4. **Initial Status**
   - All new submissions are set to `submitted` with a `submittedAt` timestamp.

---

## Application Status Flow

```
draft → submitted → auto_check_failed
                 → under_review → accepted
                               → rejected
                               → waitlisted
```

---

## Course Registration Credit Hour Validation (`backend/src/routes/students.ts`)

| Student Type | Min CH | Max CH |
|-------------|--------|--------|
| CGPA ≥ 3.5 | 12 CH | 21 CH |
| Standard student | 12 CH | 18 CH |
| Probation student | 3 CH | 6 CH |

- Total credit hours must satisfy: `minCH ≤ totalCH ≤ maxCH`
- All `offeringId` values must exist in the database and belong to the student's enrolled programme.

---

## Database Constraints (Prisma Schema)

| Field | Constraint |
|-------|------------|
| `icPassport` | `@unique` — globally unique |
| `applicationRef` | `@unique` — globally unique |
| `cgpa` | `Float?` — nullable |
| `scholarshipType` | `String?` — nullable |
| `status` | Default `draft` |
| `nationality` | Default `"Brunei Darussalam"` |
