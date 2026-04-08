# UNISSA POC — Assignment System Fix: Detailed AI Prompts

## Problem Summary

The teacher can create assignments with structured questions (single-choice MCQ, multiple-choice MCQ, open-ended) via the assignment creation modal in `LmsCourseDetailLecturer.tsx`. These questions are saved inside the `rubricCriteria` JSON field of the `Assignment` model as:

```json
{
  "criteria": [{ "criterion": "Content", "max_marks": 60 }],
  "questions": [{ "type": "single-choice", "text": "...", "options": ["A","B"], "marks": 5 }]
}
```

**But the student submission form (`LmsCourseDetailStudent.tsx`) always shows only a generic textarea + file upload, regardless of what questions the teacher created.** Questions are never rendered to the student.

Additionally, AI scoring is entirely hardcoded in `backend/src/routes/lms.ts` (lines 671–676) — every submission receives the exact same 4 mock rubric scores, regardless of assignment content or student answers.

**These two problems must be fixed together as one cohesive system.**

---

## Root Cause Analysis

| Layer | Problem | File & Location |
|-------|---------|-----------------|
| DB Schema | `assetId` is required + `@unique` on `Submission` — blocks submissions without file upload | `backend/prisma/schema.prisma` — Submission model |
| DB Schema | No `answers` field on `Submission` — nowhere to store per-question answers | `backend/prisma/schema.prisma` — Submission model |
| Teacher UI | `Question` interface has no `correctAnswer` field — MCQ auto-grading impossible | `LmsCourseDetailLecturer.tsx` lines 47–53 |
| Backend API | `POST /lms/submissions` hardcodes AI scores (same 4 scores for every submission) | `backend/src/routes/lms.ts` lines 671–676 |
| Backend API | No real AI scoring function exists in `aiService.ts` | `backend/src/services/aiService.ts` |
| Student UI | Submission modal never fetches/renders assignment questions | `LmsCourseDetailStudent.tsx` lines 817–886 |
| Seed Data | Seeded assignments have no `correctAnswer` in questions | `backend/prisma/seed.ts` lines 920–1083 |

---

## Fix Overview (6 Prompts — Apply in Order)

---

## Prompt 1 — Prisma Schema: Add `answers` field and make `assetId` optional

**File:** `backend/prisma/schema.prisma`

**Context:** The `Submission` model currently has `assetId String @unique` which is required and enforces one file per submission. This blocks submissions that are question-answer based (no file needed). We need to make `assetId` optional and add an `answers` field.

**Exact change — find this model:**

```prisma
model Submission {
  id               String   @id @default(cuid())
  assignmentId     String
  assignment       Assignment @relation(fields: [assignmentId], references: [id])
  studentId        String
  student          Student    @relation(fields: [studentId], references: [id])
  assetId          String     @unique
  asset            FileAsset  @relation(fields: [assetId], references: [id])
  submittedAt      DateTime   @default(now())
  aiRubricScores   String?
  aiGeneratedAt    DateTime?
  instructorScores String?
  finalMarks       Float?
  gradedAt         DateTime?
  gradedById       String?

  @@unique([assignmentId, studentId])
  @@map("submissions")
}
```

**Replace with:**

```prisma
model Submission {
  id               String   @id @default(cuid())
  assignmentId     String
  assignment       Assignment @relation(fields: [assignmentId], references: [id])
  studentId        String
  student          Student    @relation(fields: [studentId], references: [id])
  assetId          String?    @unique
  asset            FileAsset? @relation(fields: [assetId], references: [id])
  answers          String?    // JSON: [{questionIndex, type, answer}]
  submittedAt      DateTime   @default(now())
  aiRubricScores   String?
  aiGeneratedAt    DateTime?
  instructorScores String?
  finalMarks       Float?
  gradedAt         DateTime?
  gradedById       String?

  @@unique([assignmentId, studentId])
  @@map("submissions")
}
```

**Key changes:**
- `assetId String @unique` → `assetId String? @unique` (now optional)
- `asset FileAsset @relation(...)` → `asset FileAsset? @relation(...)` (optional relation)
- Added `answers String?` field

**After making this change, run the migration:**

```bash
cd backend
npx prisma migrate dev --name add_submission_answers
```

---

