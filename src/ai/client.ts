import OpenAI from 'openai';
import { AppConfig } from '../config/types';
import { ToolRegistry } from './tools';
import { ToolResult } from './types';
import { logger } from '../utils/logger';

export interface ProcessMessageOptions {
  message: string;
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  context?: Record<string, any>;
}

export interface ProcessMessageResult {
  text: string;
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
  iterations: number;
}

export class AIProcessor {
  private client: OpenAI;
  private config: AppConfig;
  private toolRegistry: ToolRegistry;

  constructor(config: AppConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: config.ai.baseUrl,
      apiKey: config.ai.apiKey,
    });
    this.toolRegistry = new ToolRegistry(config);
  }

  async processMessage(options: ProcessMessageOptions): Promise<ProcessMessageResult> {
    const { message, history, context } = options;

    logger.info('Processing message with AI', {
      messagePreview: message.substring(0, 50),
      historyLength: history.length,
    });

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(),
      },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    const tools = this.toolRegistry.getToolDefinitions();
    const toolCalls: Array<{ name: string; arguments: any; result: ToolResult }> = [];

    let finalResponse = '';
    const maxIterations = 20; // 防止无限循环
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      logger.debug(`AI iteration ${iteration}`);

      try {
        const response = await this.client.chat.completions.create({
          model: this.config.ai.model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          max_tokens: this.config.ai.maxTokens,
          temperature: this.config.ai.temperature,
        });

        const choice = response.choices[0];
        const msg = choice.message;

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // 执行工具调用
          logger.info('AI requested tool calls', {
            count: msg.tool_calls.length,
            tools: msg.tool_calls.map((t) => t.function.name),
          });

          // 添加 assistant 消息（含 tool_calls）
          messages.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.tool_calls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          });

          // 执行每个工具调用，并添加 tool 响应
          for (const toolCall of msg.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs: any;
            try {
              toolArgs = JSON.parse(toolCall.function.arguments);
            } catch {
              toolArgs = {};
            }

            logger.info('Executing tool', {
              toolName,
              arguments: toolArgs,
            });

            let result: ToolResult;
            try {
              result = await this.toolRegistry.executeTool(toolName, toolArgs, context);
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : 'Unknown error';
              logger.error('Tool execution failed', { toolName, error: errMsg });
              result = {
                success: false,
                error: errMsg,
              };
            }

            toolCalls.push({
              name: toolName,
              arguments: toolArgs,
              result,
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          }
        } else {
          // 没有工具调用，得到最终回复
          finalResponse = choice.message.content || '';
          break;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown API error';
        logger.error('AI API call failed', { error: errMsg, iteration });
        finalResponse = `抱歉，AI 服务调用失败: ${errMsg}`;
        break;
      }
    }

    if (iteration >= maxIterations) {
      logger.warn('Max tool call iterations reached', { maxIterations });
      finalResponse = '操作已超过最大执行步骤限制，请尝试简化为更具体的请求。';
    }

    return {
      text: finalResponse,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      iterations: iteration,
    };
  }

  private buildSystemPrompt(): string {
    return `你是一个集成在钉钉机器人中的 AI 助手。你可以访问各种工具来帮助用户完成任务。

可用工具：
- **shell_execute**: 执行系统 Shell 命令（如 ls、git status、cat 等）
- **file_read**: 读取文件内容
- **file_write**: 将内容写入文件（会覆盖已有内容！）
- **file_list**: 列出目录中的文件
- **claude_code_execute**: 执行 Claude Code 斜杠命令（如 /skill、/code-review 等，需要 Claude Code CLI 已启用）

行为准则：
1. 在执行任何系统操作前，先向用户解释你要做什么
2. 对于危险操作（如 rm、写文件），在执行前确认
3. 保持回复简洁、有帮助
4. 遇到错误时说明原因并建议替代方案
5. 如果用户的请求不明确，请求澄清
6. 善用 Shell 工具来了解项目状态（如 git status、ls 等）
7. 文件路径应相对于工作目录 /root/TableBro

当前工作环境：
- 工作目录: /root/TableBro
- 操作系统: Linux`;
  }
}