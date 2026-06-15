/**
 * 应用配置类型定义
 */

export interface DingTalkConfig {
  clientId: string;
  clientSecret: string;
}

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface SecurityConfig {
  shellTimeoutMs: number;
  shellMaxOutputBytes: number;
  shellAllowedCommands: string[];
  fileMaxSize: number;
  fileAllowedPaths: string[];
}

export interface ServerConfig {
  nodeEnv: 'development' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  port: number;
}

export interface ClaudeCodeConfig {
  enabled: boolean;
  path: string;
}

export interface AppConfig {
  dingtalk: DingTalkConfig;
  ai: AIConfig;
  security: SecurityConfig;
  server: ServerConfig;
  claudeCode: ClaudeCodeConfig;
}