# UNISSA 云服务器部署指南

> 适用场景：阿里云 ECS + Docker + 自有域名 + HTTPS

---

## 架构概览

```
Internet
   │
   ▼
Nginx (80/443)
   ├── /          → 前端静态文件（React/Vite 构建产物）
   └── /api/*     → Backend:4000（Express + Prisma）
                         │
                         └── SQLite（Docker 持久化卷）
```

---

## 前置条件

| 条件 | 说明 |
|------|------|
| 阿里云 ECS | Ubuntu 20.04+ 或 CentOS 7+，建议 2核4G 以上 |
| Docker | 已安装 Docker Engine + Docker Compose Plugin |
| 域名 | 已备案，DNS A 记录指向服务器公网 IP |
| SSL 证书 | 阿里云免费 SSL 证书（下载 Nginx 格式） |
| 安全组 | 已开放 **80**、**443**、**22** 端口 |

### 安装 Docker（未安装时执行）

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
# 验证
docker version
docker compose version
```

---

## 部署步骤

### 第一步：上传代码到服务器

**方式 A — Git 克隆（推荐）**

```bash
git clone <你的仓库地址> /opt/unissa
cd /opt/unissa
```

**方式 B — 本地打包上传**

```bash
# 本地执行（排除 node_modules）
tar --exclude='*/node_modules' --exclude='*/.git' \
    -czf unissa.tar.gz UNISSA-POC/

# 上传到服务器
scp unissa.tar.gz root@<服务器IP>:/opt/

# 服务器上解压
ssh root@<服务器IP>
cd /opt && tar -xzf unissa.tar.gz
cd UNISSA-POC
```

---

### 第二步：配置环境变量

```bash
cp .env.production .env.prod
nano .env.prod
```

**必填项：**

```env
# 必须修改为随机强密钥（可用命令生成：openssl rand -hex 32）
JWT_SECRET="your-random-32-char-secret-here"

# 替换为你的实际域名
CORS_ORIGIN="https://your-domain.com"
```

**可选项（按需填写）：**

```env
# AI 功能（在系统后台也可配置）
AI_PROVIDER="openai"
AI_API_KEY="sk-..."
AI_MODEL="gpt-4o"

# 邮件通知
SMTP_HOST="smtp.aliyun.com"
SMTP_PORT="465"
SMTP_USER="noreply@your-domain.com"
SMTP_PASS="your-smtp-password"
```

---

### 第三步：配置 SSL 证书

1. 登录[阿里云 SSL 证书控制台](https://yundun.console.aliyun.com/?p=cas) → **免费证书** → 申请
2. 审核通过后下载，选择 **Nginx** 格式，解压得到 `.pem` 和 `.key` 文件
3. 上传到服务器并重命名：

```bash
mkdir -p nginx/ssl

# 上传后重命名（文件名因证书而异，以实际为准）
cp xxxx.pem  nginx/ssl/fullchain.pem
cp xxxx.key  nginx/ssl/privkey.pem

# 设置权限
chmod 600 nginx/ssl/privkey.pem
```

---

### 第四步：修改域名配置

将 `nginx/nginx.conf` 中的 `your-domain.com` 替换为实际域名：

```bash
# 批量替换（把 unissa.example.com 改为你的域名）
sed -i 's/your-domain.com/unissa.example.com/g' nginx/nginx.conf

# 验证替换结果
grep server_name nginx/nginx.conf
```

---

### 第五步：执行部署

```bash
# 赋予执行权限
chmod +x deploy.sh

# 一键部署
bash deploy.sh
```

脚本会自动：
- 检查配置文件和证书是否就绪
- 构建 Docker 镜像（首次约 3~5 分钟）
- 运行数据库迁移
- 启动所有服务并打印访问地址

**部署成功后访问：**

```
https://your-domain.com
```

默认管理员账号请参考 [USER_GUIDE.md](../USER_GUIDE.md)。

---

## 运维命令速查

```bash
# 查看所有服务状态
docker compose ps

# 实时查看日志
docker compose logs -f
docker compose logs -f backend    # 仅后端
docker compose logs -f nginx      # 仅 nginx

# 重启服务
docker compose restart
docker compose restart backend

# 停止 / 启动
docker compose down
docker compose up -d

# 更新代码后重新部署
git pull && bash deploy.sh
```

---

## 数据备份

SQLite 数据库存储在 Docker named volume `unissa_db_data` 中：

```bash
# 备份数据库到本地文件
docker run --rm \
  -v unissa_db_data:/data \
  -v $(pwd):/backup \
  alpine tar -czf /backup/db-backup-$(date +%Y%m%d).tar.gz /data

# 恢复数据库
docker run --rm \
  -v unissa_db_data:/data \
  -v $(pwd):/backup \
  alpine tar -xzf /backup/db-backup-20260325.tar.gz -C /
```

---

## 常见问题

### 端口已被占用

```bash
# 查看占用 80/443 端口的进程
lsof -i :80
lsof -i :443
# 停止冲突服务（如系统自带 nginx）
systemctl stop nginx
systemctl disable nginx
```

### 前端访问正常但 API 报错

```bash
# 检查后端日志
docker compose logs backend
# 检查后端健康状态
curl http://localhost:4000/api/v1/health
```

### SSL 证书报错

- 确认 `nginx/ssl/fullchain.pem` 和 `privkey.pem` 文件名正确
- 确认证书未过期（阿里云免费证书有效期 1 年）
- 证书到期续签后重新上传，执行 `docker compose restart nginx`

### 暂时不用 HTTPS（仅 HTTP）

编辑 `nginx/nginx.conf`，注释掉 443 server 块，仅保留 80 的配置并去掉跳转：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    # 其余配置保持不变...
}
```

然后重新构建：`docker compose build nginx && docker compose up -d nginx`

---

## 部署注意事项与故障排除

> 本节记录线上部署过程中遇到的常见问题及解决方案，持续更新。

### 1. 上传文件（图片/附件）无法显示

**症状**：
- 用户上传作业附件后，图片无法在前端显示
- 浏览器控制台显示 `/uploads/xxx` 路径 404 错误

**原因**：
- Nginx 配置缺少 `/uploads` 静态文件路径
- Nginx 容器未挂载上传文件存储卷

**解决方案**：

1. **检查 docker-compose.yml 是否挂载了上传目录**：

```yaml
# nginx 服务需要挂载 uploads_data 卷
nginx:
  volumes:
    - uploads_data:/app/uploads:ro  # 必须添加此挂载
```

2. **检查 nginx.conf 是否配置了静态文件服务**：

```nginx
# 在 server 块中添加
location /uploads/ {
    alias /app/uploads/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

3. **重新部署**：

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

4. **验证文件访问**：

```bash
# 查看上传目录是否有文件
docker exec unissa-backend ls -la /app/uploads/submissions/

# 直接访问测试
curl -I https://your-domain.com/uploads/submissions/test.jpg
```

**预防措施**：
- 部署前检查 `docker-compose.yml` 中的 volumes 配置
- 部署后测试文件上传功能，确保图片可正常显示

---

### 2. 数据库迁移后数据丢失

**症状**：
- 重新部署后，之前的数据消失
- 用户无法登录，提示用户不存在

**原因**：
- SQLite 数据库文件未持久化到 Docker 卷
- 执行了 `docker-compose down -v` 删除了数据卷

**解决方案**：

1. **确保使用 named volumes**：

```yaml
volumes:
  db_data:
    name: unissa_db_data  # 命名卷，不会轻易被删除
```

2. **定期备份数据库**：

```bash
# 备份
docker run --rm \
  -v unissa_db_data:/data \
  -v $(pwd):/backup \
  alpine tar -czf /backup/db-backup-$(date +%Y%m%d).tar.gz /data

# 恢复
docker run --rm \
  -v unissa_db_data:/data \
  -v $(pwd):/backup \
  alpine tar -xzf /backup/db-backup-20260325.tar.gz -C /
```

**预防措施**：
- 禁止使用 `docker-compose down -v`（会删除卷）
- 部署前先备份数据库
- 生产环境考虑使用 PostgreSQL/MySQL 替代 SQLite

---

### 3. 前端页面空白或 API 请求失败

**症状**：
- 页面加载空白
- 控制台显示 CORS 错误或 API 500 错误

**排查步骤**：

```bash
# 1. 检查后端服务状态
docker compose ps
docker compose logs backend --tail 100

# 2. 检查后端健康状态
curl http://localhost:4000/api/v1/health

# 3. 检查环境变量配置
docker exec unissa-backend env | grep -E "JWT_SECRET|CORS_ORIGIN|DATABASE_URL"

# 4. 检查 Nginx 代理配置
docker exec unissa-nginx cat /etc/nginx/conf.d/default.conf | grep -A5 "/api"
```

**常见原因**：
- `JWT_SECRET` 未配置或配置错误
- `CORS_ORIGIN` 与实际域名不匹配
- 数据库文件权限问题

---

### 4. Docker 镜像构建失败

**症状**：
- `docker-compose build` 报错
- npm install 失败或超时

**解决方案**：

```bash
# 清理 Docker 缓存重新构建
docker-compose build --no-cache

# 如果是网络问题，配置 Docker 镜像加速
# 编辑 /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://registry.docker-cn.com"
  ]
}
systemctl restart docker
```

---

### 5. SSL 证书问题

**症状**：
- 浏览器提示证书无效或过期
- HTTPS 无法访问

**解决方案**：

```bash
# 检查证书文件
ls -la nginx/ssl/
# 应该有 fullchain.pem 和 privkey.pem

# 检查证书有效期
openssl x509 -in nginx/ssl/fullchain.pem -noout -dates

# 证书续签后重启 Nginx
docker compose restart nginx
```

---

## 故障排除检查清单

部署完成后，按以下清单逐一验证：

| 检查项 | 命令/操作 | 预期结果 |
|--------|----------|----------|
| 后端健康检查 | `curl https://域名/api/v1/health` | 返回 `{"status":"ok"}` |
| 前端页面加载 | 浏览器访问首页 | 页面正常显示，无 JS 错误 |
| 用户登录 | 使用测试账号登录 | 登录成功，跳转到仪表盘 |
| 文件上传 | 上传一张图片 | 图片能正常显示 |
| API 请求 | 查看任意数据列表 | 数据正常加载 |
| HTTPS | 浏览器地址栏 | 显示锁图标，无证书警告 |

---

## 文件清单

```
UNISSA-POC/
├── docker-compose.yml          # 服务编排
├── deploy.sh                   # 一键部署脚本
├── .env.production             # 环境变量模板（提交到 Git）
├── .env.prod                   # 实际配置（不提交到 Git）
├── backend/
│   ├── Dockerfile
│   └── docker-entrypoint.sh   # 启动前自动执行数据库迁移
├── frontend/
│   └── Dockerfile
└── nginx/
    ├── Dockerfile              # 多阶段：编译前端 + nginx
    ├── nginx.conf              # 反向代理 + SSL + 缓存配置
    └── ssl/                    # SSL 证书目录（不提交到 Git）
        ├── fullchain.pem
        └── privkey.pem
```
