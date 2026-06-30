import { ToolDefinition, ToolContext, ToolResult } from '../types';
import { AppConfig } from '../../config/types';
import { ShellTool } from './shell-tool';
import { FileTool } from './file-tool';
import { ClaudeCodeTool } from './claude-code-tool';
import { OctoBusTool } from './octobus-tool';
import { logger } from '../../utils/logger';

/**
 * 工具类接口 - 所有工具必须实现
 */
export interface ITool {
  getDefinitions(): ToolDefinition[];
  execute(functionName: string, args: any, context?: ToolContext): Promise<ToolResult>;
}

/**
 * 工具注册表 - 管理所有可用工具及其路由
 */
export class ToolRegistry {
  private tools: ITool[];
  /** 函数名 → 工具实例的映射 */
  private routeMap: Map<string, ITool>;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.tools = [];
    this.routeMap = new Map();
    this.initializeTools();
    logger.info('Tool registry initialized', { toolCount: this.tools.length, routeCount: this.routeMap.size });
  }

  private initializeTools(): void {
    // Shell 工具
    this.register(new ShellTool(this.config));

    // 文件工具
    this.register(new FileTool(this.config));

    // Claude Code 工具（仅在启用时）
    if (this.config.claudeCode.enabled) {
      this.register(new ClaudeCodeTool(this.config));
    }

    // OctoBus 工具（在启用 OctoBus 时）
    if (process.env.OCTOBUS_ENABLED === 'true') {
      this.register(new OctoBusTool());
      logger.info('OctoBus tool registered');
    }
  }

  private register(tool: ITool): void {
    this.tools.push(tool);
    for (const def of tool.getDefinitions()) {
      const name = def.function.name;
      if (this.routeMap.has(name)) {
        logger.warn('Duplicate tool function name detected', { name });
      }
      this.routeMap.set(name, tool);
      logger.debug('Registered tool', { name });
    }
  }

  /**
   * 获取所有工具定义（去重）
   */
  getToolDefinitions(): ToolDefinition[] {
    const unique = new Map<string, ToolDefinition>();
    for (const tool of this.tools) {
      for (const def of tool.getDefinitions()) {
        unique.set(def.function.name, def);
      }
    }
    return Array.from(unique.values());
  }

  /**
   * 根据函数名执行工具
   */
  async executeTool(name: string, args: any, context?: ToolContext): Promise<ToolResult> {
    const tool = this.routeMap.get(name);

    if (!tool) {
      return {
        success: false,
        error: `工具未找到: ${name}`,
      };
    }

    logger.debug('Executing tool', { toolName: name, args });
    return tool.execute(name, args, context);
  }
}