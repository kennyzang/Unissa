# LMS评分系统 - 学生成绩更新机制说明

## 问题描述

老师确认评分后，学生的成绩没有立即更新。需要了解触发My Grades更新的具体场景和机制。

## 系统分析

### 后端评分流程

当老师确认评分时，后端会执行以下操作：

1. **更新Submission记录**
   - 保存老师的评分（instructorScores）
   - 保存最终成绩（finalMarks）
   - 记录评分时间和评分人

2. **计算成绩等级**
   - 根据finalMarks计算成绩等级（A+, A, B+, B, C+, C, D, F）
   - 计算对应的绩点（gradePoints）

3. **更新Enrolment记录**
   - 将最终成绩和绩点保存到学生选课记录中

4. **计算并更新GPA**
   - 查询该学生所有已评分的课程
   - 计算总绩点和总学分
   - 更新学生的当前GPA

5. **创建通知**
   - 为学生创建成绩更新通知

### 前端数据刷新机制

学生查看成绩的页面使用React Query进行数据管理：

1. **查询键（Query Key）**
   - `['submissions', 'history', offeringId, studentId]`
   - 这个查询键用于获取学生的提交历史

2. **缓存失效（Cache Invalidation）**
   - 老师确认评分后，前端会失效以下查询：
     - `['lms', 'submissions', 'lecturer', userId]`
     - `['submissions', 'all']`
     - `['submissions', 'history']`
     - `['submissions']`

## 问题原因

### 主要问题

**查询键不匹配**：前端学生页面使用的查询键与老师评分后失效的查询键不完全匹配。

- 学生页面使用：`['submissions', 'history', offeringId, studentId]`
- 老师评分后失效：`['submissions', 'history']`

由于查询键不匹配，React Query无法正确识别需要重新获取数据。

### 解决方案

已在`LmsGradingPage.tsx`中添加了通用的查询失效：

```typescript
qc.invalidateQueries({ queryKey: ['submissions'] })
```

这个通用的查询失效会匹配所有以`submissions`开头的查询键，确保学生页面的数据能够及时更新。

## 触发My Grades更新的场景

### 自动触发场景

1. **老师确认评分后**
   - 老师在评分页面点击"Confirm Grade"按钮
   - 系统自动失效相关查询缓存
   - 学生页面自动重新获取最新数据

2. **老师接受AI评分后**
   - 老师在评分页面点击"Accept All AI Scores"按钮
   - 系统自动失效相关查询缓存
   - 学生页面自动重新获取最新数据

### 手动触发场景

如果自动刷新没有生效，学生可以通过以下方式手动刷新：

1. **刷新页面**
   - 按F5或点击浏览器的刷新按钮
   - 重新加载页面会获取最新数据

2. **切换标签页**
   - 在LMS课程详情页面切换不同的标签页
   - 切换回"Progress"标签时会重新获取数据

## 技术实现细节

### 后端API

**评分API**：`PATCH /api/v1/lms/submissions/:id/grade`

**请求参数**：
```json
{
  "instructorScores": [
    {
      "criterion": "Clarity",
      "ai_score": 8,
      "ai_comment": "Good explanation",
      "instructor_score": 9,
      "instructor_comment": "Excellent work"
    }
  ],
  "finalMarks": 85
}
```

**响应数据**：
```json
{
  "success": true,
  "data": {
    "submission": {...},
    "grade": "A",
    "gradePoints": 4.0,
    "currentGpa": 3.85
  },
  "message": "Grade confirmed and GPA updated"
}
```

### 前端实现

**查询定义**：
```typescript
const { data: submissionHistory = [] } = useQuery<Submission[]>({
  queryKey: ['submissions', 'history', offeringId, studentProfile?.id],
  queryFn: async () => {
    const { data } = await apiClient.get(`/lms/submissions/history/${offeringId}/${studentProfile!.id}`)
    return data.data ?? []
  },
  enabled: !!studentProfile?.id && !!offeringId,
})
```

**缓存失效**：
```typescript
qc.invalidateQueries({ queryKey: ['submissions'] })
```

## 验证步骤

### 老师操作

1. 登录系统（使用drsiti账号）
2. 进入LMS模块
3. 选择课程并进入评分页面
4. 查看待评分的学生提交
5. 点击"View"查看学生提交内容
6. 调整评分（如需要）
7. 点击"Confirm Grade"确认评分

### 学生操作

1. 登录系统（使用学生账号）
2. 进入LMS模块
3. 选择已评分的课程
4. 查看"Progress"标签页
5. 确认成绩已更新

## 常见问题

### Q: 老师确认评分后，学生页面没有立即更新？

A: 请检查：
1. 网络连接是否正常
2. 浏览器是否禁用了缓存
3. 尝试手动刷新页面

### Q: 学生看到的成绩与老师评分不一致？

A: 可能的原因：
1. 缓存未及时更新，尝试刷新页面
2. 系统延迟，等待几分钟后重试
3. 检查是否有多个提交记录

### Q: GPA计算不正确？

A: 系统会根据所有已评分的课程计算GPA：
- A+ / A: 4.0
- B+: 3.67
- B: 3.33
- C+: 3.0
- C: 2.67
- D: 2.0
- F: 0.0

## 总结

通过本次修复，老师确认评分后，学生的成绩会自动更新。主要改进包括：

1. 添加了通用的查询失效机制
2. 确保所有相关查询缓存都能正确刷新
3. 提供了手动刷新的备选方案

现在学生可以及时看到老师确认的最新成绩，无需手动刷新页面。