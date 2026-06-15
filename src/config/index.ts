import { loadEnv } from './env';
import { AppConfig } from './types';
import { logger } from '../utils/logger';

export function loadConfig(): AppConfig {
  try {
    const env = loadEnv();

    return {
      dingtalk: {
        clientId: env.DINGTALK_CLIENT_ID,
        clientSecret: env.DINGTALK_CLIENT_SECRET,
      },
      ai: {
        baseUrl: env.AI_BASE_URL,
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL,
        maxTokens: env.AI_MAX_TOKENS,
        temperature: env.AI_TEMPERATURE,
      },
      security: {
        shellTimeoutMs: env.SHELL_TIMEOUT_MS,
        shellMaxOutputBytes: env.SHELL_MAX_OUTPUT_BYTES,
        shellAllowedCommands: env.SHELL_ALLOWED_COMMANDS.split(',').map((c) => c.trim()),
        fileMaxSize: env.FILE_MAX_SIZE,
        fileAllowedPaths: env.FILE_ALLOWED_PATHS.split(':').map((p) => p.trim()),
      },
      server: {
        nodeEnv: env.NODE_ENV === 'production' ? 'production' : 'development',
        logLevel: env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'info' || env.LOG_LEVEL === 'warn' || env.LOG_LEVEL === 'error'
          ? env.LOG_LEVEL : 'info',
        port: env.PORT,
      },
      claudeCode: {
        enabled: env.CLAUDE_CODE_ENABLED,
        path: env.CLAUDE_CODE_PATH,
      },
    };
  } catch (error) {
    logger.error('Failed to load configuration', { error });
    throw error;
  }
}