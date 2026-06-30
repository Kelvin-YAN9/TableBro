#!/bin/bash

# ============================================
# 钉钉机器人 AI 网关 - 生产环境部署脚本
# ============================================
# 使用方法: bash scripts/deploy.sh
# 功能: 自动构建、配置PM2守护进程、设置开机自启

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="TableBro"
APP_NAME="dingtalk-bot-gateway"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 环境检查
check_environment() {
    log_info "检查环境..."

    # 检查 Node.js
    if ! command_exists node; then
        log_error "Node.js 未安装，请先安装 Node.js >= 18"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 版本过低，当前版本: $(node -v)，要求: >= 18"
        exit 1
    fi
    log_success "Node.js 版本: $(node -v)"

    # 检查 .env 文件
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_error ".env 文件不存在，请先复制 .env.example 并配置环境变量"
        log_info "执行: cp .env.example .env"
        log_info "然后编辑 .env 文件，填入实际配置"
        exit 1
    fi
    log_success ".env 配置文件已存在"

    # 检查 PM2
    if ! command_exists pm2; then
        log_warn "PM2 未安装，正在安装..."
        npm install -g pm2
        log_success "PM2 安装成功"
    else
        log_success "PM2 版本: $(pm2 -v)"
    fi
}

# 构建项目
build_project() {
    log_info "开始构建项目..."

    cd "$PROJECT_ROOT"

    # 安装依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装依赖..."
        npm install
    else
        log_info "依赖已存在，跳过安装"
    fi

    # 构建 TypeScript
    log_info "编译 TypeScript..."
    npm run build

    if [ ! -d "dist" ]; then
        log_error "构建失败，dist 目录不存在"
        exit 1
    fi

    log_success "项目构建完成"
}

# PM2 部署
deploy_pm2() {
    log_info "配置 PM2 守护进程..."

    cd "$PROJECT_ROOT"

    # 检查是否已有运行的实例
    if pm2 list | grep -q "$APP_NAME"; then
        log_warn "检测到已运行的实例，先停止并删除..."
        pm2 delete "$APP_NAME" || true
        sleep 2
    fi

    # 启动应用
    pm2 start dist/index.js \
        --name "$APP_NAME" \
        --max-memory-restart 500M \
        --merge-logs \
        --log-date-format "YYYY-MM-DD HH:mm:ss Z"

    log_success "应用已启动"

    # 显示状态
    pm2 status

    # 保存 PM2 进程列表
    pm2 save
    log_success "PM2 进程列表已保存"
}

# 配置开机自启
setup_autostart() {
    log_info "配置开机自启..."

    # 检查是否已配置
    if [ -f "/etc/systemd/system/pm2-root.service" ] || [ -f "/etc/systemd/system/pm2-$USER.service" ]; then
        log_warn "PM2 自启服务已存在"
    else
        pm2 startup
        log_success "请按提示执行上述命令以完成自启配置"
    fi
}

# 健康检查
health_check() {
    log_info "进行健康检查..."

    sleep 3

    if pm2 list | grep "$APP_NAME" | grep -q "online"; then
        log_success "应用运行状态正常"

        # 显示日志（最近20行）
        echo ""
        log_info "最近日志:"
        pm2 logs "$APP_NAME" --nostream --lines 20

        echo ""
        log_success "部署完成！"
        echo ""
        log_info "常用命令:"
        echo "  查看状态: pm2 status"
        echo "  查看日志: pm2 logs $APP_NAME"
        echo "  重启应用: pm2 restart $APP_NAME"
        echo "  停止应用: pm2 stop $APP_NAME"
        echo "  查看详情: pm2 describe $APP_NAME"
    else
        log_error "应用启动失败，请检查日志"
        pm2 logs "$APP_NAME" --nostream --lines 50
        exit 1
    fi
}

# 主流程
main() {
    echo ""
    echo "=========================================="
    echo "  钉钉机器人 AI 网关 - 生产环境部署"
    echo "=========================================="
    echo ""

    check_environment
    build_project
    deploy_pm2
    setup_autostart
    health_check
}

# 执行主流程
main