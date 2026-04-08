# Purchase Requests 工作流程演示文档

## 概述

本文档详细介绍UNISSA系统中Purchase Requests（采购申请）的完整工作流程，特别是如何触发`Converted to PO`（已转为采购订单）状态。

## 工作流程状态

Purchase Requests包含以下状态：

1. **submitted** - 已提交
2. **dept_approved** - 部门已批准
3. **finance_approved** - 财务已批准
4. **rector_approved** - 校长已批准
5. **converted_to_po** - 已转为采购订单
6. **rejected** - 已拒绝

## 流程说明

### 1. 创建采购申请

- 角色：manager或admin
- 操作：填写物品描述、数量、单价、GL代码等信息
- 状态：从`draft`变为`submitted`

### 2. 部门审批

- 角色：manager
- 操作：在审批收件箱中批准或拒绝申请
- 状态：批准后变为`dept_approved`，拒绝后变为`rejected`

### 3. 财务审批

- 角色：finance
- 操作：在审批收件箱中批准或拒绝申请
- 状态：批准后变为`finance_approved`，拒绝后变为`rejected`

### 4. 触发 Converted to PO 状态

**这是本文档的重点**

有两种方式可以触发`Converted to PO`状态：

#### 方式一：自动转换（金额小于500 BND）

- 当PR总金额小于500 BND时，财务批准后会自动转换为PO
- 条件：
  - PR状态为`finance_approved`
  - 总金额 < 500 BND
  - 已设置推荐供应商（recommendedVendor）

#### 方式二：手动生成PO（所有金额）

- 角色：admin
- 操作：
  1. 进入PR详情页面
  2. 点击"Generate PO"按钮
  3. 系统会自动生成PO并更新PR状态
- 条件：
  - PR状态为`finance_approved`
  - 用户角色为`admin`

## 如何使用手动生成PO功能

### 步骤1：登录系统

使用admin账号登录系统：
- 用户名：admin
- 密码：Demo@2026

### 步骤2：进入采购申请页面

- 导航到"Procurement"模块
- 点击"Purchase Requests"菜单

### 步骤3：找到需要生成PO的PR

- 在PR列表中找到状态为`Finance Approved`的PR
- 点击"View"按钮进入详情页面

### 步骤4：生成PO

- 在PR详情页面底部，点击"Generate PO"按钮
- 系统会自动生成PO并更新PR状态为`Converted to PO`

### 步骤5：验证状态变更

- 关闭详情页面
- 刷新PR列表
- 确认该PR的状态已变为`Converted to PO`

## 技术实现说明

### 后端API

- **生成PO API**：`PATCH /api/v1/procurement/pr/:id/generate-po`
- **权限**：仅admin角色可访问
- **功能**：
  1. 验证PR状态为`finance_approved`
  2. 解析供应商信息（使用推荐供应商或最低报价供应商）
  3. 创建PO记录
  4. 更新PR状态为`converted_to_po`
  5. 提交GL预算

### 前端实现

- 在`ProcurementPRPage.tsx`中添加了：
  1. `generatePOMutation`用于调用后端API
  2. 条件显示"Generate PO"按钮（仅admin且PR状态为finance_approved时显示）

## 常见问题

### Q: 为什么我看不到"Generate PO"按钮？

A: 请检查：
1. 您是否使用admin账号登录
2. PR状态是否为`Finance Approved`

### Q: 点击"Generate PO"按钮后没有反应？

A: 可能的原因：
1. 没有可用的供应商
2. 网络连接问题
3. 系统错误

### Q: 生成PO后，PR状态没有更新？

A: 请刷新页面查看最新状态。如果仍然没有更新，请联系系统管理员。

## 总结

通过本文档的说明，您应该能够：
1. 了解Purchase Requests的完整工作流程
2. 知道如何触发`Converted to PO`状态
3. 掌握手动生成PO的操作步骤

此功能确保了采购流程的完整性，使财务和管理人员能够有效地跟踪和管理采购申请。