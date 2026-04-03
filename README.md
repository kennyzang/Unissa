# UNISSA Smart University Platform

UNISSA（文莱伊斯兰大学）智慧校园平台 - 全栈概念验证项目

一个现代化的大学管理系统，涵盖招生、学籍管理、课程注册、财务管理、人力资源、研究项目、校园设施、学习管理系统（LMS）等核心功能模块。

## 功能特性

### 核心模块

- **招生管理**：在线申请、自动审核、录取通知、 offer 信生成
- **学生门户**：个人信息、成绩单、课程注册、学费缴纳
- **课程管理**：课程开设、选课注册、时间冲突检测、学分管理
- **财务管理**：学费发票、支付记录、财务报表、预算管理
- **人力资源**：员工管理、请假审批、入职流程、薪资管理
- **研究项目**：科研经费申请、审批流程、进度跟踪
- **校园设施**：场地预订、设备管理、维护工单
- **学习管理系统（LMS）**：课程学习、作业提交、成绩管理、考勤打卡
- **AI 助手**：智能问答、风险预警、采购异常检测

### 技术亮点

- 多语言支持（英语、马来语、中文）
- 响应式设计，支持移动端访问
- 二维码扫码考勤
- AI 驱动的智能分析和预警
- 完整的测试覆盖（单元测试、集成测试）

## 技术栈

### 后端
- **框架**: Express.js + TypeScript
- **数据库**: SQLite + Prisma ORM
- **认证**: JWT (JSON Web Tokens)
- **AI 集成**: Deepseek API
- **文档**: Swagger/OpenAPI

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **状态管理**: Zustand
- **数据获取**: TanStack Query (React Query)
- **UI 组件**: Ant Design + Tremor
- **样式**: SCSS + CSS Modules
- **国际化**: i18next

## 环境准备

### 系统要求

- **操作系统**: macOS, Linux, 或 Windows (WSL2 推荐)
- **Node.js**: >= 20.0.0 (推荐使用 nvm 管理)
- **包管理器**: Yarn 1.22.x 或更高版本
- **Git**: 任意版本

### 推荐工具

