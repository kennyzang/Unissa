# UNISSA Smart University Platform — User Guide

> Version v2.0 | Roles: Student, Lecturer, Staff, Finance, Admissions, Administrator

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Login & Accounts](#2-login--accounts)
3. [Role-Based Features](#3-role-based-features)
   - [3.1 Student](#31-student)
   - [3.2 Lecturer](#32-lecturer)
   - [3.3 Department Manager](#33-department-manager)
   - [3.4 Finance Staff](#34-finance-staff)
   - [3.5 Admissions Officer](#35-admissions-officer)
   - [3.6 HR Admin](#36-hr-admin)
   - [3.7 System Administrator](#37-system-administrator)
4. [Core Business Workflows](#4-core-business-workflows)
   - [4.1 Admissions Process](#41-admissions-process)
   - [4.2 Course Registration & Fees](#42-course-registration--fees)
   - [4.3 Learning Management (LMS)](#43-learning-management-lms)
   - [4.4 Procurement Workflow](#44-procurement-workflow)
   - [4.5 Leave Application](#45-leave-application)
   - [4.6 Research Grant Application](#46-research-grant-application)
5. [AI Features](#5-ai-features)
6. [Admin: Configure AI Model](#6-admin-configure-ai-model)
7. [Deployment (MySQL 8.0)](#7-deployment-mysql-80)
8. [Demo Accounts](#8-demo-accounts)
9. [FAQ](#9-faq)

---

## 1. System Overview

UNISSA Smart Platform is a comprehensive university management system covering the full student and staff lifecycle:

| Module | Features |
|--------|----------|
| Admissions | Online application, eligibility review, acceptance decisions, auto-create student accounts |
| Student Management | Student records, course registration, grade enquiry |
| Learning Management (LMS) | Course content, assignment submission, AI grading, QR-code attendance |
| Finance | Fee invoices, payment records, financial dashboard |
| Procurement | Purchase requests, multi-level approvals, AI anomaly detection |
| Human Resources | Staff directory, leave applications, payroll records |
| Research | Grant applications, department endorsement, finance disbursement |
| AI Assistant | Floating chat bubble on every page, risk prediction, procurement anomaly detection |
| System Config | AI model configuration, security settings (admin only) |

---

## 2. Login & Accounts

### Access URL
- Frontend: `http://your-server-ip:5173` (development) or `http://your-domain.com` (production)
- Default ports: frontend 5173, backend API 4000

### Sign-in Steps
1. Open the system — you are automatically redirected to the login page.
2. Enter your username and password.
3. The system assigns role-based permissions and navigation menus automatically.

> **⚠️ Note:** Sessions expire after 4 hours. Save your work regularly.

### Password Policy
- Demo password for all accounts: `Demo@2026`
- Change all default passwords in production.
- Accounts are locked for 30 minutes after 5 consecutive failed login attempts.

### New Student Accounts
When an application is accepted the system **automatically creates** a student account:
- Username format: `firstname.lastname.last3digits` (e.g. `noor.binti.001`)
- Temporary password: `FirstName@Year` (e.g. `Noor@2026`)
- Students are advised to change their password on first login.

---

## 3. Role-Based Features

### 3.1 Student

**Accessible Pages**
| Page | Path | Purpose |
|------|------|---------|
| Apply | /admission/apply | Submit an admission application |
| My Profile | /student/profile | View student record, CGPA, campus card |
| Course Registration | /student/courses | Register for courses each semester |
| Fee Statement | /finance/statement | View and pay tuition fees |
| My Courses | /lms/courses | View enrolled courses, submit assignments |
| Attendance | /lms/attendance | Scan lecturer's QR code for attendance |
| Campus Services | /campus/services | Campus card, library, email account status |

**Key Notes**
1. Course registration must be completed before a fee invoice is generated and the campus card is activated.
2. Standard students register **12–18 credit hours** per semester; CGPA ≥ 3.5 allows up to 21 credit hours.
3. Add/drop deadline is **2 weeks** after semester start.
4. Attendance QR codes are valid for **10 minutes** — scan promptly after the lecturer displays the code.

---

### 3.2 Lecturer

**Accessible Pages**
| Page | Path | Purpose |
|------|------|---------|
| My Courses | /lms/courses | View courses taught |
| Course Detail | /lms/courses/:id | Manage assignments, view submissions, grade |
| Attendance | /lms/attendance | Generate QR code to start an attendance session |
| Risk Analytics | /ai/risk | View student learning-risk predictions |
| Research Grants | /research/grants | Submit research project applications |
| Leave Management | /hr/leave | Apply for leave |

**Key Notes**
1. **AI Grading**: After submission, AI auto-scores assignments based on the rubric. Lecturers review and confirm/adjust the score.
2. **QR Code**: Click "Generate QR Code" at the start of each class. The code expires after 10 minutes.
3. **Risk Dashboard**: Displays students' composite risk index (attendance + quiz average + submission rate). Review regularly for early intervention.

---

### 3.3 Department Manager

**Accessible Pages**
| Page | Path | Purpose |
|------|------|---------|
| Command Centre | /dashboard | University-wide KPI dashboard |
| HR Staff | /hr/staff | View all staff records |
| Leave Management | /hr/leave | Approve/reject staff leave requests |
| Research Grants | /research/grants | L1 department endorsement of grant applications |
| Procurement | /procurement/requests | Submit and view purchase requests |
| Approval Inbox | /procurement/approvals | Process pending procurement approvals |

**Key Notes**
1. Approving leave **automatically deducts** the employee's leave balance.
2. Research grants undergo **L1 (department head) review** here before moving to finance approval.
3. Procurement over BND 500 requires at least 3 vendor quotes; over BND 2,000 requires a tender process.

---

### 3.4 Finance Staff

**Accessible Pages**
| Page | Path | Purpose |
|------|------|---------|
| Finance Dashboard | /finance/dashboard | Revenue, expenses, outstanding invoices |
| Fee Statement | /finance/statement | View any student's fee invoice |
| Procurement Approvals | /procurement/approvals | Finance-level procurement approval |
| Anomaly Detection | /procurement/anomalies | Review AI-flagged suspicious procurement |
| Research Grants | /research/grants | L3 finance disbursement approval |
| Leave | /hr/leave | Own leave applications |

---

### 3.5 Admissions Officer

**Accessible Pages**
| Page | Path | Purpose |
|------|------|---------|
| Applications | /admission/review | Review all applications, make acceptance decisions |

**Key Notes**
1. Clicking **Accept** automatically creates the applicant's student account and enrolment record.
2. The temporary password is shown in the confirmation dialog — inform the student to change it.
3. Rejected applications cannot be restored; proceed carefully.
4. **Waitlisted** status does not create a student account; the decision can be revised later.

---

### 3.6 HR Admin

**Accessible Pages**
| Page | Path | Purpose |
|------|------|---------|
| HR Staff | /hr/staff | View and manage all staff records |
| Leave Management | /hr/leave | Review and approve staff leave requests |

---

### 3.7 System Administrator

Has access to **all pages**, including:
| Page | Path | Purpose |
|------|------|---------|
| System Settings | /admin/settings | AI model configuration, security parameters |

---

## 4. Core Business Workflows

### 4.1 Admissions Process

```
Applicant submits form → Admissions officer reviews → Accept / Reject / Waitlist
                                                              ↓ (Accept)
                                                  System auto-creates student account
                                                  Issues temporary password
                                                              ↓
                                                  Student logs in → Course registration
```

**Key Points**
- Applicants complete personal info, academic background, and programme selection at `/admission/apply`.
- The system auto-populates open intake periods.
- Application reference format: `APP-2026-XXXX`

---

### 4.2 Course Registration & Fees

```
Student logs in → Selects courses (12–18 CH) → Confirms registration
                                                         ↓
                                        System auto-generates: Fee invoice
                                                               Activates campus card
                                                               Activates library account
                                                               Activates email account
```

**Fee Calculation**
- Local student: `credit hours × local rate per CH + BND 50 library fee`
- International student: `credit hours × international rate per CH + BND 50 library fee`
- Scholarship deduction applied automatically
- Invoice due: 14 days after registration

---

### 4.3 Learning Management (LMS)

**Attendance Workflow**
1. Lecturer: go to `/lms/attendance` → select course → click "Generate QR Code"
2. Student: open `/lms/attendance` → scan QR code with camera → attendance recorded
3. QR code is valid for 10 minutes

**Assignment Submission & Grading**
1. Student submits assignment file on the course detail page.
2. AI auto-grades based on the rubric.
3. Lecturer reviews AI-suggested score, adjusts if needed, then confirms.
4. Final grade is recorded.

---

### 4.4 Procurement Workflow

```
Staff submits PR → L1 Dept Head approval → L2 Finance approval → L3 Rector (large amounts)
                                                                           ↓
                                                                 Purchase Order (PO) issued
```

**Quotation Requirements**
| Amount | Requirement |
|--------|-------------|
| ≤ BND 500 | 1 quote |
| BND 500 – 2,000 | At least 3 quotes |
| > BND 2,000 | Tender process |

**AI Anomaly Detection** — flags the following to `/procurement/anomalies`:
- Price outlier: Z-score > 2.0 vs. historical prices
- Split billing: multiple small requests to circumvent tender threshold
- Frequent vendor: same vendor winning repeatedly

---

### 4.5 Leave Application

```
Staff submits leave request → Manager/HR Admin approves
                                        ↓ (Approved)
                              System auto-deducts leave balance
                              Updates staff status
```

**Leave Types**
- Annual: 14 days/year default
- Medical: 14 days/year default
- Unpaid: no balance deducted
- Maternity / Paternity / Emergency

---

### 4.6 Research Grant Application

```
Lecturer submits application → L1 Dept Head endorsement → L3 Finance disbursement
                                                                    ↓ (Approved)
                                                         Grant status → "Active"
                                                         Funds available
```

Application reference format: `RG-2026-XXXXX`

---

## 5. AI Features

### AI Chat Bubble (UNIBOT)

**Location**: Blue circular button at the bottom-right of every page.

**How to Use**
1. Click the bubble button to open the chat window.
2. Type your question or click a quick-prompt button.
3. Press **Enter** to send; **Shift+Enter** for a new line.
4. Click the refresh icon to start a new conversation.

**UNIBOT Can Answer**
- Course registration deadlines
- Current fee invoice status
- CGPA enquiry
- Campus card usage
- Assignment due dates
- Leave application process
- Procurement and research policy questions

> **Note:** AI responses use a built-in demo mode by default. Once an administrator configures a real AI model (see Section 6), UNIBOT gains full natural-language capability.

### Student Risk Analytics (Lecturer / Admin)

Path: `/ai/risk`

- Displays each student's composite risk score (0–100)
- Based on: attendance rate, quiz average, assignment submission rate
- 🔴 High risk: proactively contact the student
- 🟠 Medium risk: monitor closely
- 🟢 Low risk: on track

### Procurement Anomaly Detection (Finance)

Path: `/procurement/anomalies`

- Automatically flags suspicious purchase requests
- Severity: High / Medium / Low
- Filter by status: Open / Investigating / Resolved / Dismissed

---

## 6. Admin: Configure AI Model

Path: `/admin/settings` → **AI Configuration** tab

### Supported Providers

| Provider | Recommended Model | Get API Key |
|----------|-------------------|-------------|
| OpenAI | `gpt-4o-mini` (economy) / `gpt-4o` (high-performance) | platform.openai.com |
| Anthropic | `claude-3-5-haiku-20241022` (fast) / `claude-3-5-sonnet-20241022` (high-performance) | console.anthropic.com |
| Custom (Ollama / local) | As per deployment | No key needed for local |

### Configuration Steps

1. Log in as administrator (`admin` / `Demo@2026`).
2. Click the ⚙️ Settings icon in the top navbar, or navigate to `/admin/settings`.
3. Select the **AI Configuration** tab.
4. Enable the **Enable AI Responses** toggle.
5. Choose a Provider.
6. Paste your API Key.
7. Select or type the model name.
8. Leave Base URL blank for defaults (fill in for custom providers).
9. Click **Test Connection** to verify.
10. After a successful test, click **Save Configuration**.

### Custom System Prompt (Optional)

Use the "Custom System Prompt" field to:
- Change UNIBOT's name or tone
- Add specific answer guidelines
- Specify a language preference

Leave blank to use the default UNIBOT system prompt.

### Notes

- API Keys are masked in the UI (`sk-abc***xyz`); the actual value is stored securely in the database.
- To update the key: paste the new key; leave blank to keep the existing value.
- Recommended temperature: **0.7** (balances creativity and accuracy)
- Recommended max tokens: **2048**

---

## 7. Deployment (MySQL 8.0)

### Database Configuration

Edit `backend/.env`:

```env
DATABASE_URL="mysql://your_user:your_password@localhost:3306/unissa_db"
```

### Initial Deployment

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma Client
cd backend && pnpm db:generate

# 3. Run database migrations (creates all tables)
pnpm db:migrate

# 4. Seed demo data
pnpm seed

# 5. Build frontend
cd ../frontend && pnpm build

# 6. Start backend
cd ../backend && pnpm start
```

### MySQL 8.0 Notes

- Set database character set to `utf8mb4` (supports emoji and extended characters).
- Timezone: `SET time_zone = '+08:00';` (Brunei Standard Time)
- Create database example:

```sql
CREATE DATABASE unissa_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'unissa_user'@'localhost' IDENTIFIED BY 'YourStrongPassword';
GRANT ALL PRIVILEGES ON unissa_db.* TO 'unissa_user'@'localhost';
FLUSH PRIVILEGES;
```

### Production Security Checklist

1. Set `JWT_SECRET` to a strong random string (≥ 32 characters).
2. Set `CORS_ORIGIN` to the actual production domain.
3. Set `NODE_ENV=production`.
4. Enable HTTPS via a reverse proxy (e.g. Nginx).

---

## 8. Demo Accounts

All accounts use the password: **`Demo@2026`**

| Username | Role | Notes |
|----------|------|-------|
| `noor` | Student | Enrolled in IFN101 / IFN102 / IFN201 |
| `admissions` | Admissions Officer | Reviews admission applications |
| `dr.siti` | Lecturer | Teaches IFN101 and other courses |
| `manager` | Department Manager | Head of ADM department |
| `finance` | Finance Staff | Handles finance and procurement approvals |
| `admin` | System Administrator | Full access + AI configuration |
| `dr.ahmad` | Lecturer / Researcher | Submits research grant applications |
| `hradmin` | HR Admin | HR staff and leave management |

---

## 9. FAQ

**Q: Student completed course registration but cannot see a fee invoice?**
A: The invoice is generated immediately on registration confirmation. Refresh `/finance/statement`. If still missing, verify the registration succeeded (a "Successfully registered" toast should have appeared).

**Q: QR code scan does not show "Attendance recorded"?**
A: QR codes expire after 10 minutes. Ask the lecturer to regenerate. Ensure camera permission is granted.

**Q: AI chat bubble shows "I'm having trouble connecting"?**
A: The AI service may not be configured. Ask the administrator to set up an AI model at `/admin/settings`. The system falls back to built-in demo answers when no AI is configured.

**Q: Procurement request stays in "Draft" status after submission?**
A: Draft status requires manually clicking the **Submit** button to enter the approval workflow. Note: submitted requests cannot be recalled.

**Q: Student cannot log in after their application is accepted?**
A: Confirm the admissions officer clicked **Accept** and not **Waitlist**. On acceptance the system auto-creates the account; the username and temporary password are displayed in the result dialog. If missed, the system administrator can look up the credentials in the database.

**Q: Research grant is stuck at "Dept Approved"?**
A: Finance staff (role: `finance`) must perform the L3 disbursement approval at `/research/grants`.

---

*This document applies to UNISSA Smart Platform v2.0. For support, contact your system administrator.*
