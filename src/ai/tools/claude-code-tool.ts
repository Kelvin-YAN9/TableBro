import { ITool } from './index';
import { ToolDefinition, ToolContext, ToolResult } from '../types';
import { AppConfig } from '../../config/types';
import { ClaudeCodeService } from '../../services/claude-code-service';

export class ClaudeCodeTool implements ITool {
  private claudeCodeService: ClaudeCodeService;

  constructor(config: AppConfig) {
    this.claudeCodeService = new ClaudeCodeService(config);
  }

  getDefinitions(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'claude_code_execute',
          description:
            'Execute a Claude Code slash command such as /skill, /code-review, /security-review, etc. ' +
            'Use this when the user wants to invoke Claude Code capabilities. ' +
            'Example commands: "/code-review", "/skill deep-research topic", "/review".',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The Claude Code slash command to execute (e.g., "/code-review", "/skill deep-research ...")',
              },
              workingDirectory: {
                type: 'string',
                description: 'Working directory for the command (default: /root/TableBro)',
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
    args: { command: string; workingDirectory?: string },
    _context?: ToolContext
  ): Promise<ToolResult> {
    try {
      const { command, workingDirectory } = args;
      const result = await this.claudeCodeService.execute(command, workingDirectory);
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