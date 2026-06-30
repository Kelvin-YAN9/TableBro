import { AppConfig } from '../config/types';
import { logger } from '../utils/logger';

export interface OctoBusToolRequest {
  tool_name: string;
  arguments?: Record<string, unknown>;
}

export interface OctoBusToolResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

export class OctoBusService {
  constructor(_config: AppConfig, private baseUrl = 'http://127.0.0.1:9000', private capsetId = 'dingtalk-bot') {
    // _config 保留以备将来使用
  }

  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<OctoBusToolResponse> {
    logger.info('Calling OctoBus tool', { toolName, args });

    try {
      const response = await fetch(`${this.baseUrl}/capsets/${this.capsetId}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OctoBus call failed', {
          status: response.status,
          error: errorText,
        });
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json() as { result?: unknown; error?: { message?: string } };

      // MCP 格式: { result: { content: [...] } }
      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'Unknown error',
        };
      }

      return {
        success: true,
        result: result.result,
      };
    } catch (error) {
      logger.error('OctoBus service error', { error: (error as Error).message });
      return {
        success: false,
        error: `OctoBus service error: ${(error as Error).message}`,
      };
    }
  }

  async listTools(): Promise<OctoBusToolResponse> {
    logger.info('Listing OctoBus tools');

    try {
      const response = await fetch(`${this.baseUrl}/capsets/${this.capsetId}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OctoBus list tools failed', {
          status: response.status,
          error: errorText,
        });
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json() as { result?: unknown; error?: { message?: string } };

      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'Unknown error',
        };
      }

      return {
        success: true,
        result: result.result,
      };
    } catch (error) {
      logger.error('OctoBus service error', { error: (error as Error).message });
      return {
        success: false,
        error: `OctoBus service error: ${(error as Error).message}`,
      };
    }
  }

  // 便捷方法：调用 TableBro 工具
  async shellExecute(command: string): Promise<OctoBusToolResponse> {
    return this.callTool('tablebro__default__shell_execute', { command });
  }

  async fileRead(path: string): Promise<OctoBusToolResponse> {
    return this.callTool('tablebro__default__file_read', { path });
  }

  async fileWrite(path: string, content: string): Promise<OctoBusToolResponse> {
    return this.callTool('tablebro__default__file_write', { path, content });
  }

  async fileList(path: string = '.'): Promise<OctoBusToolResponse> {
    return this.callTool('tablebro__default__file_list', { path });
  }

  async claudeCodeExecute(command: string): Promise<OctoBusToolResponse> {
    return this.callTool('tablebro__default__claude_code_execute', { command });
  }
}