## Prompt 2 — Teacher UI: Add `correctAnswer` field to MCQ question builder

**File:** `frontend/src/pages/lms/LmsCourseDetailLecturer.tsx`

**Context:** The `Question` interface (lines 47–53) and the question builder UI (lines 1130–1303) currently have no way for the teacher to mark which MCQ option is correct. We need to add a `correctAnswer` field to the interface and a visual "mark as correct" radio selector to the question builder.

### Change 2a — Update the `Question` interface (around line 47)

**Find:**
```typescript
type QuestionType = 'single-choice' | 'multiple-choice' | 'open-ended'
interface Question {
  type: QuestionType
  text: string
  options: string[]
  marks: number
}
```

**Replace with:**
```typescript
type QuestionType = 'single-choice' | 'multiple-choice' | 'open-ended'
interface Question {
  type: QuestionType
  text: string
  options: string[]
  marks: number
  correctAnswer?: string | string[]  // string for single-choice, string[] for multiple-choice
}
```

### Change 2b — Update the MCQ option list in the question builder JSX

**Find the section that renders MCQ options (inside `{q.type !== 'open-ended' && (` block):**

```jsx
{q.options.map((opt, oi) => (
  <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
    <span style={{ fontSize: 12, color: 'var(--color-gray-5)', padding: '6px 2px', minWidth: 16 }}>{String.fromCharCode(65 + oi)}.</span>
    <Input
      placeholder={t('lmsCourseDetailLecturer.optionText', { defaultValue: `Option ${String.fromCharCode(65 + oi)}` })}
      value={opt}
      onChange={e => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? {
        ...x, options: x.options.map((o, oi2) => oi2 === oi ? e.target.value : o)
      } : x))}
      style={{ flex: 1 }}
    />
    {q.options.length > 2 && (
      <Button size="sm" variant="ghost" icon={<Minus size={11} />}
        onClick={() => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? { ...x, options: x.options.filter((_, oi2) => oi2 !== oi) } : x))} />
    )}
  </div>
))}
```

**Replace with:**
```jsx
<div style={{ fontSize: 11, color: 'var(--color-gray-5)', marginBottom: 4 }}>
  {q.type === 'single-choice' ? '✓ Click radio to mark correct answer' : '✓ Click checkboxes to mark correct answers'}
</div>
{q.options.map((opt, oi) => {
  const optLabel = String.fromCharCode(65 + oi)
  const isCorrect = q.type === 'single-choice'
    ? q.correctAnswer === optLabel
    : Array.isArray(q.correctAnswer) && q.correctAnswer.includes(optLabel)
  return (
    <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
      <input
        type={q.type === 'single-choice' ? 'radio' : 'checkbox'}
        name={`correct-${qi}`}
        checked={isCorrect}
        onChange={() => {
          setAsnQuestions(prev => prev.map((x, xi) => {
            if (xi !== qi) return x
            if (x.type === 'single-choice') {
              return { ...x, correctAnswer: optLabel }
            } else {
              const prev2 = Array.isArray(x.correctAnswer) ? x.correctAnswer : []
              return {
                ...x,
                correctAnswer: isCorrect
                  ? prev2.filter(a => a !== optLabel)
                  : [...prev2, optLabel]
              }
            }
          }))
        }}
        title="Mark as correct answer"
        style={{ cursor: 'pointer', accentColor: 'var(--color-success)' }}
      />
      <span style={{ fontSize: 12, color: isCorrect ? 'var(--color-success)' : 'var(--color-gray-5)', padding: '6px 2px', minWidth: 16, fontWeight: isCorrect ? 700 : 400 }}>
        {optLabel}.
      </span>
      <Input
        placeholder={t('lmsCourseDetailLecturer.optionText', { defaultValue: `Option ${optLabel}` })}
        value={opt}
        onChange={e => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? {
          ...x, options: x.options.map((o, oi2) => oi2 === oi ? e.target.value : o)
        } : x))}
        style={{ flex: 1, borderColor: isCorrect ? 'var(--color-success)' : undefined }}
      />
      {q.options.length > 2 && (
        <Button size="sm" variant="ghost" icon={<Minus size={11} />}
          onClick={() => setAsnQuestions(prev => prev.map((x, xi) => xi === qi ? { ...x, options: x.options.filter((_, oi2) => oi2 !== oi) } : x))} />
      )}
    </div>
  )
})}
```

