// ============================================================
// UNISSA AI Service – Multi-provider LLM integration
// Supports: OpenAI, Anthropic Claude, Custom OpenAI-compatible
// Config stored in SystemConfig table (key prefix: ai_)
// ============================================================

import prisma from '../lib/prisma'

export interface AiConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'custom'
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt: string
  temperature: number
  maxTokens: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const DEFAULT_SYSTEM_PROMPT = `You are UNIBOT, the official AI assistant for UNISSA (Universiti Islam Sultan Sharif Ali).
You help students, staff, and faculty with:
- Course registration and academic matters
- Fee enquiries and payment information
- Campus services and facilities
- University policies and procedures
- Research and HR inquiries

Always be helpful, accurate, and professional. Respond in English by default.
When you have access to student context data, use it to provide personalised answers.
If you don't know something specific, direct users to the relevant department.
When assessing submitted work against a rubric, always respond in English regardless of the language of the submitted document.`

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  openai:    { baseUrl: 'https://api.openai.com/v1',           model: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1',        model: 'claude-3-5-haiku-20241022' },
  custom:    { baseUrl: 'http://localhost:11434/v1',            model: 'llama3.2' },
}

/** Load AI config from SystemConfig table (merged with env vars as fallback) */
export async function loadAiConfig(): Promise<AiConfig> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { startsWith: 'ai_' } },
  })
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value

  const provider = (map['ai_provider'] || process.env.AI_PROVIDER || 'openai') as AiConfig['provider']
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.openai

  return {
    enabled:      (map['ai_enabled']       ?? 'false') === 'true',
    provider,
    apiKey:       map['ai_api_key']        ?? process.env.AI_API_KEY ?? '',
    model:        map['ai_model']          ?? process.env.AI_MODEL   ?? defaults.model,
    baseUrl:      map['ai_base_url']       ?? process.env.AI_BASE_URL ?? defaults.baseUrl,
    systemPrompt: map['ai_system_prompt']  ?? DEFAULT_SYSTEM_PROMPT,
    temperature:  parseFloat(map['ai_temperature'] ?? '0.7'),
    maxTokens:    parseInt(map['ai_max_tokens']    ?? '2048', 10),
  }
}

/** Save AI config to SystemConfig table */
export async function saveAiConfig(cfg: Partial<AiConfig>): Promise<void> {
  const updates: Record<string, string> = {}
  if (cfg.enabled      !== undefined) updates['ai_enabled']       = String(cfg.enabled)
  if (cfg.provider     !== undefined) updates['ai_provider']      = cfg.provider
  if (cfg.apiKey       !== undefined) updates['ai_api_key']       = cfg.apiKey
  if (cfg.model        !== undefined) updates['ai_model']         = cfg.model
  if (cfg.baseUrl      !== undefined) updates['ai_base_url']      = cfg.baseUrl
  if (cfg.systemPrompt !== undefined) updates['ai_system_prompt'] = cfg.systemPrompt
  if (cfg.temperature  !== undefined) updates['ai_temperature']   = String(cfg.temperature)
  if (cfg.maxTokens    !== undefined) updates['ai_max_tokens']    = String(cfg.maxTokens)

  for (const [key, value] of Object.entries(updates)) {
    await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value, description: `AI configuration: ${key}` },
      update: { value },
    })
  }
}

/** Call OpenAI-compatible chat completions API */
async function callOpenAI(cfg: AiConfig, messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return data.choices?.[0]?.message?.content ?? ''
}