- **Node 版本管理**: [nvm](https://github.com/nvm-sh/nvm) (macOS/Linux) 或 [nvm-windows](https://github.com/coreybutler/nvm-windows)
- **IDE**: VS Code (推荐安装 ESLint, Prettier, TypeScript 插件)
- **API 测试**: Postman 或 curl
- **数据库查看**: Prisma Studio (内置)

### 安装 Node.js 20

```bash
# 使用 nvm 安装 Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# 验证安装
node -v  # 应显示 v20.x.x
npm -v
```

### 安装 Yarn

```bash
# 使用 npm 安装 Yarn 1.x
npm install -g yarn@1.22.22

# 验证安装
yarn -v  # 应显示 1.22.22
```

## 项目启动

### 1. 克隆项目

```bash
git clone <repository-url>
cd unissa-poc
```

### 2. 安装依赖

```bash
# 安装根目录依赖（ concurrently 用于同时运行前后端）
yarn install

# 或者分别安装
yarn install
```

### 3. 配置环境变量

```bash
# 后端环境配置
cd backend

# 创建 .env 文件（参考已有配置）
cp .env .env.local

# 编辑 .env 文件，根据需要修改以下配置
# - DATABASE_URL: 数据库文件路径（建议每个开发者使用不同的文件名）
# - AI_API_KEY: Deepseek API 密钥（可选）
# - SMTP 配置：邮件服务（可选）
```

**重要**: 为避免多人协作时的数据库冲突，建议每个开发者使用不同的数据库文件名：

```env
# .env 示例
DATABASE_URL="file:./dev-yourname.db"  # 例如: dev-alice.db, dev-bob.db
```

### 4. 初始化数据库

```bash
# 运行数据库迁移
yarn db:migrate

# 填充初始数据（演示账号、课程、学生数据等）
yarn seed
```

### 5. 启动开发服务器

```bash
# 同时启动前端和后端（推荐）
yarn dev

# 或者分别启动
# 终端 1: 启动后端
cd backend
yarn dev

# 终端 2: 启动前端
cd frontend
yarn dev
```

启动成功后：
- **前端**: http://localhost:5173
- **后端 API**: http://localhost:4000
- **API 文档**: http://localhost:4000/api-docs
- **健康检查**: http://localhost:4000/health

### 6. 访问系统

使用以下演示账号登录：

| 账号 | 密码 | 角色 | 用途 |
|------|------|------|------|
| noor | Demo@2026 | 学生 | 学生门户（完整注册学生） |
| zara | Demo@2026 | 学生 | 场景1演示：申请入学 |
| admissions | Demo@2026 | 招生官 | 招生仪表板 |
| drsiti | Demo@2026 | 讲师 | LMS 讲师端 |
| manager | Demo@2026 | 部门经理 | 审批收件箱 |
| finance | Demo@2026 | 财务官 | 财务仪表板 |
| admin | Demo@2026 | 管理员 | 命令中心 |

## 项目结构

```
unissa-poc/
├── backend/                    # 后端服务
│   ├── prisma/                 # 数据库模型和迁移
│   │   ├── schema.prisma       # 数据库模型定义
│   │   ├── seed.ts             # 初始数据脚本
│   │   └── migrations/         # 数据库迁移文件
│   ├── src/
│   │   ├── routes/             # API 路由
│   │   ├── middleware/         # 中间件（认证、错误处理）
│   │   ├── services/           # 业务逻辑服务
│   │   ├── lib/                # 工具库
│   │   └── index.ts            # 入口文件
│   ├── package.json
│   └── .env                    # 环境变量（不提交到 Git）
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   ├── components/         # 可复用组件
│   │   ├── layouts/            # 布局组件
│   │   ├── stores/             # 状态管理
│   │   ├── locales/            # 国际化文件
│   │   ├── lib/                # 工具库
│   │   └── styles/             # 全局样式
│   ├── package.json
│   └── vite.config.ts
│
├── doc/                        # 项目文档
├── docker-compose.yml          # Docker 部署配置
├── deploy.sh                   # 一键部署脚本
└── README.md                   # 本文件
```

## 配置说明

### 后端配置 (.env)

| 配置项 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| DATABASE_URL | SQLite 数据库文件路径 | file:./dev.db | 是 |
| JWT_SECRET | JWT 签名密钥 | your-secret-key | 是（生产环境必须修改） |
| JWT_EXPIRES_IN | JWT 过期时间 | 7d | 否 |
| PORT | 后端服务端口 | 4000 | 否 |
| NODE_ENV | 运行环境 | development | 否 |
| AI_API_KEY | Deepseek API 密钥 | - | 否（AI功能需要） |
| AI_BASE_URL | AI API 基础 URL | https://api.deepseek.com/v1 | 否 |
| AI_MODEL | AI 模型 | deepseek-chat | 否 |
| SMTP_HOST | 邮件服务器地址 | smtp.gmail.com | 否 |
| SMTP_PORT | 邮件服务器端口 | 587 | 否 |
| SMTP_USER | 邮件账号 | - | 否 |
| SMTP_PASS | 邮件密码 | - | 否 |
| UPLOAD_DIR | 文件上传目录 | ./uploads | 否 |
| MAX_FILE_SIZE | 最大上传文件大小 | 5242880 (5MB) | 否 |

### 前端配置

前端配置位于 `frontend/vite.config.ts`，主要包括：
- 开发服务器端口和代理设置
- 构建输出目录
- PWA 配置

### 数据库模型

数据库模型定义在 `backend/prisma/schema.prisma`，主要实体包括：
- User（用户）
- Student（学生）
- Staff（教职工）
- Applicant（申请人）
- Course（课程）
- Programme（专业）
- Department（院系）
- FeeInvoice（费用发票）
- ResearchGrant（研究经费）
- LeaveRequest（请假申请）
- 等等...

## 常用命令

### 开发命令

```bash
# 同时启动前后端（根目录）
yarn dev

# 仅启动后端
cd backend && yarn dev

# 仅启动前端
cd frontend && yarn dev
```

### 数据库命令

```bash
# 重置数据库（清空并重新填充数据）
yarn db:reset

# 运行数据库迁移
yarn db:migrate

# 填充初始数据
yarn seed

# 打开数据库管理界面
yarn db:studio

# 生成 Prisma Client
yarn db:generate
```

### 测试命令

```bash
# 运行后端测试
cd backend && yarn test

# 运行前端测试
cd frontend && yarn test
```

### 构建命令

```bash
# 构建生产版本
yarn build

# 预览生产构建
yarn preview
```

## 生产环境部署

### 使用 Docker 部署（推荐）

1. **准备配置文件**

```bash
# 复制生产环境配置模板
cp .env.production .env.prod

# 编辑 .env.prod，填写真实配置
# - 数据库路径
# - JWT 密钥（必须修改为强密码）
# - AI API 密钥
# - SMTP 配置
# - SSL 证书路径
```

2. **准备 SSL 证书**

将 SSL 证书文件放入 `nginx/ssl/` 目录：
- `fullchain.pem` - 证书链
- `privkey.pem` - 私钥

3. **执行部署脚本**

```bash
bash deploy.sh
```

部署脚本会自动：
- 检查 Docker 和 Docker Compose 安装
- 验证配置文件
- 构建 Docker 镜像
- 启动服务
- 执行健康检查

### 手动部署

```bash
# 构建镜像
docker compose build

# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

## 常见问题

### 1. 数据库冲突（多人协作）

**问题**: 多人协作时 `dev.db` 文件冲突

**解决方案**:
- 每个开发者使用不同的数据库文件名（如 `dev-alice.db`, `dev-bob.db`）
- 确保 `.gitignore` 中已忽略 `*.db` 文件
- 不要提交数据库文件到 Git

### 2. Node.js 版本不兼容

**问题**: 启动时出现版本错误

**解决方案**:
```bash
# 使用 nvm 切换到正确版本
nvm use 20

# 如果未安装，先安装
nvm install 20
```

### 3. 依赖安装失败

**问题**: `yarn install` 失败

**解决方案**:
```bash
# 清除缓存
yarn cache clean

# 删除 node_modules 重新安装
rm -rf node_modules yarn.lock
yarn install
```

### 4. 数据库初始化失败

**问题**: 运行 `yarn seed` 时出错

**解决方案**:
```bash
# 重置数据库
yarn db:reset

# 如果仍失败，手动删除数据库文件后重试
rm backend/dev.db
yarn db:migrate
yarn seed
```

### 5. 端口被占用

**问题**: 启动时提示端口 4000 或 5173 被占用

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :4000

# 终止进程
kill -9 <PID>

# 或者修改 .env 中的 PORT 配置
```

### 6. API 请求失败

**问题**: 前端无法连接到后端

**解决方案**:
- 确认后端服务已启动
- 检查 `frontend/vite.config.ts` 中的代理配置
- 检查浏览器控制台网络请求

## 开发规范

### Git 工作流

1. **分支命名**:
   - 功能分支: `feature/功能名称`
   - 修复分支: `fix/问题描述`
   - 热修复: `hotfix/问题描述`

2. **提交信息**:
   - 使用中文或英文描述
   - 格式: `[类型] 描述`
   - 类型: feat, fix, docs, style, refactor, test, chore

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 组件使用函数式组件 + Hooks
- 样式使用 CSS Modules

### 测试要求

- 新功能需包含单元测试
- 关键业务逻辑需包含集成测试
- 提交前确保所有测试通过

## 文档

- [API 文档](http://localhost:4000/api-docs)（启动后端后访问）
- [部署文档](./doc/DEPLOY.md)
- [用户指南](./USER_GUIDE.md)
- [学生生命周期文档](./doc/student-lifecycle.md)
- [验证规则文档](./doc/validation-rules.md)

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m '[feat] 添加某个功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

[MIT](LICENSE)

## 联系方式

如有问题或建议，请通过以下方式联系：
- 项目 Issues
- 邮件: [your-email@example.com]

---

**注意**: 本项目为概念验证（POC）版本，仅供演示和学习使用。生产环境部署前请进行充分的安全审查和性能测试。