### Change 2c — Reset `correctAnswer` when resetting the assignment form

Find the `resetAssignmentForm` function and ensure it resets `asnQuestions` to `[]` (it likely already does — just confirm this includes clearing the `correctAnswer` field since the entire `asnQuestions` array is reset).

---

## Prompt 3 — Backend: Real AI Scoring Function in `aiService.ts`

**File:** `backend/src/services/aiService.ts`

**Context:** Currently there is no function for scoring assignment submissions. Add a `scoreSubmission()` function that:
1. Auto-grades MCQ questions by comparing student answers to `correctAnswer`
2. Sends open-ended question answers and rubric criteria to the AI model for evaluation
3. Returns a unified array of rubric scores

**Add this entire function at the end of the file (before the closing `}` of the class or after the last export):**

```typescript
// ─── Types ───────────────────────────────────────────────────────────────────

interface RubricCriterion {
  criterion: string
  max_marks: number
  ai_suggestion?: string
}

interface AssignmentQuestion {
  type: 'single-choice' | 'multiple-choice' | 'open-ended'
  text: string
  options?: string[]
  marks: number
  correctAnswer?: string | string[]
}

interface StudentAnswer {
  questionIndex: number
  type: string
  answer: string | string[]
}

interface RubricScore {
  criterion: string
  ai_score: number
  max_marks: number
  ai_comment: string
  ai_suggestions: string
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

export async function scoreSubmission(params: {
  assignmentTitle: string
  rubricCriteria: RubricCriterion[]
  questions: AssignmentQuestion[]
  answers: StudentAnswer[]
  textContent?: string
  maxMarks: number
}): Promise<RubricScore[]> {
  const { assignmentTitle, rubricCriteria, questions, answers, textContent, maxMarks } = params
  const scores: RubricScore[] = []

  // Step 1: Auto-grade objective questions (MCQ)
  const objectiveQuestions = questions.filter(q => q.type !== 'open-ended')
  let objectiveTotal = 0
  let objectiveMax = 0
  const objectiveDetails: string[] = []

  for (const q of objectiveQuestions) {
    const qi = questions.indexOf(q)
    const studentAnswer = answers.find(a => a.questionIndex === qi)
    objectiveMax += q.marks

    if (!studentAnswer || !q.correctAnswer) {
      objectiveDetails.push(`Q${qi + 1}: "${q.text.slice(0, 60)}" — No answer or no correct answer defined (0/${q.marks} pts)`)
      continue
    }

    const sa = studentAnswer.answer
    const ca = q.correctAnswer

    let isCorrect = false
    if (q.type === 'single-choice') {
      isCorrect = String(sa).trim().toUpperCase() === String(ca).trim().toUpperCase()
    } else if (q.type === 'multiple-choice') {
      const saArr = (Array.isArray(sa) ? sa : [sa]).map(s => s.trim().toUpperCase()).sort()
      const caArr = (Array.isArray(ca) ? ca : [ca]).map(c => c.trim().toUpperCase()).sort()
      isCorrect = JSON.stringify(saArr) === JSON.stringify(caArr)
    }

    if (isCorrect) {
      objectiveTotal += q.marks
      objectiveDetails.push(`Q${qi + 1}: "${q.text.slice(0, 60)}" — Correct ✓ (${q.marks}/${q.marks} pts)`)
    } else {
      objectiveDetails.push(`Q${qi + 1}: "${q.text.slice(0, 60)}" — Incorrect ✗ (0/${q.marks} pts, correct: ${JSON.stringify(ca)})`)
    }
  }

  // Add MCQ score to results if any objective questions exist
  if (objectiveMax > 0) {
    const objectivePct = Math.round((objectiveTotal / objectiveMax) * 10 * 10) / 10
    scores.push({
      criterion: 'Objective Questions (MCQ)',
      ai_score: objectivePct,
      max_marks: objectiveMax,
      ai_comment: `Scored ${objectiveTotal}/${objectiveMax} marks on objective questions.\n${objectiveDetails.join('\n')}`,
      ai_suggestions: objectiveTotal < objectiveMax
        ? 'Review the questions answered incorrectly and revisit the related course materials.'
        : 'All objective questions answered correctly. Well done!',
    })
  }

  // Step 2: AI-grade open-ended questions and rubric criteria
  const openEndedQuestions = questions.filter(q => q.type === 'open-ended')
  const openEndedAnswers: string[] = []

  for (const q of openEndedQuestions) {
    const qi = questions.indexOf(q)
    const studentAnswer = answers.find(a => a.questionIndex === qi)
    openEndedAnswers.push(
      `Q${qi + 1} [${q.marks} pts]: ${q.text}\nStudent Answer: ${studentAnswer ? String(studentAnswer.answer) : '(No answer provided)'}`
    )
  }

  const freeTextContent = textContent ? `\nFree-text submission:\n${textContent}` : ''
  const hasAiContent = openEndedAnswers.length > 0 || freeTextContent || rubricCriteria.length > 0

  if (hasAiContent && rubricCriteria.length > 0) {
    try {
      const systemPrompt = `You are an academic assignment grader. Assess the student's work strictly against the provided rubric criteria.
