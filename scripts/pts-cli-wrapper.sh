#!/bin/bash
# PTS CLI 非交互式包装脚本（用于钉钉机器人调用）
# 自动确认写操作

SCRIPT_DIR="/root/chaitin_pts_agent"

# Activate virtual environment
if [ -f "$SCRIPT_DIR/venv/bin/activate" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
fi

export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# 运行 pts_cli，交互时自动回复 "y"
echo "$@" | (
    # 启动 pts_cli
    "$SCRIPT_DIR/venv/bin/python3" -m pts_cli_lib.main "$@" 2>&1 &
    PID=$!

    # 等待输出，检测到确认提示时自动回复
    while true; do
        sleep 0.5
        if ! kill -0 $PID 2>/dev/null; then
            # 进程已结束
            wait $PID
            exit $?
        fi
    done
) | grep -v "💬 继续对话" || true