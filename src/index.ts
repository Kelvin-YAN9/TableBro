import { loadConfig } from './config';
import { DingTalkClient } from './dingtalk/client';
import { MessageHandler } from './dingtalk/message-handler';
import { AIProcessor } from './ai/client';
import { logger } from './utils/logger';

async function main() {
  try {
    logger.info('🚀 Starting DingTalk Bot Gateway...');

    // 加载配置
    const config = loadConfig();
    logger.info('⚙️  Configuration loaded', {
      aiModel: config.ai.model,
      aiBaseUrl: config.ai.baseUrl,
      dingtalkConfigured: !!config.dingtalk.clientId,
      shellCommands: config.security.shellAllowedCommands.length,
      claudeCodeEnabled: config.claudeCode.enabled,
    });

    // 初始化 AI 处理器
    const aiProcessor = new AIProcessor(config);
    logger.info('🤖 AI processor initialized');

    // 初始化钉钉客户端
    const dingtalkClient = new DingTalkClient(config);

    // 初始化消息处理器
    const messageHandler = new MessageHandler(dingtalkClient, aiProcessor);
    messageHandler.initialize();
    logger.info('📨 Message handler initialized');

    // 连接到钉钉
    logger.info('🔌 Connecting to DingTalk stream...');
    await dingtalkClient.connect();

    logger.info('✅ DingTalk Bot Gateway started successfully!');
    logger.info('🎉 Ready to receive messages');

    // 优雅关闭处理
    const shutdown = async (signal: string) => {
      logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await dingtalkClient.close();
        logger.info('✅ Shutdown complete');
      } catch (error) {
        logger.error('❌ Error during shutdown', { error });
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // 未捕获的异常处理
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('💥 Failed to start application', { error: errMsg });
    process.exit(1);
  }
}

main();