# API 文档：HR 模块

Base URL: `/api/v1/hr`

所有接口需携带 JWT Token（`Authorization: Bearer <token>`）。

---

## 员工管理

### GET `/staff`

获取全部员工列表。

**权限：** `manager` / `admin` / `hradmin`

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "staffId": "STF-001",
      "fullName": "Dr. Siti Aminah",
      "designation": "Senior Lecturer",
      "status": "active",
      "user": { "displayName": "Dr. Siti", "email": "drsiti@unissa.edu.bn", "isActive": true },
      "department": { "name": "IT & Networks", "code": "IFN" }
    }
  ]
}
```

---

### GET `/staff/:id`

获取单个员工详情（支持数据库 `id` 或员工编号 `staffId`）。

**权限：** `manager` / `admin` / `hradmin`

**响应包含：**
- 用户信息（含最后登录时间）
- 所属部门完整信息
- 最近 5 条请假记录
- 最近 3 条薪资记录

---

### GET `/stats`

获取 HR 统计数据。

**权限：** `manager` / `admin` / `hradmin`

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total": 12,
    "active": 11,
    "onLeave": 2,
    "departments": [
      { "name": "IT & Networks", "_count": { "staff": 4 } }
    ]
  }
}
```

---

## 请假管理

### GET `/leave`

获取请假记录。

**权限：** 所有非学生角色

**逻辑：**
- 普通员工（`lecturer` 等）：只能查看自己的请假记录
- `manager` / `admin` / `hradmin`：可查看全部记录

---

### POST `/leave`

提交请假申请。

**权限：** 所有非学生角色（需有对应 Staff 记录）

**请求体：**
```json
{
  "leaveType": "annual",
  "startDate": "2026-04-01",
  "endDate": "2026-04-03",
  "reason": "Family trip",
  "coveringOfficerId": "STF-002"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `leaveType` | string | ✅ | `annual` / `medical` / `unpaid` |
| `startDate` | string | ✅ | ISO 日期 |
| `endDate` | string | ✅ | ISO 日期，需晚于 startDate |
| `reason` | string | ✅ | 请假原因 |
| `coveringOfficerId` | string | | 代班员工 ID |

**余额校验：**
- `annual` 类型：检查 `leaveBalanceAnnual`
- `medical` 类型：检查 `leaveBalanceMedical`
- `unpaid` 类型：不校验余额

**错误响应示例：**
```json
{ "success": false, "message": "Insufficient leave balance. Available: 5 days, Requested: 8 days" }
```

---

### PATCH `/leave/:id/approve`

审批（通过 / 拒绝）请假申请。

**权限：** `manager` / `admin` / `hradmin`

**请求体：**
```json
{
  "action": "approved",
  "remarks": "Approved by department head"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | ✅ | `approved` / `rejected` |
| `remarks` | string | | 备注（拒绝时建议填写） |

**审批后自动操作：**
- `approved`：自动扣减对应假期余额（`unpaid` 不扣）
- 记录审批人 ID 和审批时间（`l1ApproverId` / `l1ActedAt`）

---

## 薪资管理

### GET `/payroll`

获取薪资记录（最近 50 条）。

**权限：** `admin` / `finance`

**响应包含：** 员工姓名、部门、薪资月份及详细薪资数据。

---

## 权限汇总

| 接口 | student | lecturer | manager | admin | hradmin | finance |
|------|:-------:|:--------:|:-------:|:-----:|:-------:|:-------:|
| GET /staff | ✗ | ✗ | ✅ | ✅ | ✅ | ✗ |
| GET /staff/:id | ✗ | ✗ | ✅ | ✅ | ✅ | ✗ |
| GET /stats | ✗ | ✗ | ✅ | ✅ | ✅ | ✗ |
| GET /leave | ✗ | 仅自己 | 全部 | 全部 | 全部 | 仅自己 |
| POST /leave | ✗ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PATCH /leave/:id/approve | ✗ | ✗ | ✅ | ✅ | ✅ | ✗ |
| GET /payroll | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ |
