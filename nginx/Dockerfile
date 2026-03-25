# ============================================================
# UNISSA Nginx – 多阶段构建
# 1. 构建前端静态文件
# 2. 复制到 nginx:alpine 镜像
# ============================================================

# ---- 前端构建 ----
FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY frontend/package.json ./
RUN npm install

COPY frontend/ .
RUN npm run build

# ---- Nginx 镜像 ----
FROM nginx:alpine

# 复制前端产物
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# 删除默认配置
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 80 443
