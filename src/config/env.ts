import dotenv from 'dotenv';

// 加载 .env 文件
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable "${key}" is required`);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function optionalInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable "${key}" must be a valid integer`);
  }
  return num;
}

function optionalFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error(`Environment variable "${key}" must be a valid number`);
  }
  return num;
}

function optionalBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value === 'true' || value === '1';
}

export interface Env {
  DINGTALK_CLIENT_ID: string;
  DINGTALK_CLIENT_SECRET: string;
  DINGTALK_TEMPLATE_ID: string;
  DINGTALK_ENABLE_CARD_MESSAGE: string;
  AI_BASE_URL: string;
  AI_API_KEY: string;
  AI_MODEL: string;
  AI_MAX_TOKENS: number;
  AI_TEMPERATURE: number;
  NODE_ENV: string;
  LOG_LEVEL: string;
  PORT: number;
  SHELL_TIMEOUT_MS: number;
  SHELL_MAX_OUTPUT_BYTES: number;
  SHELL_ALLOWED_COMMANDS: string;
  FILE_MAX_SIZE: number;
  FILE_ALLOWED_PATHS: string;
  CLAUDE_CODE_ENABLED: boolean;
  CLAUDE_CODE_PATH: string;
}

export function loadEnv(): Env {
  return {
    DINGTALK_CLIENT_ID: required('DINGTALK_CLIENT_ID'),
    DINGTALK_CLIENT_SECRET: required('DINGTALK_CLIENT_SECRET'),
    DINGTALK_TEMPLATE_ID: optional('DINGTALK_TEMPLATE_ID', ''),
    DINGTALK_ENABLE_CARD_MESSAGE: optional('DINGTALK_ENABLE_CARD_MESSAGE', 'false'),
    AI_BASE_URL: required('AI_BASE_URL'),
    AI_API_KEY: required('AI_API_KEY'),
    AI_MODEL: optional('AI_MODEL', 'gpt-4o'),
    AI_MAX_TOKENS: optionalInt('AI_MAX_TOKENS', 4096),
    AI_TEMPERATURE: optionalFloat('AI_TEMPERATURE', 0.7),
    NODE_ENV: optional('NODE_ENV', 'development'),
    LOG_LEVEL: optional('LOG_LEVEL', 'info'),
    PORT: optionalInt('PORT', 3000),
    SHELL_TIMEOUT_MS: optionalInt('SHELL_TIMEOUT_MS', 30000),
    SHELL_MAX_OUTPUT_BYTES: optionalInt('SHELL_MAX_OUTPUT_BYTES', 10485760),
    SHELL_ALLOWED_COMMANDS: optional('SHELL_ALLOWED_COMMANDS', 'ls,git,cat,grep,find'),
    FILE_MAX_SIZE: optionalInt('FILE_MAX_SIZE', 10485760),
    FILE_ALLOWED_PATHS: optional('FILE_ALLOWED_PATHS', '/root/TableBro'),
    CLAUDE_CODE_ENABLED: optionalBool('CLAUDE_CODE_ENABLED', true),
    CLAUDE_CODE_PATH: optional('CLAUDE_CODE_PATH', '/usr/local/bin/claude'),
  };
}