Always respond in English regardless of the language of the submission.
Return ONLY valid JSON — an array of rubric score objects. Do not include any text outside the JSON array.`

      const userPrompt = `Assignment: "${assignmentTitle}"
Max Marks: ${maxMarks}

RUBRIC CRITERIA:
${rubricCriteria.map(c => `- ${c.criterion} (${c.max_marks} marks): ${c.ai_suggestion ?? 'Assess quality and completeness'}`).join('\n')}

OPEN-ENDED QUESTIONS AND STUDENT ANSWERS:
${openEndedAnswers.join('\n\n') || '(No open-ended questions)'}
${freeTextContent}

INSTRUCTIONS:
Evaluate the student's submission against each rubric criterion.
Score each criterion from 0 to 10 (where 10 = full marks for that criterion).
Be fair but rigorous. Penalise incomplete or off-topic answers.

Return a JSON array in this exact format:
[
  {
    "criterion": "criterion name exactly as given",
    "ai_score": <number 0-10>,
    "ai_comment": "specific feedback about this criterion",
    "ai_suggestions": "concrete suggestions for improvement"
  }
]`

      // Use the existing AI call infrastructure
      const aiConfig = await loadAiConfig()
      let responseText = ''

      if (aiConfig.provider === 'anthropic') {
        responseText = await callAnthropic(systemPrompt, userPrompt, aiConfig)
      } else {
        // Default: OpenAI-compatible (includes DeepSeek)
        responseText = await callOpenAI(systemPrompt, userPrompt, aiConfig)
      }

      // Parse the JSON response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const aiScores: Array<{ criterion: string; ai_score: number; ai_comment: string; ai_suggestions: string }> = JSON.parse(jsonMatch[0])
        for (const s of aiScores) {
          const criterion = rubricCriteria.find(c => c.criterion === s.criterion)
          scores.push({
            criterion: s.criterion,
            ai_score: Math.max(0, Math.min(10, Number(s.ai_score) || 0)),
            max_marks: criterion?.max_marks ?? 10,
            ai_comment: s.ai_comment ?? '',
            ai_suggestions: s.ai_suggestions ?? '',
          })
        }
      }
    } catch (err) {
      console.error('[scoreSubmission] AI grading error:', err)
      // Fallback: give neutral scores if AI fails
      for (const c of rubricCriteria) {
        scores.push({
          criterion: c.criterion,
          ai_score: 5,
          max_marks: c.max_marks,
          ai_comment: 'AI grading temporarily unavailable. Please review manually.',
          ai_suggestions: 'Instructor review recommended.',
        })
      }
    }
  }

  return scores
}
```

**Important:** The function references `loadAiConfig`, `callAnthropic`, and `callOpenAI` which already exist in `aiService.ts`. Ensure the function is placed in the same file where these are defined, or import them if they are exported.

---

## Prompt 4 — Backend: Update `POST /lms/submissions` to use real AI scoring

**File:** `backend/src/routes/lms.ts`

**Context:** The submission endpoint (around line 583) hardcodes 4 mock rubric scores. It must be replaced with: (1) accepting an `answers` JSON array, (2) parsing the assignment's questions, (3) calling the new `scoreSubmission()` function from `aiService.ts`, (4) storing answers in the `answers` field.

