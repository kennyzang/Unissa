# 学生生命周期约束说明

> 适用系统：UNISSA POC · 最后更新：2026-03-30

---

## 目录

1. [概述：学生生命周期阶段](#1-概述学生生命周期阶段)
2. [入学申请（Admission Application）](#2-入学申请)
3. [选课注册（Course Registration）](#3-选课注册)
4. [费用与财务](#4-费用与财务)
5. [错误码与前端提示一览](#5-错误码与前端提示一览)
6. [数据模型关联](#6-数据模型关联)

---

## 1. 概述：学生生命周期阶段

```
申请入学 → 审核 → 录取 → 账号创建 → 选课注册 → 上课 / 考勤 / 作业 → 毕业
   ↕           ↕
 拒绝        撤回
```

| 阶段 | 系统对象 | 关键状态 |
|------|----------|----------|
| 申请 | `Applicant` | `draft` → `submitted` → `under_review` → `accepted / rejected / waitlisted` |
| 在籍 | `Student` | `active / suspended / graduated / withdrawn` |
| 选课 | `Enrolment` | `registered / dropped / completed / failed` |

---

## 2. 入学申请

### 2.1 申请流程（4 步表单）

| 步骤 | 内容 |
|------|------|
| Step 1 | 个人信息（姓名、IC/护照号、出生日期、性别、国籍、邮箱、手机、地址） |
| Step 2 | 学术背景（最高学历、毕业院校、完成年份、CGPA） |
| Step 3 | 报读选择（招生批次、学习模式、奖学金申请） |
| Step 4 | 信息确认 & 提交 |

### 2.2 提交约束

| 约束 | 规则 | 错误提示 |
|------|------|----------|
| IC / 护照唯一性 | 同一 IC 在系统中只允许有一条有效记录 | — |
| 已录取拦截 | IC 对应申请状态为 `accepted`（已录取），**拒绝**重新提交 | `"This IC/Passport number belongs to an enrolled student (APP-XXXX). Please contact the Admissions Office."` |
| 其他状态允许重投 | `submitted / under_review / rejected / waitlisted / draft` 均允许提交（会更新原记录） | — |
| 前端必填校验 | 每步均有 Zod schema 校验，未通过不允许进入下一步 | 字段行内红色提示 |

### 2.3 提交成功后

- 后端通过 `upsert` 创建或更新申请记录，状态置为 `submitted`
- 返回 `applicationRef`（格式：`APP-{年份}-{4位随机序号}`）
- 前端展示成功卡片，含申请编号，并可选择"再次提交新申请"

### 2.4 角色行为差异

| 角色 | 访问 `/admission/apply` 时的行为 |
|------|----------------------------------|
| 未登录 | 跳转登录 |
| `student`（已录取在籍） | 展示**在籍学生信息卡**（学号、专业、入学日期、CGPA、状态），提供快捷跳转至我的课程 / 选课 / 个人资料 |
| `admissions` / `admin` | 展示申请审核列表页（`/admission/review`） |
| 其他角色 | 不在侧边栏中显示此入口 |

### 2.5 录取后自动化操作（后端）

当录取官将申请状态改为 `accepted` 时，系统自动：

1. 生成学号（格式：`{年份}{序号3位}`，如 `2026001`）
2. 生成用户名（格式：`{firstName.alphanumeric}.{学号末3位}`）
3. 生成临时密码（格式：`{名字}@{年份}`，如 `Ahmad@2026`）
4. 创建 `User` 账号（`role: 'student'`）
5. 创建 `Student` 记录，若申请了奖学金则默认奖学金比例为 25%
6. 将 `Applicant.userId` 绑定到新建用户

---

## 3. 选课注册

### 3.1 注册流程

1. 学生进入**选课注册**页面，查看当前学期所有开放课程
2. 勾选目标课程（实时显示已选学分及冲突提示）
3. 确认弹窗 → 提交注册
4. 成功后展示 4 系统同步确认（LMS / 图书馆 / 校园卡 / 财务）

### 3.2 前端实时约束（提交前）

| 约束 | 规则 | UI 反馈 |
|------|------|---------|
| 学分下限 | 所选总学分 < `minCH` 时禁止提交 | 橙色警告 + 注册按钮禁用 |
| 学分上限 | 所选总学分 > `maxCH` 时禁止提交 | 红色警告 + 注册按钮禁用 |
| 时间冲突 | 同一天时段重叠则标红冲突课程，禁止提交 | 课程卡片红色高亮 + 顶部冲突横幅 |

学分上下限动态规则（与后端一致）：

| 学生类型 | 最小学分 | 最大学分 |
|----------|----------|----------|
| 标准（CGPA < 3.5） | 12 | 18 |
| 优秀（CGPA ≥ 3.5） | 12 | **21** |
| 试读（probation） | 3 | **6** |

### 3.3 后端校验约束（按执行顺序）

#### ① 课程是否存在
- 验证所有 `offeringId` 均存在于数据库
- 失败：`400 One or more course offerings not found`

#### ② 先修课程（Prerequisites）
- 检查学生的 `enrolment` 表，只有 `status = 'completed'` 的课程才算满足先修
- 失败示例：`400 { prereqErrors: ["IFN102 requires IFN101 (min grade: D)"] }`

> **注意**：当前系统仅检查课程是否已完成，**不检查最低成绩**（minGrade 仅展示提示）

#### ③ 时间冲突（Schedule Conflict）
- 同一天（`dayOfWeek` 相同）且时间区间有任意重叠（`startA < endB && endA > startB`）即判定冲突
- 失败示例：`400 { conflicts: [{ course1: "IFN101", course2: "IFN201", day: "Monday", time: "09:00–11:00" }] }`

#### ④ 学分范围（Credit Hours）
- 计算规则：`newCH + 已注册但不在本次选择中的现有 CH`
- 超出范围：`400 "Credit hours must be between {min} and {max}. Total: {n} CH."`

#### ⑤ 学生不存在
- 通过 `studentId`、`id`（UUID）、或 `userId` 任意一个查找学生
- 失败：`404 Student not found`

### 3.4 注册成功后的级联操作

| 操作 | 说明 |
|------|------|
| 创建 / 激活 Enrolment | `status: 'registered'`，已存在则 upsert |
| 生成校园卡号 | 格式 `CC-{年份}{学号末3位}`，已有则跳过 |
| 生成费用发票 | 学费 = 新选学分 × 每学分费用 × (1 - 奖学金比例)，加图书馆费 BND 50，到期 14 天 |
| 激活图书馆账号 | 账号编号 `LIB-{studentId}`，`isActive: true` |
| 激活邮箱账号 | `emailAccountActive: true` |

### 3.5 已注册后的状态说明

选课注册完成后，学生可在以下页面查看结果：

| 功能 | 路由 |
|------|------|
| 我的课程（课程表） | `/lms/courses` |
| 课程详情 / 作业提交 | `/lms/courses/:offeringId` |
| 考勤记录 | `/lms/attendance` |
| 费用账单 | `/finance/statement` |
| 校园服务（校园卡 / 图书馆） | `/campus/services` |

---

## 4. 费用与财务

### 学费计算公式

```
学费       = 新注册学分 × 每学分单价
奖学金减免 = 学费 × 奖学金比例
图书馆费   = BND 50（固定）
校园卡费   = BND 0（免费）
─────────────────────────────────
应付总额   = 学费 - 奖学金减免 + 图书馆费
```

每学分单价来源：

| 学籍类型 | 字段 |
|----------|------|
| 文莱公民（Brunei Darussalam） | `Programme.feeLocalPerCh` |
| 国际生 | `Programme.feeInternationalPerCh` |

发票到期日：注册日起 **14 天**

---

## 5. 错误码与前端提示一览

| HTTP 状态 | 场景 | 前端处理 |
|-----------|------|---------|
| `400` | IC 已录取，禁止申请 | Step 4 页内红色 Alert，含原申请编号 |
| `400` | 先修课程未满足 | Toast 提示，含未满足课程信息 |
| `400` | 时间冲突 | Toast 提示，含冲突课程代码 & 时间段 |
| `400` | 学分超出范围 | Toast 提示，含当前总学分和允许范围 |
| `404` | 学生记录不存在 | Toast 通用错误提示 |
| `500` | 服务端未知错误 | Toast `"Registration failed"` |

> 前端在提交前会进行学分和冲突的客户端预校验（与后端规则一致），大多数错误在提交前即可拦截。

---

## 6. 数据模型关联

```
User (id, role='student')
 └── Student (userId FK, studentId, currentCgpa, studentType, scholarshipPct)
      ├── Enrolment (studentId FK, offeringId FK, status, finalGrade)
      │    └── CourseOffering (lecturerId, courseId, semesterId, dayOfWeek, startTime, endTime, room)
      │         └── Course (code, name, creditHours, prerequisites[])
      ├── FeeInvoice (studentId FK, semesterId, totalAmount, status)
      ├── LibraryAccount (studentId FK, accountNo, isActive)
      └── Applicant (icPassport unique, status, applicationRef)  ← 通过 applicantId 关联
```

### 关键唯一约束

| 表 | 唯一字段 |
|----|----------|
| `Applicant` | `icPassport`（全局唯一，影响重复申请逻辑） |
| `Student` | `studentId`、`userId`、`applicantId` |
| `Enrolment` | `(studentId, offeringId)` 联合唯一 |
| `FeeInvoice` | `invoiceNo` |
| `LibraryAccount` | `studentId` |

---

> 文档由系统自动生成，如有业务规则变更请同步更新本文档。
