# UNISSA POC — Hardwire Resend API Key for Email Sending

## Overview

This document provides exact instructions to configure automatic email sending in the UNISSA Smart University Platform POC using the Resend API. After applying these changes, the system will send emails on every server startup without any admin panel configuration.

> **Security note**: The API key is stored in `.env`, which is already listed in `.gitignore`. It will **not** be committed to Git.

---

## Files to Modify

| File | Type of Change |
|------|---------------|
| `backend/.env` | Add two environment variables |
| `backend/src/services/emailService.ts` | Two code changes (FROM address + initialize function) |

---

## File 1: `backend/.env`

Add the following two lines anywhere in the file:

```env
RESEND_API_KEY=re_R3wt6Yxx_CMvSqwFdFKE3qVkxXUEfn4co
RESEND_FROM=UNISSA <noreply@send.unissa.edu.bn>
```

> **Note on FROM address**: If your Resend dashboard shows the verified domain as `unissa.edu.bn` (root domain, not a subdomain), use `noreply@unissa.edu.bn` instead.

---

## File 2: `backend/src/services/emailService.ts`

### Change 1 — Update the FROM address (Line 4)

Find this line:

```ts
const FROM_ADDRESS = 'UNISSA <noreply@unissa.edu.bn>'
```

Replace it with:

```ts
const FROM_ADDRESS = process.env.RESEND_FROM ?? 'UNISSA <noreply@send.unissa.edu.bn>'
```

---

### Change 2 — Update the `initialize()` function

Find the `initialize()` function (approximately lines 28–45). It currently reads the API key only from the database (`prisma.systemConfig`).

**Current code (OLD):**

```ts
async initialize() {
  const config = await prisma.systemConfig.findUnique({ where: { key: 'resend_api_key' } })
  if (!config?.value) return false
  this.resend = new Resend(config.value)
  this.configured = true
  return true
}
```

**Replace with (NEW):**

```ts
async initialize() {
  const envKey = process.env.RESEND_API_KEY
  if (envKey) {
    this.resend = new Resend(envKey)
    this.configured = true
    return true
  }
  const config = await prisma.systemConfig.findUnique({ where: { key: 'resend_api_key' } })
  if (!config?.value) return false
  this.resend = new Resend(config.value)
  this.configured = true
  return true
}
```

**What this does**: The updated function checks for the API key in the environment variable first. If found, it uses it immediately without touching the database. If not found, it falls back to the original database lookup (so the Admin Panel configuration still works as a backup).

---

## After Making the Changes

1. **Restart the backend server**
   ```bash
   yarn workspace backend dev
   ```
   The `.env` file is loaded at startup — no further action needed.

2. **Verify email is working** — log in as `admin` / `Demo@2026`, go to:
   **Admin → System Settings → Email Configuration → Send Test Email**
   Enter any real email address and confirm the email arrives.

3. **No database configuration required** — the API key from `.env` is picked up automatically on every server start.

---

## How Email Is Used in the Demo Flow

| Event | Email Sent To |
|-------|--------------|
| Admissions sends offer letter | Applicant (Noor) |
| Student account created after enrollment | New student |
| Payment receipt confirmed | Student |
| HR new hire onboarding approved | New staff member |

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Test email not received | Domain not verified in Resend | Check Resend dashboard → Domains → status must be **Verified** |
| "Invalid FROM address" error | FROM domain doesn't match verified domain | Update `RESEND_FROM` in `.env` to match the exact domain shown in Resend |
| API key rejected | Key copied incorrectly | Re-copy from Resend dashboard → API Keys |
| Email sends but lands in spam | SPF/DKIM DNS records not fully propagated | Wait up to 24 hours for DNS propagation |