### Change 4a — Add import for `scoreSubmission`

At the top of `lms.ts`, find the import from `aiService`:
```typescript
import { ... } from '../services/aiService'
```

Add `scoreSubmission` to the import. If no aiService import exists yet, add:
```typescript
import { scoreSubmission } from '../services/aiService'
```

### Change 4b — Replace the hardcoded AI rubric section

**Find this block (approximately lines 671–680):**
```typescript
// Pre-seeded AI rubric scores (demo) — each criterion scored out of 10
const aiRubricScores = JSON.stringify([
  { criterion: 'Clarity', ai_score: 8.0, ai_comment: 'The submission is well-structured...', ai_suggestions: '...' },
  { criterion: 'References', ai_score: 6.5, ai_comment: '...', ai_suggestions: '...' },
  { criterion: 'Analysis', ai_score: 7.5, ai_comment: '...', ai_suggestions: '...' },
  { criterion: 'Code Quality', ai_score: 7.0, ai_comment: '...', ai_suggestions: '...' }
])
```

**Replace the entire hardcoded block with real AI scoring logic. The replacement must:**

1. Parse `answers` from `req.body.answers` (JSON string or array)
2. Parse the assignment's `rubricCriteria` to extract `criteria` and `questions`
3. Call `scoreSubmission()` with the parsed data
4. Store the result in `aiRubricScores`

**Replacement code:**

```typescript
// Parse student answers from request body
let studentAnswers: Array<{ questionIndex: number; type: string; answer: string | string[] }> = []
try {
  if (req.body.answers) {
    studentAnswers = typeof req.body.answers === 'string'
      ? JSON.parse(req.body.answers)
      : req.body.answers
  }
} catch { studentAnswers = [] }

// Parse assignment rubric and questions
let rubricCriteria: Array<{ criterion: string; max_marks: number; ai_suggestion?: string }> = []
let assignmentQuestions: Array<{ type: string; text: string; options?: string[]; marks: number; correctAnswer?: string | string[] }> = []
try {
  if (assignment.rubricCriteria) {
    const parsed = JSON.parse(assignment.rubricCriteria)
    rubricCriteria = parsed.criteria ?? []
    assignmentQuestions = parsed.questions ?? []
  }
} catch { /* ignore parse errors */ }

// Run real AI scoring
let aiRubricScores = '[]'
try {
  const scores = await scoreSubmission({
    assignmentTitle: assignment.title,
    rubricCriteria,
    questions: assignmentQuestions as any,
    answers: studentAnswers,
    textContent: content ?? '',
    maxMarks: assignment.maxMarks,
  })
  aiRubricScores = JSON.stringify(scores)
} catch (err) {
  console.error('[submissions] AI scoring failed:', err)
  aiRubricScores = JSON.stringify(rubricCriteria.map(c => ({
    criterion: c.criterion,
    ai_score: 5,
    max_marks: c.max_marks,
    ai_comment: 'AI grading temporarily unavailable.',
    ai_suggestions: 'Please review manually.',
  })))
}
```

### Change 4c — Accept `answers` and make file optional in the submission creation

**Find the `prisma.submission.create(...)` call (approximately lines 685–710).**

Currently it requires `assetId`. Update it to handle the case where no file was uploaded:

```typescript
// Determine assetId — file is optional for question-answer submissions
let assetId: string | undefined = undefined
if (req.files && (req.files as Express.Multer.File[]).length > 0) {
  // File was uploaded — create FileAsset as before
  const file = (req.files as Express.Multer.File[])[0]
  const fileAsset = await prisma.fileAsset.create({
    data: {
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      fileUrl: `/uploads/${file.filename}`,
      uploadedById: req.user!.userId,
    }
  })
  assetId = fileAsset.id
}

const submission = await prisma.submission.create({
  data: {
    assignmentId,
    studentId: student.id,
    ...(assetId ? { assetId } : {}),
    answers: studentAnswers.length > 0 ? JSON.stringify(studentAnswers) : null,
    content: content ?? null,
    aiRubricScores,
    aiGeneratedAt: new Date(),
  },
  include: { assignment: true, student: { include: { user: true } } }
})
```