/** Call Anthropic Messages API */
async function callAnthropic(cfg: AiConfig, messages: ChatMessage[]): Promise<string> {
  // Extract system prompt and non-system messages
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? cfg.systemPrompt
  const chatMsgs  = messages.filter(m => m.role !== 'system')

  const response = await fetch(`${cfg.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      system: systemMsg,
      messages: chatMsgs,
      max_tokens: cfg.maxTokens,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return data.content?.[0]?.text ?? ''
}

/**
 * Main chat function – calls the configured LLM provider.
 * Falls back to demo mode if AI is disabled or not configured.
 */
export async function chat(
  userMessage: string,
  contextData: any = {},
  conversationHistory: ChatMessage[] = [],
): Promise<string> {
  const cfg = await loadAiConfig()

  // Fall back to demo if AI not enabled or no API key
  if (!cfg.enabled || !cfg.apiKey) {
    return getDemoAnswer(userMessage, contextData)
  }

  // Build context string from RAG data
  let contextStr = ''

  if (contextData.student) {
    const s = contextData.student
    const enrolmentLines = (s.enrolments ?? []).map((e: any) =>
      `  • ${e.offering?.course?.code} – ${e.offering?.course?.name} (${e.offering?.semester?.name ?? ''})`
    ).join('\n') || '  None'

    const submissionLines = (s.submissions ?? []).map((sub: any) =>
      `  • ${sub.assignment?.title}: ${sub.finalMarks != null ? `${sub.finalMarks}/${sub.assignment?.maxMarks}` : 'submitted, not yet graded'} (submitted ${new Date(sub.submittedAt).toLocaleDateString('en-GB')})`
    ).join('\n') || '  None'

    const gpaLines = (s.gpaRecords ?? []).map((g: any) =>
      `  • ${g.semester?.name} ${g.semester?.academicYear?.year ?? ''}: Semester GPA ${g.semesterGpa.toFixed(2)}, Cumulative GPA ${g.cumulativeGpa.toFixed(2)}`
    ).join('\n') || '  No records yet'

    const invoiceLines = (s.feeInvoices ?? []).map((inv: any) =>
      `  • ${inv.invoiceNo}: BND ${inv.totalAmount?.toFixed(2)} (${inv.status}, outstanding: BND ${inv.outstandingBalance?.toFixed(2)}, due ${new Date(inv.dueDate).toLocaleDateString('en-GB')})`
    ).join('\n') || '  None'

    contextStr = `=== STUDENT CONTEXT ===
Name: ${s.user?.displayName ?? 'Unknown'} | Student ID: ${s.studentId}
Programme: ${s.programme?.name ?? 'Unknown'} | CGPA: ${s.currentCgpa} | Status: ${s.status}

Enrolled Courses:
${enrolmentLines}

Submissions & Grades:
${submissionLines}

GPA History:
${gpaLines}

Fee Invoices:
${invoiceLines}
======================`

  } else if (contextData.lecturer) {
    const lec = contextData.lecturer
    const offeringBlocks = (lec.courseOfferings ?? []).map((o: any) => {
      const enrolledStudents = (o.enrolments ?? []).map((e: any) =>
        `    - ${e.student?.user?.displayName ?? 'Unknown'} (ID: ${e.student?.studentId}, CGPA: ${e.student?.currentCgpa?.toFixed(2) ?? 'N/A'})`
      ).join('\n') || '    None'

      const assignmentLines = (o.assignments ?? []).map((a: any) => {
        const submittedIds = new Set((a.submissions ?? []).map((s: any) => s.studentId))
        const enrolledCount = (o.enrolments ?? []).length
        const notSubmitted = (o.enrolments ?? [])
          .filter((e: any) => !submittedIds.has(e.student?.id))
          .map((e: any) => e.student?.user?.displayName ?? 'Unknown')
        return `    • "${a.title}" due ${new Date(a.dueDate).toLocaleDateString('en-GB')}: ${submittedIds.size}/${enrolledCount} submitted. Not submitted: ${notSubmitted.join(', ') || 'all submitted'}`
      }).join('\n') || '    None'

      const recentSessions = (o.attendanceSessions ?? []).map((ses: any) => {
        const presentCount = (ses.records ?? []).filter((r: any) => r.status === 'present').length
        const totalRecords = (ses.records ?? []).length
        return `    • Session ${new Date(ses.startedAt).toLocaleDateString('en-GB')}: ${presentCount}/${totalRecords} present`
      }).join('\n') || '    No sessions yet'

      return `  [${o.course?.code} – ${o.course?.name}] (${o.semester?.name ?? ''} ${o.semester?.academicYear?.year ?? ''}) – ${(o.enrolments ?? []).length} enrolled students
  Students:
${enrolledStudents}
  Assignments:
${assignmentLines}
  Recent Attendance (last 5 sessions):
${recentSessions}`
    }).join('\n\n') || '  No courses assigned'

    contextStr = `=== LECTURER CONTEXT ===
Name: ${lec.fullName} | Staff ID: ${lec.staffId}
Department: ${lec.department?.name ?? 'Unknown'} (${lec.department?.code ?? ''})

Course Offerings:
${offeringBlocks}
========================`

  } else if (contextData.admin) {
    const a = contextData.admin
    const glLines = (a.glCodes ?? []).map((g: any) => {
      const utilPct = g.totalBudget > 0 ? ((g.spentAmount / g.totalBudget) * 100).toFixed(1) : '0.0'
      return `  • ${g.code} – ${g.description}: Budget BND ${g.totalBudget.toFixed(0)}, Committed BND ${g.committedAmount.toFixed(0)}, Spent BND ${g.spentAmount.toFixed(0)} (${utilPct}% utilised)`
    }).join('\n') || '  None'

    contextStr = `=== ADMIN/MANAGER CONTEXT ===
Active Students: ${a.activeStudents}
Active Staff: ${a.activeStaff}

Pending Approvals:
  • Purchase Requests awaiting approval: ${a.pendingPRs}
  • Leave Requests pending: ${a.pendingLeaves}
  • Research Grant proposals under review: ${a.pendingGrants}

Recent Applications (last 30 days): ${a.recentApplicants} submitted

GL Budget Utilisation:
${glLines}
==============================`

  } else if (contextData.finance) {
    const f = contextData.finance
    const glLines = (f.glCodes ?? []).map((g: any) => {
      const available = g.totalBudget - g.committedAmount - g.spentAmount
      const utilPct = g.totalBudget > 0 ? ((g.spentAmount / g.totalBudget) * 100).toFixed(1) : '0.0'
      return `  • ${g.code} – ${g.description}: Budget BND ${g.totalBudget.toFixed(0)}, Committed BND ${g.committedAmount.toFixed(0)}, Spent BND ${g.spentAmount.toFixed(0)}, Available BND ${available.toFixed(0)} (${utilPct}% spent)`
    }).join('\n') || '  None'

    contextStr = `=== FINANCE CONTEXT ===
Outstanding Invoices: ${f.outstandingInvoiceCount} invoices totalling BND ${f.outstandingTotal.toFixed(2)}
Recent Payments (last 7 days): ${f.recentPaymentCount} payments totalling BND ${f.recentPaymentTotal.toFixed(2)}

GL Code Budget vs Committed vs Spent:
${glLines}
=======================`

  } else if (contextData.hr) {
    const h = contextData.hr
    const staffLines = (h.allStaff ?? []).map((s: any) =>
      `  • ${s.fullName} (${s.staffId}) – ${s.designation}, ${s.department?.name ?? 'Unknown'}, ${s.employmentType}`
    ).join('\n') || '  None'

    const leaveLines = (h.pendingLeaves ?? []).map((l: any) =>
      `  • ${l.staff?.fullName} (${l.leaveType}): ${new Date(l.startDate).toLocaleDateString('en-GB')} – ${new Date(l.endDate).toLocaleDateString('en-GB')} (${l.durationDays} days)`
    ).join('\n') || '  None'

    const onboardingLines = (h.pendingOnboarding ?? []).map((o: any) =>
      `  • ${o.staff?.fullName} – ${o.staff?.designation}, ${o.staff?.department?.name ?? 'Unknown'}`
    ).join('\n') || '  None'

    contextStr = `=== HR CONTEXT ===
Active Staff (${(h.allStaff ?? []).length} total):
${staffLines}

Pending Leave Requests (${(h.pendingLeaves ?? []).length}):
${leaveLines}

Pending Onboarding Requests (${(h.pendingOnboarding ?? []).length}):
${onboardingLines}
==================`
  }

  // Build messages array
  const systemContent = contextStr
    ? `${cfg.systemPrompt}\n\n${contextStr}`
    : cfg.systemPrompt

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...conversationHistory.slice(-10), // keep last 10 messages for context
    { role: 'user', content: userMessage },
  ]

  try {
    if (cfg.provider === 'anthropic') {
      return await callAnthropic(cfg, messages)
    } else {
      // openai or custom (OpenAI-compatible)
      return await callOpenAI(cfg, messages)
    }
  } catch (err) {
    console.error('[AI Service] Error calling LLM:', err)
    // Return informative error that won't expose credentials
    return "I'm currently experiencing technical difficulties. Please try again shortly, or contact the university helpdesk for urgent matters."
  }
}

/** Test the AI connection with a simple ping */
export async function testConnection(): Promise<{ success: boolean; message: string; model?: string }> {
  const cfg = await loadAiConfig()

  if (!cfg.apiKey) {
    return { success: false, message: 'No API key configured' }
  }

  try {
    const reply = await chat('Say "UNISSA AI connected" and nothing else.', {}, [])
    return { success: true, message: reply.trim(), model: cfg.model }
  } catch (err: any) {
    return { success: false, message: err.message ?? 'Connection failed' }
  }
}

// ============================================================
// Demo fallback Q&A (used when AI is not configured)
// ============================================================
function getDemoAnswer(message: string, ctx: any): string {
  const m = message.toLowerCase()

  if (m.includes('registration deadline') || m.includes('course registration')) {
    return "Your course registration deadline is **28 February 2026**. You can register up to 18 credit hours per semester (or 21 CH if your CGPA is ≥ 3.5)."
  }
  if (m.includes('drop') && (m.includes('course') || m.includes('ifn'))) {
    return "Courses can be dropped until the **end of the add/drop period** (2 weeks from semester start). Dropping below the minimum 12 credit hours (for standard students) is not permitted without special approval."
  }
  if (m.includes('fee') || m.includes('invoice') || m.includes('payment')) {
    const inv = ctx.student?.feeInvoices?.[0]
    if (inv) return `Your current fee invoice is **${inv.invoiceNo}** for **BND ${inv.totalAmount?.toFixed(2)}**. Status: **${inv.status?.toUpperCase()}**. Due date: ${new Date(inv.dueDate).toLocaleDateString('en-GB')}.`
    return "Your tuition fee invoice is generated after course registration. Tuition is calculated as credit hours × fee per CH + BND 50 library fee."
  }
  if (m.includes('gpa') || m.includes('cgpa')) {
    const cgpa = ctx.student?.currentCgpa
    return `Your current CGPA is **${cgpa ?? 'N/A'}**. You need a CGPA of 3.5 or above to register for up to 21 credit hours per semester.`
  }
  if (m.includes('campus card')) {
    return `Your Campus Card number is **${ctx.student?.campusCardNo ?? 'Not yet issued'}**. It is activated after course registration and grants access to the library, campus facilities, and meal plans.`
  }
  if (m.includes('assignment') || m.includes('due')) {
    return "Please check your LMS → My Courses for upcoming assignment deadlines. Each course page lists all assignments with their due dates and weightage."
  }
  if (m.includes('leave') || m.includes('annual leave')) {
    return "To apply for annual leave, go to HR → Leave Management and click 'Apply for Leave'. Leave requests require approval from your department head."
  }
  if (m.includes('library')) {
    return "Your library account is activated automatically when you complete course registration. You can borrow up to 5 books at a time. Visit the library with your campus card."
  }
  if (m.includes('research') || m.includes('grant')) {
    return "Research grant proposals can be submitted through Research → Grants. Proposals go through department head review, committee evaluation, and finance approval."
  }
  if (m.includes('procurement') || m.includes('purchase')) {
    return "Purchase requests can be submitted via Procurement → Purchase Requests. Requests under BND 500 require 1 quote; above BND 500 requires 3 quotes; above BND 2,000 goes to tender."
  }

  return "I can help you with course registration, fee enquiries, assignment deadlines, CGPA, campus services, HR matters, and more. Please ask a specific question, or contact the relevant department for detailed assistance.\n\n*Note: Configure a real AI model in Admin → Settings → AI Configuration for enhanced responses.*"
}
