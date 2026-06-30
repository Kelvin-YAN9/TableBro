#!/bin/bash
# 健康检查脚本

echo "=== 钉钉机器人 AI 网关健康检查 ==="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo

# 检查进程
if pgrep -f "node.*index" > /dev/null; then
    echo "✅ 进程运行中"
    ps aux | grep "node.*index" | grep -v grep | awk '{print "   PID:", $2, "| CPU:", $3"%", "| MEM:", $4"%"}'
else
    echo "❌ 进程未运行"
    exit 1
fi

echo

# 检查 .env 配置
if [ -f .env ]; then
    echo "✅ .env 配置文件存在"
    echo "   AI Model: $(grep AI_MODEL .env | cut -d= -f2)"
else
    echo "❌ .env 配置文件缺失"
fi

echo

# 磁盘和内存
echo "📊 系统资源："
echo "   磁盘: $(df -h / | tail -1 | awk '{print $5 " used (" $4 " free)"}')"
echo "   内存: $(free -h | awk '/Mem/{print $3 "/" $2}')"

echo
echo "=== 检查完成 ==="