import { spawn } from 'child_process';
import { AppConfig } from '../config/types';
import { validateCommand, parseCommand } from '../utils/sandbox';
import { logger } from '../utils/logger';

export class ShellService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async execute(command: string, timeoutMs?: number): Promise<string> {
    const actualTimeout = timeoutMs || this.config.security.shellTimeoutMs;

    logger.info('Executing shell command', {
      command: command.substring(0, 100),
      timeout: actualTimeout,
    });

    // 安全验证
    const validated = validateCommand(command, this.config.security);
    if (!validated.isSafe) {
      throw new Error(`Command rejected: ${validated.reason}`);
    }

    // 解析命令
    const parsed = parseCommand(command);

    return this.executeSpawn(parsed.command, parsed.args, actualTimeout);
  }

  private executeSpawn(command: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const maxBytes = this.config.security.shellMaxOutputBytes;

      const child = spawn(command, args, {
        shell: false, // 不使用 shell，防止注入
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
        cwd: '/root/TableBro',
      });

      // 关闭 stdin
      child.stdin?.end();

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        // 强制 kill
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stdout.length + chunk.length > maxBytes) {
          child.kill();
          stdout += '\n[OUTPUT TRUNCATED: exceeded max size]';
          return;
        }
        stdout += chunk;
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeout);

        if (timedOut) {
          reject(new Error(`Command timed out after ${timeoutMs}ms`));
          return;
        }

        // 有些命令通过 stderr 输出信息但实际成功（如 kill, npm）
        // 所以我们返回 both stdout 和 stderr
        const output = (stdout + (stderr ? `\n[stderr]: ${stderr}` : '')).trim();
        if (!output) {
          resolve('(command completed with no output)');
        } else {
          resolve(output);
        }
      });

      child.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn command: ${error.message}`));
      });
    });
  }
}