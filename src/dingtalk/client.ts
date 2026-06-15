import { DWClient, TOPIC_ROBOT } from 'dingtalk-stream';
import { AppConfig } from '../config/types';
import { logger } from '../utils/logger';

/**
 * 钉钉 Stream 客户端封装
 */
export class DingTalkClient {
  private client: DWClient;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.client = new DWClient({
      clientId: config.dingtalk.clientId,
      clientSecret: config.dingtalk.clientSecret,
    });
  }

  /**
   * 注册消息回调
   */
  registerCallback(callback: (event: any) => void | Promise<void>): void {
    this.client.registerCallbackListener(TOPIC_ROBOT, callback);
    logger.info('DingTalk callback registered');
  }

  /**
   * 连接到钉钉
   */
  async connect(): Promise<void> {
    logger.info('Connecting to DingTalk stream...');

    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        logger.info('DingTalk stream connected successfully');
        resolve();
      });

      this.client.on('error', (error: any) => {
        logger.error('DingTalk stream error', { error });
        reject(new Error(`DingTalk connection error: ${error.message || JSON.stringify(error)}`));
      });

      this.client.on('close', () => {
        logger.warn('DingTalk stream connection closed');
      });

      this.client.connect();
    });
  }

  /**
   * 断开连接
   */
  async close(): Promise<void> {
    logger.info('Disconnecting DingTalk stream...');
    await this.client.disconnect();
    logger.info('DingTalk stream disconnected');
  }

  /**
   * 获取 Access Token（用于发送回复）
   */
  async getAccessToken(): Promise<string> {
    return this.client.getAccessToken();
  }
}