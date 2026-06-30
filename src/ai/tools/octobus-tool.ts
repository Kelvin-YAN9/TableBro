import { ITool } from './index';
import { ToolDefinition, ToolContext, ToolResult } from '../types';
import { logger } from '../../utils/logger';

// 动态加载 OctoBusService（避免循环依赖和启动时连接问题）
let octoBusService: { callTool: (name: string, args: Record<string, unknown>) => Promise<{ success: boolean; result?: unknown; error?: string }> } | null = null;

function getService(): typeof octoBusService {
  if (!octoBusService) {
    // 延迟加载
    try {
      const { OctoBusService } = require('../../services/octobus-service');
      const { AppConfig } = require('../../config/types');
      // 从环境变量读取 OctoBus 地址
      const octoBusUrl = process.env.OCTOBUS_ADDR || 'http://127.0.0.1:9000';
      const capsetId = process.env.OCTOBUS_CAPSET || 'dingtalk-bot';
      octoBusService = new OctoBusService({} as unknown as typeof AppConfig, octoBusUrl, capsetId);
    } catch (err) {
      logger.error('Failed to create OctoBusService', { error: (err as Error).message });
      throw err;
    }
  }
  return octoBusService;
}

export class OctoBusTool implements ITool {
  getDefinitions(): ToolDefinition[] {
    return [{
      type: 'function',
      function: {
        name: 'octobus_call_tool',
        description:
          '通过 OctoBus 网关调用后端工具。OctoBus 统一管理和暴露各种 API 服务（GitLab、Jira、飞书、数据库等）。\n\n' +
          '使用场景：\n' +
          '- 查询 GitLab MR、Issue、项目信息\n' +
          '- 查询 Jira 工单\n' +
          '- 查询飞书文档\n' +
          '- 访问数据库\n' +
          '- 调用任何 OctoBus 已导入的服务\n\n' +
          'Tool 命名格式: {service}__{instance}__{method}',
        parameters: {
          type: 'object',
          properties: {
            tool_name: {
              type: 'string',
              description: '要调用的 OctoBus 工具名，格式为 service__instance__method',
            },
            arguments: {
              type: 'object',
              description: '传给工具的参数字典',
              additionalProperties: true,
            },
          },
          required: ['tool_name'],
        },
      },
    }];
  }

  async execute(functionName: string, args: any, _context?: ToolContext): Promise<ToolResult> {
    if (functionName !== 'octobus_call_tool') {
      return { success: false, error: `Unknown function: ${functionName}` };
    }

    const { tool_name, arguments: toolArgs = {} } = args || {};

    if (!tool_name) {
      return { success: false, error: 'tool_name is required' };
    }

    logger.info('OctoBus tool execution', { toolName: tool_name, args: toolArgs });

    try {
      const service = getService();
      if (!service) {
        return { success: false, error: 'OctoBusService not initialized' };
      }
      const result = await service.callTool(tool_name, toolArgs);

      if (result.success) {
        const content = (result.result as any)?.content;
        // MCP content might be [{ type: 'text', text: '...' }]
        let textResult = '';
        if (Array.isArray(content)) {
          textResult = content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
        } else {
          textResult = JSON.stringify(result);
        }
        return { success: true, data: textResult };
      } else {
        return { success: false, error: result.error || 'Unknown OctoBus error' };
      }
    } catch (error) {
      logger.error('OctoBus tool failed', { error: (error as Error).message });
      return { success: false, error: `OctoBus error: ${(error as Error).message}` };
    }
  }
}