> **Note:** The exact structure of the FileAsset creation may differ slightly from the existing code. Match it to whatever the existing code uses for creating FileAsset records — do not change the FileAsset creation logic, only wrap it in the `if (files.length > 0)` condition and make `assetId` optional in the `submission.create` call.

---

## Prompt 5 — Student UI: Show assignment questions in the submission form

**File:** `frontend/src/pages/lms/LmsCourseDetailStudent.tsx`

**Context:** The submission modal (lines 817–886) currently shows only a generic textarea + file upload. It must be updated to:
1. Parse and display the assignment's questions from `rubricCriteria.questions`
2. Render appropriate input types per question (radio / checkbox / textarea)
3. Validate all questions are answered before allowing submission
4. Include `answers` in the submission API call

### Change 5a — Add state for per-question answers

**Find the existing submission-related state variables (around lines 70–90):**
```typescript
const [submitModal, setSubmitModal] = useState<Assignment | null>(null)
const [submissionContent, setSubmissionContent] = useState('')
const [submissionFiles, setSubmissionFiles] = useState<File[]>([])
```

**Add after these:**
```typescript
const [questionAnswers, setQuestionAnswers] = useState<Record<number, string | string[]>>({})
```

### Change 5b — Reset answers when modal closes

**Find the `onClose` handler of the submission modal:**
```typescript
onClose={() => { setSubmitModal(null); setSubmissionFiles([]); setAiLoading(false) }}
```

**Replace with:**
```typescript
onClose={() => { setSubmitModal(null); setSubmissionFiles([]); setAiLoading(false); setQuestionAnswers({}) }}
```

### Change 5c — Add a helper to parse questions from assignment

**Add this helper function near the top of the component (before the return statement):**

```typescript
const parseAssignmentQuestions = (assignment: Assignment | null) => {
  if (!assignment) return []
  try {
    const rubric = typeof (assignment as any).rubricCriteria === 'string'
      ? JSON.parse((assignment as any).rubricCriteria)
      : (assignment as any).rubricCriteria
    return rubric?.questions ?? []
  } catch {
    return []
  }
}
```

> **Note:** The `Assignment` interface in `LmsCourseDetailStudent.tsx` may not currently include `rubricCriteria`. If not, add it: `rubricCriteria?: string` to the interface definition.

### Change 5d — Replace the generic submission form content

**Find the entire non-AI-loading block inside the submission Modal (the `<>` fragment that contains the textarea, file upload, and AI note). It starts approximately at:**

```jsx
<>
  <p className={styles.submitInfo}>{t('lmsCourseDetail.maxMarks', ...
```

**Replace the entire `<>...</>` fragment with:**

