import { spawn } from 'child_process';
import { AppConfig } from '../config/types';
import { logger } from '../utils/logger';

export class ClaudeCodeService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async execute(command: string, workingDirectory?: string): Promise<string> {
    if (!this.config.claudeCode.enabled) {
      throw new Error('Claude Code integration is not enabled. Set CLAUDE_CODE_ENABLED=true');
    }

    const cwd = workingDirectory || '/root/TableBro';

    logger.info('Executing Claude Code command', {
      command,
      workingDirectory: cwd,
    });

    // 解析命令（claude 的子命令，如 "code-review"）
    // 完整的 claude 命令执行格式：claude <subcommand>
    const args = command.split(/\s+/);

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn(this.config.claudeCode.path, args, {
        cwd,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // 传递 AI API 密钥给 Claude Code
          ANTHROPIC_API_KEY: this.config.ai.apiKey,
          ANTHROPIC_BASE_URL: this.config.ai.baseUrl,
        },
      });

      // 关闭 stdin
      child.stdin?.end();

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, 5 * 60 * 1000); // 5 分钟超时

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeout);

        if (code !== 0) {
          logger.error('Claude Code command failed', {
            command,
            exitCode: code,
            stderr: stderr.substring(0, 200),
          });
          reject(
            new Error(
              `Claude Code command failed with exit code ${code}: ${stderr.substring(0, 500)}`
            )
          );
          return;
        }

        logger.info('Claude Code command succeeded', { command });
        resolve(stdout.trim() || 'Claude Code command executed successfully');
      });

      child.on('error', (error: Error) => {
        clearTimeout(timeout);
        logger.error('Claude Code spawn error', { error: error.message });
        reject(new Error(`Failed to run Claude Code: ${error.message}`));
      });
    });
  }
}