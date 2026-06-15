import { ITool } from './index';
import { ToolDefinition, ToolContext, ToolResult } from '../types';
import { AppConfig } from '../../config/types';
import { FileService } from '../../services/file-service';

export class FileTool implements ITool {
  private fileService: FileService;

  constructor(config: AppConfig) {
    this.fileService = new FileService(config);
  }

  getDefinitions(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'file_read',
          description: 'Read the contents of a file. Use absolute or relative paths (relative to /root/TableBro).',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to read',
              },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'file_write',
          description:
            'Write content to a file. This WILL overwrite existing files. ' +
            'ALWAYS ask the user for confirmation before writing.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to write to',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
            },
            required: ['path', 'content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'file_list',
          description: 'List files and subdirectories in a directory.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to list. Defaults to current directory (".")',
              },
            },
            required: [],
          },
        },
      },
    ];
  }

  async execute(functionName: string, args: any, _context?: ToolContext): Promise<ToolResult> {
    try {
      switch (functionName) {
        case 'file_read': {
          const content = await this.fileService.read(args.path);
          return { success: true, data: content };
        }
        case 'file_write': {
          const result = await this.fileService.write(args.path, args.content);
          return { success: true, data: result };
        }
        case 'file_list': {
          const dirPath = args.path || '.';
          const entries = await this.fileService.list(dirPath);
          return { success: true, data: entries };
        }
        default:
          return { success: false, error: `Unknown file operation: ${functionName}` };
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errMsg };
    }
  }
}