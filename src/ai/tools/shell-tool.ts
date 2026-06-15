import { ITool } from './index';
import { ToolDefinition, ToolContext, ToolResult } from '../types';
import { AppConfig } from '../../config/types';
import { ShellService } from '../../services/shell-service';

export class ShellTool implements ITool {
  private shellService: ShellService;

  constructor(config: AppConfig) {
    this.shellService = new ShellService(config);
  }

  getDefinitions(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'shell_execute',
          description:
            'Execute a system shell command. Use this to inspect project state, ' +
            'list files, check git status, read file contents via cat, search with grep/find, ' +
            'run npm/pip commands, execute scripts with node/python3, etc. ' +
            'Always explain what you\'re doing BEFORE running the command.',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Shell command to execute (e.g., "ls -la", "git status", "cat package.json")',
              },
              timeout: {
                type: 'number',
                description: 'Max execution time in milliseconds (default: 30000)',
              },
            },
            required: ['command'],
          },
        },
      },
    ];
  }

  async execute(
    functionName: string,
    args: { command: string; timeout?: number },
    _context?: ToolContext
  ): Promise<ToolResult> {
    try {
      const { command, timeout } = args;
      const result = await this.shellService.execute(command, timeout);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errMsg,
      };
    }
  }
}