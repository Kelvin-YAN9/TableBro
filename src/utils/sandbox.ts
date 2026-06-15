import { SecurityConfig } from '../config/types';

export interface CommandValidation {
  command: string;
  args: string[];
  isSafe: boolean;
  reason?: string;
}

/**
 * 危险命令模式列表
 */
const DANGEROUS_PATTERNS = [
  /\|\|/,   // OR 运算符
  /&&/,     // AND 运算符
  /;/,      // 命令分隔符
  /`/,      // 反引号命令替换
  /\$\(/,   // $() 命令替换
  />\s*\//, // 重定向到根目录
  /rm\s+-rf\s*\//, // 危险的 rm 命令
  /dd\s+/,  // dd 命令
  /mkfs/,   // 文件系统格式化命令
  /fdisk/,  // 磁盘分区命令
  /mount\s+/, // mount 命令
  />\s*\/dev\/sd/, // 直接写入块设备
];

/**
 * 验证 Shell 命令的安全性
 */
export function validateCommand(
  rawCommand: string,
  securityConfig: SecurityConfig
): CommandValidation {
  const trimmed = rawCommand.trim();

  // 解析命令和参数
  const parts = trimmed.split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  if (!command) {
    return {
      command: '',
      args: [],
      isSafe: false,
      reason: 'Empty command',
    };
  }

  // 检查命令是否在白名单中
  const isAllowed = securityConfig.shellAllowedCommands.some(
    (allowed) => command === allowed || command === allowed.toLowerCase()
  );

  if (!isAllowed) {
    return {
      command,
      args,
      isSafe: false,
      reason: `Command not in allowed list: ${command}. Allowed: ${securityConfig.shellAllowedCommands.join(', ')}`,
    };
  }

  // 检查危险模式
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        command,
        args,
        isSafe: false,
        reason: `Command contains dangerous pattern: ${pattern.toString()}`,
      };
    }
  }

  // 特殊检查：防止删除根目录
  if (command === 'rm' && args.includes('-rf') && args.some(arg => arg === '/' || arg.startsWith('/'))) {
    return {
      command,
      args,
      isSafe: false,
      reason: 'Cannot rm -rf on root or absolute paths',
    };
  }

  return {
    command,
    args,
    isSafe: true,
  };
}

/**
 * 解析命令为命令名和参数数组
 * 支持简单的引号处理
 */
export function parseCommand(command: string): { command: string; args: string[] } {
  const trimmed = command.trim();
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if ((char === '"' || char === "'") && (i === 0 || trimmed[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else {
        current += char;
      }
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return {
    command: parts[0] || '',
    args: parts.slice(1),
  };
}