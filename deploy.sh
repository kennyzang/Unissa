#!/bin/bash
# ============================================================
# UNISSA 一键部署脚本（在云服务器上执行）
# 用法：bash deploy.sh
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------- 检查前置条件 ----------
command -v docker   >/dev/null 2>&1 || error "未安装 Docker，请先安装"
command -v docker   >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || \
  error "未安装 Docker Compose Plugin，请执行: apt install docker-compose-plugin"

# ---------- 检查配置文件 ----------
if [ ! -f ".env.prod" ]; then
  warn ".env.prod 不存在，从模板复制..."
  cp .env.production .env.prod
  warn "请编辑 .env.prod 填写真实配置后重新运行此脚本"
  exit 1
fi

# ---------- 检查 SSL 证书 ----------
if [ ! -f "nginx/ssl/fullchain.pem" ] || [ ! -f "nginx/ssl/privkey.pem" ]; then
  warn "SSL 证书未找到，跳过 HTTPS 配置。"
  warn "请将证书文件放到 nginx/ssl/ 目录："
  warn "  nginx/ssl/fullchain.pem"
  warn "  nginx/ssl/privkey.pem"
  warn "（阿里云免费 SSL 证书下载后重命名即可）"
  warn "若暂时使用 HTTP，请编辑 nginx/nginx.conf 注释掉 443 server 块"
fi

# ---------- 构建并启动 ----------
info "构建镜像中（首次构建需要几分钟）..."
docker compose build --no-cache

info "启动服务..."
docker compose up -d

info "等待服务健康检查..."
sleep 5
docker compose ps

info "============================================"
info "UNISSA 部署完成！"
info "  HTTP:  http://$(curl -s ifconfig.me)"
info "  HTTPS: https://your-domain.com（配置 SSL 后）"
info ""
info "常用命令："
info "  查看日志:  docker compose logs -f"
info "  重启服务:  docker compose restart"
info "  停止服务:  docker compose down"
info "  更新部署:  git pull && bash deploy.sh"
info "============================================"
