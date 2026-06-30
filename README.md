# 🤖 钉钉机器人 AI 网关

基于钉钉 **Stream 模式**（WebSocket 长连接）的 AI 机器人网关。无需公网 IP，通过钉钉对话即可驱动本地大模型或 Claude Code 执行 Shell 命令、文件操作、代码审查等系统级任务。

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## 📑 目录

- [快速开始](#快速开始)
- [一键部署](#一键部署)
- [配置说明](#配置说明)
- [功能特性](#功能特性)
- [使用示例](#使用示例)
- [开发指南](#开发指南)
- [故障排查](#故障排查)

---

## 🚀 快速开始

### 前置条件

- **Node.js** >= 18
- **钉钉开发者账号**（注册 [钉钉开放平台](https://open-dev.dingtalk.com/)）

### 1. 安装

```bash
git clone https://github.com/Kelvin-YAN9/TableBro.git
cd TableBro
npm install
```

### 2. 配置

```bash
cp .env.example .env
```

编辑 `.env`，填入实际值：

```bash
# 钉钉应用凭证
DINGTALK_CLIENT_ID=dingxxxxxxxxxxxxxxxxx
DINGTALK_CLIENT_SECRET=your_client_secret_here

# AI 后端配置
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-your-api-key-here
AI_MODEL=gpt-4o
```

### 3. 钉钉机器人设置

| 步骤 | 操作 |
|---|---|
| ① | 访问 [钉钉开放平台](https://open-dev.dingtalk.com/) → 企业内部应用 → 创建应用 |
| ② | 添加「**机器人**」能力 |
| ③ | 机器人配置 → 消息接收模式 → 选择「**Stream 模式**」 |
| ④ | 记录 **AppKey** 和 **AppSecret**（填入 `.env`） |
| ⑤ | 点击「发布」使应用生效 |
| ⑥ | 在钉钉客户端搜索机器人名称，发起对话 |

### 4. 启动

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

---

## 📦 一键部署

### 生产环境部署（推荐）

使用一键部署脚本自动完成构建、PM2 配置和开机自启：

```bash
bash scripts/deploy.sh
```

脚本会自动执行：
- ✅ 环境检查（Node.js 版本、配置文件）
- ✅ 构建项目（依赖安装、TypeScript 编译）
- ✅ 配置 PM2 守护进程
- ✅ 设置开机自启
- ✅ 健康检查

**部署成功后常用命令：**

```bash
pm2 status                    # 查看状态
pm2 logs dingtalk-bot-gateway # 查看日志
pm2 restart dingtalk-bot-gateway    # 重启
pm2 stop dingtalk-bot-gateway       # 停止
pm2 describe dingtalk-bot-gateway   # 详情
```

### 手动部署

如果需要手动部署：

```bash
# 1. 构建
npm run build

# 2. 安装 PM2
npm install -g pm2

# 3. 启动应用
pm2 start dist/index.js --name dingtalk-bot-gateway

# 4. 保存并设置开机自启
pm2 save
pm2 startup  # 按提示执行
```

---

## ⚙️ 配置说明

### 核心配置

| 变量 | 必填 | 说明 |
|---|---|---|
| `DINGTALK_CLIENT_ID` | ✅ | 钉钉应用 AppKey |
| `DINGTALK_CLIENT_SECRET` | ✅ | 钉钉应用 AppSecret |
| `DINGTALK_TEMPLATE_ID` | ❌ | 钉钉卡片模板 ID（可选） |
| `DINGTALK_ENABLE_CARD_MESSAGE` | ❌ | 是否启用卡片消息（默认: false） |
| `AI_BASE_URL` | ✅ | AI API 地址（OpenAI 兼容） |
| `AI_API_KEY` | ✅ | AI API 密钥 |
| `AI_MODEL` | ❌ | 模型名称（默认: gpt-4o） |

### 卡片模板配置（可选）

项目支持钉钉交互式卡片模板，提供更丰富的消息展示形式。

**配置步骤：**

1. 访问 [钉钉开放平台](https://open-dev.dingtalk.com/) → 应用开发 → 企业内部应用
2. 进入「卡片管理」→「卡片模板」→「创建模板」
3. 设计卡片布局，定义动态变量（如 `card_content`）
4. 提交审核通过后，获取**模板 ID**
5. 在 `.env` 中配置：

```bash
# 启用卡片消息
DINGTALK_ENABLE_CARD_MESSAGE=true
# 填入卡片模板 ID
DINGTALK_TEMPLATE_ID=dtp_xxxxxxxxxx
```

**消息类型选择逻辑：**
- 长内容（>200字符）+ 卡片启用 → 使用卡片消息
- 长内容（>500字符）+ 卡片禁用 → 使用 Markdown 消息
- 短内容（≤500字符） → 使用文本消息

**卡片发送失败时自动回退到 Markdown 消息。**

### AI 后端配置示例

```bash
# Claude 官方 API
AI_BASE_URL=https://api.anthropic.com/v1
AI_API_KEY=sk-ant-xxxxx
AI_MODEL=claude-sonnet-4-20250514

# 第三方中转站
AI_BASE_URL=https://your-proxy.example.com/v1
AI_API_KEY=sk-your-proxy-key
AI_MODEL=claude-3-5-sonnet-20241022

# 本地 Ollama
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=qwen2.5:latest
```

### 安全配置

```bash
# Shell 安全
SHELL_TIMEOUT_MS=30000                    # 命令超时（毫秒）
SHELL_ALLOWED_COMMANDS=ls,git,npm,node... # 允许的命令

# 文件安全
FILE_MAX_SIZE=10485760                    # 文件大小上限（10MB）
FILE_ALLOWED_PATHS=/root/TableBro          # 允许操作的路径

# Claude Code
CLAUDE_CODE_ENABLED=true
CLAUDE_CODE_PATH=/usr/local/bin/claude
```

---

## ✨ 功能特性

| 特性 | 说明 |
|---|---|
| 🚀 **Stream 模式** | WebSocket 长连接，无需公网 IP |
| 🤖 **多后端支持** | 兼容任意 OpenAI 格式 API |
| 💻 **Shell 执行** | 安全沙箱执行系统命令 |
| 📄 **文件操作** | 读取、写入、列出文件 |
| 🔧 **Claude Code** | 调用 `/code-review`、`/skill` 等技能 |
| 🗨️ **多轮对话** | 会话级上下文记忆 |
| 🎴 **卡片模板** | 支持钉钉交互式卡片模板（可选） |
| 🔒 **安全机制** | 命令白名单、路径隔离、超时控制 |

### 支持的工具

| 工具 | 功能 |
|---|---|
| `shell_execute` | 执行系统命令（ls、git、npm 等） |
| `file_read` | 读取文件内容 |
| `file_write` | 写入文件 |
| `file_list` | 列出目录内容 |
| `claude_code_execute` | 执行 Claude Code 命令 |

---

## 📖 使用示例

### 基础对话

```
👤 用户: 帮我看看这个项目是做什么的
🤖 机器人: 让我先查看项目文件...
         [调用 shell_execute: cat README.md]
         这是一个基于钉钉 Stream 模式的 AI 机器人网关...
```

### Shell 命令

```
👤 用户: 看看最近 git 提交记录
🤖 机器人: [调用 shell_execute: git log --oneline -5]
         abc1234 feat: 添加文件操作工具
         def5678 fix: 修复消息处理超时
```

### 文件操作

```
👤 用户: 把 config 目录下的文件列出来
🤖 机器人: [调用 file_list: src/config/]
         • env.ts (1.2 KB)
         • index.ts (1.8 KB)
         • types.ts (856 B)
```

### Claude Code

```
👤 用户: 帮我 code review 最近的改动
🤖 机器人: [调用 claude_code_execute: /code-review]
         🔍 正在审查代码变更...
         [审查结果：发现 2 个潜在问题和 3 个优化建议]
```

---

## 🛠️ 开发指南

### 开发命令

```bash
npm install          # 安装依赖
npm run dev         # 开发模式
npm run watch       # 自动重启
npm run build       # 构建
npx tsc --noEmit   # 类型检查
```

### 添加新工具

1. 在 `src/services/` 创建新的 Service 类
2. 在 `src/ai/tools/` 创建新的 Tool 类，实现 `ITool` 接口
3. 在 `src/ai/tools/index.ts` 的 `ToolRegistry.initializeTools()` 中注册

**示例模板：**

```typescript
// src/ai/tools/my-custom-tool.ts
import { ITool } from './index';
import { ToolDefinition, ToolContext, ToolResult } from '../types';

export class MyCustomTool implements ITool {
  getDefinitions(): ToolDefinition[] {
    return [{
      type: 'function',
      function: {
        name: 'my_custom_action',
        description: '工具描述',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: '参数说明' },
          },
          required: ['param1'],
        },
      },
    }];
  }

  async execute(functionName: string, args: any, _context?: ToolContext): Promise<ToolResult> {
    try {
      // 业务逻辑
      return { success: true, data: '结果' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
```

---

## 🔧 故障排查

### ❌ 连接钉钉失败

- 确认 `DINGTALK_CLIENT_ID` 和 `DINGTALK_CLIENT_SECRET` 正确
- 确认钉钉应用已**发布**
- 确认机器人消息接收模式选择了 **Stream 模式**
- 确认服务器可以访问外网

### ❌ AI 调用失败

- 检查 `AI_BASE_URL` 是否可访问：`curl $AI_BASE_URL/models`
- 确认 `AI_MODEL` 名称正确
- 检查 `AI_API_KEY` 是否有效
- 查看详细日志：`LOG_LEVEL=debug npm run dev`

### ❌ Shell 命令不执行

- 确认命令在 `SHELL_ALLOWED_COMMANDS` 白名单中
- 检查命令是否触发了危险模式拦截
- 确认命令路径正确

### ❌ Claude Code 不工作

- 确认 `CLAUDE_CODE_ENABLED=true`
- 检查 `CLAUDE_CODE_PATH` 指向正确的 `claude` 二进制文件
- 运行 `which claude` 确认 CLI 已安装

---

## 📄 项目结构

```
TableBro/
├── src/
│   ├── index.ts              # 主入口
│   ├── config/               # 配置模块
│   ├── dingtalk/             # 钉钉集成
│   ├── ai/                   # AI 引擎
│   │   └── tools/            # 工具集
│   ├── services/             # 底层服务
│   ├── utils/                # 工具函数
│   └── types/                # 共享类型
├── scripts/                  # 脚本工具
│   └── deploy.sh            # 一键部署脚本
├── package.json
├── .env.example
└── README.md
```

---

## ❓ 常见问题

**Q: 支持多个人同时使用吗？**
A: 支持。每个会话独立维护上下文，互不影响。

**Q: 如何限制谁能使用机器人？**
A: 当前版本无权限控制（个人使用设计）。如需限制，可在 `MessageHandler` 中添加 senderId 白名单。

**Q: 会话历史存在哪里？**
A: 内存中。服务重启后历史会丢失。

---

## 📄 License

MIT

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！