```jsx
<>
  <p className={styles.submitInfo}>
    {t('lmsCourseDetail.maxMarks', { defaultValue: 'Max' })}: {submitModal.maxMarks} pts
    {' · '}{t('lmsCourseDetail.weight', { defaultValue: 'Weight' })}: {submitModal.weight}%
  </p>

  {/* Per-question answer section */}
  {(() => {
    const questions = parseAssignmentQuestions(submitModal)
    if (questions.length === 0) {
      // No structured questions — fall back to free-text
      return (
        <>
          <label className={styles.submitLabel}>
            {t('lmsCourseDetail.yourAnswerNotes', { defaultValue: 'Your answer / notes' })}
          </label>
          <textarea
            className={styles.submitTextarea}
            rows={6}
            placeholder={t('lmsCourseDetail.typeYourResponse', { defaultValue: 'Type your response here…' })}
            value={submissionContent}
            onChange={e => setSubmissionContent(e.target.value)}
          />
        </>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questions.map((q: any, qi: number) => (
          <div key={qi} style={{
            background: 'var(--color-gray-1)',
            borderRadius: 8,
            padding: '12px 14px',
            border: '1px solid var(--color-gray-3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gray-8)' }}>
                Q{qi + 1}. {q.text}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-gray-5)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                {q.marks} pts · <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>Required</span>
              </span>
            </div>

            {q.type === 'single-choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {q.options.map((opt: string, oi: number) => {
                  const label = String.fromCharCode(65 + oi)
                  return (
                    <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="radio"
                        name={`q-${qi}`}
                        value={label}
                        checked={questionAnswers[qi] === label}
                        onChange={() => setQuestionAnswers(prev => ({ ...prev, [qi]: label }))}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ fontWeight: 600, minWidth: 16 }}>{label}.</span>
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {q.type === 'multiple-choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--color-gray-5)', marginBottom: 2 }}>Select all that apply</div>
                {q.options.map((opt: string, oi: number) => {
                  const label = String.fromCharCode(65 + oi)
                  const selected: string[] = Array.isArray(questionAnswers[qi]) ? questionAnswers[qi] as string[] : []
                  return (
                    <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        value={label}
                        checked={selected.includes(label)}
                        onChange={() => {
                          setQuestionAnswers(prev => {
                            const cur: string[] = Array.isArray(prev[qi]) ? prev[qi] as string[] : []
                            return {
                              ...prev,
                              [qi]: cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label]
                            }
                          })
                        }}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ fontWeight: 600, minWidth: 16 }}>{label}.</span>
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {q.type === 'open-ended' && (
              <textarea
                style={{
                  width: '100%', minHeight: 80, padding: '8px 10px',
                  border: '1px solid var(--color-gray-3)', borderRadius: 6,
                  fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                  background: 'white',
                }}
                placeholder="Type your answer here…"
                value={typeof questionAnswers[qi] === 'string' ? questionAnswers[qi] as string : ''}
                onChange={e => setQuestionAnswers(prev => ({ ...prev, [qi]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
    )
  })()}

  {/* File upload (always optional) */}
  <div style={{ marginTop: 12 }}>
    <label className={styles.submitLabel}>
      {t('lmsCourseDetail.uploadImages', { defaultValue: 'Attach files (optional)' })}
    </label>
    <div className={styles.fileUpload}>
      <input
        type="file"
        multiple
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className={styles.fileInput}
        onChange={e => {
          if (e.target.files) {
            const files = Array.from(e.target.files)
            const v = validateFiles(files)
            if (v.valid) { setSubmissionFiles(files); setFileErrors([]) }
            else setFileErrors(v.errors)
          }
        }}
      />
      <div className={styles.fileButton}><Upload size={16} /><span>{t('lmsCourseDetail.chooseImages', { defaultValue: 'Choose files' })}</span></div>
    </div>
    {fileErrors.length > 0 && (
      <div className={styles.fileErrors}>
        {fileErrors.map((e, i) => <div key={i} className={styles.fileError}>{e}</div>)}
      </div>
    )}
    {submissionFiles.length > 0 && (
      <div className={styles.filesList}>
        {submissionFiles.map((f, i) => (
          <div key={i} className={styles.fileItem}>
            <FileText size={14} />
            <span className={styles.fileName}>{f.name}</span>
            <span className={styles.fileSize}>{(f.size / 1024).toFixed(1)} KB</span>
            <button className={styles.removeFile} onClick={() => setSubmissionFiles(submissionFiles.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
    )}
  </div>

  <p className={styles.aiNote}>🤖 {t('lmsCourseDetail.aiRubricGrading', { defaultValue: 'Submission will be assessed by AI rubric' })}</p>
</>
```

### Change 5e — Include `answers` and validation in the submit mutation call

**Find the `onOk` handler of the submission modal:**
```typescript
onOk={() => submitMutation.mutate({ assignmentId: submitModal.id, content: submissionContent, files: submissionFiles })}
```

**Replace with:**
```typescript
onOk={() => {
  // Validate all questions answered
  const questions = parseAssignmentQuestions(submitModal)
  const unanswered = questions.filter((_: any, qi: number) => {
    const ans = questionAnswers[qi]
    if (ans === undefined || ans === null) return true
    if (typeof ans === 'string') return ans.trim() === ''
    if (Array.isArray(ans)) return ans.length === 0
    return true
  })
  if (unanswered.length > 0) {
    addToast({ type: 'error', message: `Please answer all ${unanswered.length} required question(s) before submitting.` })
    return
  }
  // Build answers array
  const answersArray = questions.map((_: any, qi: number) => ({
    questionIndex: qi,
    type: questions[qi].type,
    answer: questionAnswers[qi] ?? '',
  }))
  submitMutation.mutate({
    assignmentId: submitModal.id,
    content: submissionContent,
    files: submissionFiles,
    answers: answersArray,
  })
}}
```

