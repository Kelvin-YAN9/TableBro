#!/bin/bash
# PTS CLI 非交互式包装脚本
# 用于钉钉机器人自动调用，写操作自动确认

SCRIPT_DIR="/root/chaitin_pts_agent"

# 确保目录存在
if [ ! -d "$SCRIPT_DIR" ]; then
    echo "错误: pts_cli 目录不存在: $SCRIPT_DIR" >&2
    exit 1
fi

# Activate virtual environment
if [ -f "$SCRIPT_DIR/venv/bin/activate" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
fi

export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# 运行 pts_cli
"$SCRIPT_DIR/venv/bin/python3" -m pts_cli_lib.main "$@"