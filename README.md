# 🤖 钉钉机器人 AI 网关 (DingTalk Bot Gateway)

> 基于钉钉 **Stream 模式**（WebSocket 长连接）的 AI 机器人网关。无需公网 IP，通过钉钉对话即可驱动本地大模型或 Claude Code 执行 Shell 命令、文件操作、代码审查等系统级任务。

---

## 目录

- [特性](#特性)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [使用示例](#使用示例)
- [工具能力](#工具能力)
- [安全机制](#安全机制)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [故障排查](#故障排查)
- [常见问题](#常见问题)

---

## 特性

| 分类 | 说明 |
|---|---|
| 🚀 **Stream 模式** | WebSocket 长连接，无需公网 IP，零配置网络穿透 |
| 🤖 **多后端支持** | 兼容任意 OpenAI 格式 API（Claude API / GPT / 第三方中转站 / Ollama 等） |
| 💻 **Shell 执行** | 安全沙箱执行系统命令，支持 git/npm/node/python3 等 |
| 📄 **文件操作** | 读取、写入、列出文件，路径隔离防越权 |
| 🔧 **Claude Code** | 直接调用 `/skill`、`/code-review`、`/security-review` 等技能 |
| 🗨️ **多轮对话** | 会话级上下文记忆，支持连续追问 |
| 🔒 **安全机制** | 命令白名单、危险模式拦截、超时/输出限制、路径校验 |
| 📝 **结构化日志** | pino 日志，可读可分析 |

---

## 架构设计

```
┌──────────┐     WebSocket      ┌──────────────────┐
│  钉钉     │◄────────────────►│  DWClient         │
│  Server   │    Stream 模式     │  (dingtalk-stream) │
└──────────┘                    └────────┬─────────┘
                                         │
                              消息回调（JSON）
                                         │
                                         ▼
                               ┌──────────────────┐
                               │  MessageHandler   │
                               │  解析 & 会话管理    │
                               └────────┬─────────┘
                                        │
                              用户消息 + 历史上下文
                                        │
                                        ▼
                         ┌──────────────────────────┐
                         │     AIProcessor           │
                         │  (OpenAI Compatible API)  │
                         │                           │
                         │  ┌─────────────────────┐ │
                         │  │  Tool Definitions    │ │
                         │  │  • shell_execute     │ │
                         │  │  • file_read/write   │ │
                         │  │  • file_list         │ │
                         │  │  • claude_code_exec  │ │
                         │  └─────────┬───────────┘ │
                         └────────────┼──────────────┘
                                      │
                           Tool Call（函数调用）
                                      │
                         ┌────────────┼──────────────┐
                         ▼            ▼              ▼
                   ┌──────────┐ ┌──────────┐ ┌──────────────┐
                   │  Shell   │ │  File    │ │ Claude Code  │
                   │  Service │ │  Service │ │   Service    │
                   │ (spawn)  │ │ (fs)     │ │  (CLI)       │
                   └──────────┘ └──────────┘ └──────────────┘
                         │            │              │
                         └────────────┴──────────────┘
                                      │
                            工具执行结果回传 AI
                                      │
                                      ▼
                              最终回复 → 钉钉
```

### 消息处理流程

1. **接收** — 钉钉通过 WebSocket Stream 推送消息到 `DWClient`
2. **解析** — `MessageHandler` 提取内容、发送者、会话 ID、回复端点
3. **推理** — `AIProcessor` 将消息 + 历史上下文 + 工具定义发送给 AI
4. **工具调用** — AI 自主决定调用哪些工具，循环直到得出最终答案（最多 20 轮）
5. **执行** — `ToolRegistry` 路由到对应 Service 执行，结果回传 AI
6. **回复** — 最终答案通过 `sessionWebhook` 发回钉钉（短内容用文本，长内容自动切 Markdown）

---

## 快速开始

### 前置条件

- **Node.js** >= 18
- **钉钉开发者账号**（注册 [钉钉开放平台](https://open-dev.dingtalk.com/)）

### 1. 克隆并安装

```bash
git clone https://github.com/Kelvin-YAN9/TableBro.git
cd dingtalk-bot-gateway
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入实际值（详见[配置说明](#配置说明)）：

```bash
# （必填）钉钉应用凭证
DINGTALK_CLIENT_ID=dingxxxxxxxxxxxxxxxxx
DINGTALK_CLIENT_SECRET=your_client_secret_here

# （必填）AI 后端
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-your-api-key-here
AI_MODEL=gpt-4o
```

### 3. 钉钉机器人设置

| 步骤 | 操作 |
|---|---|
| ① | 访问 [钉钉开放平台](https://open-dev.dingtalk.com/)，登录开发者账号 |
| ② | 进入「应用开发」→「企业内部应用」→「创建应用」 |
| ③ | 填写应用名称、描述，选择所属组织 |
| ④ | 在应用详情页 →「能力」→ 添加「**机器人**」 |
| ⑤ | 机器人配置 → 消息接收模式 → 选择「**Stream 模式**」 |
| ⑥ | 记录 **AppKey**（= CLIENT_ID）和 **AppSecret**（= CLIENT_SECRET） |
| ⑦ | 点击「发布」使应用生效 |
| ⑧ | 在钉钉客户端搜索机器人名称，发起对话 |

### 4. 启动

```bash
# 开发模式（支持热重载）
npm run dev

# 生产模式
npm run build && npm start

# 或者开发模式自动重启
npm run watch
```

启动成功后输出示例：

```
🚀 Starting DingTalk Bot Gateway...
⚙️  Configuration loaded {"aiModel":"gpt-4o","aiBaseUrl":"https://api.openai.com/v1"}
🤖 AI processor initialized
📨 Message handler initialized
🔌 Connecting to DingTalk stream...
✅ DingTalk Bot Gateway started successfully!
🎉 Ready to receive messages
```

---

## 配置说明

### 完整环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DINGTALK_CLIENT_ID` | ✅ | - | 钉钉应用 AppKey |
| `DINGTALK_CLIENT_SECRET` | ✅ | - | 钉钉应用 AppSecret |
| `AI_BASE_URL` | ✅ | - | AI API 地址（OpenAI 兼容格式） |
| `AI_API_KEY` | ✅ | - | AI API 密钥 |
| `AI_MODEL` | ❌ | `gpt-4o` | 模型名称 |
| `AI_MAX_TOKENS` | ❌ | `4096` | 单次回复最大 Token 数 |
| `AI_TEMPERATURE` | ❌ | `0.7` | 生成温度 (0-2) |
| `SHELL_TIMEOUT_MS` | ❌ | `30000` | Shell 命令超时（毫秒） |
| `SHELL_MAX_OUTPUT_BYTES` | ❌ | `10485760` | Shell 输出大小上限（10MB） |
| `SHELL_ALLOWED_COMMANDS` | ❌ | 见 `.env.example` | 允许执行的命令（逗号分隔） |
| `FILE_MAX_SIZE` | ❌ | `10485760` | 文件读写大小上限（10MB） |
| `FILE_ALLOWED_PATHS` | ❌ | `/root/TableBro` | 允许操作的文件路径（冒号分隔） |
| `CLAUDE_CODE_ENABLED` | ❌ | `true` | 是否启用 Claude Code 集成 |
| `CLAUDE_CODE_PATH` | ❌ | `/usr/local/bin/claude` | Claude Code CLI 路径 |
| `NODE_ENV` | ❌ | `development` | 运行环境 |
| `LOG_LEVEL` | ❌ | `info` | 日志级别 (debug/info/warn/error) |
| `PORT` | ❌ | `3000` | 健康检查端口（预留） |

### AI 后端配置示例

**官方 Claude API（通过 Anthropic）：**
```bash
AI_BASE_URL=https://api.anthropic.com/v1
AI_API_KEY=sk-ant-xxxxx
AI_MODEL=claude-sonnet-4-20250514
```

**第三方中转站（如 OpenRouter / OneAPI / LobeHub）：**
```bash
AI_BASE_URL=https://your-proxy.example.com/v1
AI_API_KEY=sk-your-proxy-key
AI_MODEL=claude-3-5-sonnet-20241022
```

**本地 Ollama：**
```bash
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=qwen2.5:latest
```

---

## 使用示例

### 🗨️ 基础对话

```
👤 用户: 帮我看看这个项目是做什么的
🤖 机器人: 让我先查看项目文件...
         [调用 shell_execute: cat README.md]
         这是一个基于钉钉 Stream 模式的 AI 机器人网关...
```

### 💻 Shell 命令

```
👤 用户: 看看最近 git 提交记录
🤖 机器人: [调用 shell_execute: git log --oneline -5]
         abc1234 feat: 添加文件操作工具
         def5678 fix: 修复消息处理超时
         ...
```

```
👤 用户: 有哪些 node 进程在运行
🤖 机器人: [调用 shell_execute: ps aux | grep node]
         root  1234  0.5  2.1  ... node dist/index.js
```

### 📄 文件操作

```
👤 用户: 把 config 目录下的文件列出来
🤖 机器人: [调用 file_list: src/config/]
         • env.ts (1.2 KB)
         • index.ts (1.8 KB)
         • types.ts (856 B)
```

```
👤 用户: 帮我在项目里加一个 .editorconfig 文件
🤖 机器人: 好的，我先确认一下内容...
         建议写入以下内容：
         root = true
         [*]
         indent_style = space
         indent_size = 2
         ...
         确认写入吗？
👤 用户: 确认
🤖 机器人: [调用 file_write: .editorconfig]
         ✅ 成功写入 456 字节到 .editorconfig
```

### 🔧 Claude Code Skills

```
👤 用户: 帮我 code review 最近的改动
🤖 机器人: [调用 claude_code_execute: /code-review]
         🔍 正在审查代码变更...
         [审查结果：发现 2 个潜在问题和 3 个优化建议]
```

```
👤 用户: 深度调研一下 WebSocket 和 SSE 的对比
🤖 机器人: [调用 claude_code_execute: /skill deep-research "WebSocket vs SSE 对比"]
         🔎 正在执行深度调研...
         [多源调研报告]
```

---

## 工具能力

AI 在收到消息后会自动判断是否需要调用工具。当前支持的工具有：

| 工具名 | 功能 | 示例 |
|---|---|---|
| `shell_execute` | 执行系统 Shell 命令 | `ls -la`, `git log`, `npm test` |
| `file_read` | 读取文件内容 | 读取配置文件、源代码等 |
| `file_write` | 写入文件（会覆盖） | 创建/修改文件（写前确认） |
| `file_list` | 列出目录内容 | 浏览项目结构 |
| `claude_code_execute` | 执行 Claude Code 命令 | `/code-review`, `/skill xxx` |

> AI 会在系统提示中被告知：对危险操作（如 rm、写文件）在执行前需向用户确认。

---

## 安全机制

### Shell 命令安全

| 防护层 | 实现方式 |
|---|---|
| **命令白名单** | 只有 `SHELL_ALLOWED_COMMANDS` 中列出的命令可执行 |
| **危险模式拦截** | 自动检测并阻止 `;` `&&` `\|\|` `` ` `` `$()` `rm -rf /` `dd` `mkfs` 等 |
| **spawn 非 shell** | 使用 `child_process.spawn()` 而非 `exec()`，避免 shell 注入 |
| **超时控制** | 默认 30 秒超时，超时后 SIGTERM → SIGKILL |
| **输出限制** | 单次输出上限 10MB，超出自动截断 |
| **无 stdin** | 子进程 stdin 直接关闭，防止交互式劫持 |

### 文件操作安全

| 防护层 | 实现方式 |
|---|---|
| **路径隔离** | 只能操作 `FILE_ALLOWED_PATHS` 指定的目录 |
| **目录遍历防护** | 自动 resolve 绝对路径，使用 `path.relative()` 检测越权 |
| **大小限制** | 读取/写入均受 `FILE_MAX_SIZE` 限制 |
| **符号链接安全** | 不对符号链接做 stat 追踪 |

### Claude Code 安全

- 执行超时 5 分钟
- 限定工作目录
- 所有调用记录日志

---

## 项目结构

```
dingtalk-bot-gateway/
│
├── package.json              # 依赖 & 脚本
├── tsconfig.json             # TypeScript 配置
├── .env.example              # 环境变量模板
├── .env                      # 实际配置（不入 git）
├── README.md                 # 你正在看的文件
│
├── src/
│   ├── index.ts              # 🚀 主入口：初始化 → 连接 → 监听
│   │
│   ├── config/               # ⚙️ 配置模块
│   │   ├── types.ts          #    TypeScript 类型定义
│   │   ├── env.ts            #    环境变量读取 & 校验
│   │   └── index.ts          #    配置加载器（统一入口）
│   │
│   ├── dingtalk/             # 📡 钉钉集成
│   │   ├── client.ts         #    DWClient 封装（连接/断开/回调注册）
│   │   └── message-handler.ts#    消息解析、会话管理、回复发送
│   │
│   ├── ai/                   # 🧠 AI 引擎
│   │   ├── client.ts         #    AIProcessor：OpenAI 兼容客户端 + 工具调用循环
│   │   ├── types.ts          #    工具接口类型定义
│   │   └── tools/            #    🔧 工具集
│   │       ├── index.ts      #       ToolRegistry：工具注册 & 路由
│   │       ├── shell-tool.ts  #       Shell 命令工具
│   │       ├── file-tool.ts   #       文件操作工具（read/write/list）
│   │       └── claude-code-tool.ts#   Claude Code 调用工具
│   │
│   ├── services/             # 🔩 底层服务
│   │   ├── shell-service.ts  #    Shell spawn 执行器（安全沙箱）
│   │   ├── file-service.ts   #    文件系统操作（路径校验 + 大小限制）
│   │   └── claude-code-service.ts# Claude Code CLI 调用
│   │
│   ├── utils/                # 🛠 工具函数
│   │   ├── logger.ts         #    pino 日志实例
│   │   └── sandbox.ts        #    命令验证（白名单 + 危险模式检测）
│   │
│   └── types/                # 📦 共享类型
│       └── index.ts          #    DingTalk 消息/回复类型
│
└── dist/                     # 编译产物（npm run build）
```

---

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 自动重启（文件变更时）
npm run watch

# 构建
npm run build

# 类型检查（不生成文件）
npx tsc --noEmit
```

### 添加新工具

1. 在 `src/services/` 创建新的 Service 类
2. 在 `src/ai/tools/` 创建新的 Tool 类，实现 `ITool` 接口
3. 在 `src/ai/tools/index.ts` 的 `ToolRegistry.initializeTools()` 中注册
4. 重新构建并启动

示例模板：

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
        description: 'Describe what this tool does',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: '...' },
          },
          required: ['param1'],
        },
      },
    }];
  }

  async execute(functionName: string, args: any, _context?: ToolContext): Promise<ToolResult> {
    try {
      // 你的业务逻辑
      return { success: true, data: 'result' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
```

### 生产部署

```bash
# 构建
npm run build

# 使用 PM2 守护
npm install -g pm2
pm2 start dist/index.js --name dingtalk-bot-gateway
pm2 startup
pm2 save

# 查看日志
pm2 logs dingtalk-bot-gateway
```

---

## 故障排查

### ❌ 连接钉钉失败

- 确认 `DINGTALK_CLIENT_ID` 和 `DINGTALK_CLIENT_SECRET` 正确（注意去掉首尾空格）
- 确认钉钉应用已**发布**（不是仅保存草稿）
- 确认机器人消息接收模式选择了 **Stream 模式**
- 确认服务器可以访问外网（需要连接钉钉云端）

### ❌ AI 调用失败 / 无响应

- 检查 `AI_BASE_URL` 是否可访问：`curl $AI_BASE_URL/models`
- 确认 `AI_MODEL` 名称正确（不同 API 的模型名可能不同）
- 查看 `AI_API_KEY` 是否有效、有余额
- 检查日志：`LOG_LEVEL=debug npm run dev` 查看详细调用信息

### ❌ Shell 命令不执行

- 确认命令在 `SHELL_ALLOWED_COMMANDS` 白名单中
- 检查命令是否触发了危险模式拦截（查看日志）
- 确认命令路径正确（机器人的工作目录是 `/root/TableBro`）

### ❌ Claude Code 不工作

- 确认 `CLAUDE_CODE_ENABLED=true`
- 检查 `CLAUDE_CODE_PATH` 指向正确的 `claude` 二进制文件
- 运行 `which claude` 确认 CLI 已安装
- 确认 `AI_API_KEY` 对 Claude Code 也有效

---

## 常见问题

**Q: 支持多个人同时使用吗？**  
A: 支持。每个会话（conversationId）独立维护上下文，互不影响。

**Q: 如何限制谁能使用机器人？**  
A: 当前版本无权限控制（个人使用设计）。如需限制，可在 `MessageHandler` 中添加 senderId 白名单。

**Q: AI 会不会执行危险命令？**  
A: 系统有多层防护：命令白名单 + 危险模式检测 + 超时限制。即使 AI 生成危险命令也会被拦截。

**Q: 会话历史存在哪里？**  
A: 内存中。服务重启后历史会丢失。如需持久化，可替换 `conversationCache` 为数据库实现。

**Q: 支持群聊吗？**  
A: 支持。群聊中机器人只会响应 @ 它的消息（钉钉默认行为）。每个群的 conversationId 独立。

---

## 许可证

MIT © 2025