### Change 5f — Pass `answers` in the submit mutation's API call

**Find the `submitMutation` definition (the `useMutation` that calls `apiClient.post('/lms/submissions', ...)`).**

The mutation currently sends a `FormData` object. Update it to also append the `answers` field:

```typescript
// Inside the mutationFn, after creating formData and appending files:
if (variables.answers && variables.answers.length > 0) {
  formData.append('answers', JSON.stringify(variables.answers))
}
```

Also update the mutation's type signature if TypeScript complains:
```typescript
// Add answers to the mutation variable type
answers?: Array<{ questionIndex: number; type: string; answer: string | string[] }>
```

---

## Prompt 6 — Update Seed Data with correctAnswer fields

**File:** `backend/prisma/seed.ts`

**Context:** Seeded assignments currently have questions without `correctAnswer`. Update at least 2 seeded assignments to include MCQ `correctAnswer` values so the grading can be demonstrated with real auto-scoring.

**Find one of the seeded assignments that has questions in its `rubricCriteria`. For example, the "Quiz 1" or "Lab Exercise" assignments.**

**Add `correctAnswer` fields to any MCQ questions in the seed. Example pattern:**

```typescript
rubricCriteria: JSON.stringify({
  criteria: [
    { criterion: 'Accuracy', max_marks: 50, ai_suggestion: 'Award marks for correct answers' },
    { criterion: 'Explanation', max_marks: 50, ai_suggestion: 'Award marks for clear reasoning' },
  ],
  questions: [
    {
      type: 'single-choice',
      text: 'What is the time complexity of binary search?',
      options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
      marks: 10,
      correctAnswer: 'B',  // ← ADD THIS
    },
    {
      type: 'multiple-choice',
      text: 'Which of the following are sorting algorithms?',
      options: ['Quicksort', 'Binary Search', 'Merge Sort', 'Linear Search'],
      marks: 10,
      correctAnswer: ['A', 'C'],  // ← ADD THIS
    },
    {
      type: 'open-ended',
      text: 'Explain the difference between stack and queue data structures.',
      options: [],
      marks: 20,
      // No correctAnswer for open-ended — AI grades these
    },
  ],
}),
```

Apply this pattern to at least 2 different seeded assignments to ensure the demo can show both MCQ auto-scoring and AI open-ended scoring.

After modifying seed.ts, re-run the seed:
```bash
cd backend
npx prisma db seed
```

---

## Summary: Files Changed

| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | `assetId` optional, add `answers String?` to Submission |
| `backend/prisma/seed.ts` | Add `correctAnswer` to MCQ questions in seeded assignments |
| `backend/src/services/aiService.ts` | Add `scoreSubmission()` export function |
| `backend/src/routes/lms.ts` | Replace hardcoded AI scores with real scoring; accept `answers` field; make file upload optional |
| `frontend/src/pages/lms/LmsCourseDetailLecturer.tsx` | Add `correctAnswer` to Question interface; add radio/checkbox to mark correct answers in question builder |
| `frontend/src/pages/lms/LmsCourseDetailStudent.tsx` | Parse and render questions; per-question answer inputs (radio/checkbox/textarea); validate all answered; pass `answers` to API |

## Migration Command (run after schema changes)

```bash
cd C:\Users\Kenny\unissa-poc\backend
npx prisma migrate dev --name add_submission_answers
npx prisma db seed
```

## Verification Checklist

After all changes are applied:

1. **Teacher creates assignment with MCQ + open-ended questions** — verify `correctAnswer` radio selector appears for MCQ questions in the creation modal
2. **Student opens assignment** — verify questions are displayed with appropriate input types (radio for single-choice, checkboxes for multiple-choice, textarea for open-ended)
3. **Student tries to submit without answering a question** — verify toast error appears
4. **Student answers all questions and submits** — verify AI grading modal appears with real scores (not the same 4 mock scores)
5. **MCQ questions** — verify correct answers are auto-scored (100% if correct, 0% if wrong)
6. **Open-ended questions** — verify AI-generated comments are specific to the student's actual answer, not generic placeholders
7. **Teacher opens grading modal** — verify AI scores reflect the actual rubric criteria defined for that assignment (not Clarity/References/Analysis/Code Quality defaults)
