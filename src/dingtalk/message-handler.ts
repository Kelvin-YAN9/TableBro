import { DingTalkClient } from './client';
import { AIProcessor } from '../ai/client';
import { DingTalkMessage, DingTalkReplyBody } from '../types';
import { logger } from '../utils/logger';
import { AppConfig } from '../config/types';

/**
 * 会话历史缓存
 */
interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * 钉钉消息处理器
 */
export class MessageHandler {
  private dingtalkClient: DingTalkClient;
  private aiProcessor: AIProcessor;
  private config: AppConfig;
  /** 会话缓存: conversationId → 消息历史 */
  private conversationCache: Map<string, ConversationEntry[]>;
  /** 最大会话历史条数 */
  private maxHistorySize: number = 20;

  constructor(dingtalkClient: DingTalkClient, aiProcessor: AIProcessor, config: AppConfig) {
    this.dingtalkClient = dingtalkClient;
    this.aiProcessor = aiProcessor;
    this.config = config;
    this.conversationCache = new Map();
  }

  /**
   * 初始化消息监听
   */
  initialize(): void {
    this.dingtalkClient.registerCallback(async (event: any) => {
      await this.handleMessage(event);
    });

    logger.info('Message handler initialized');
  }

  /**
   * 处理接收到的消息
   */
  private async handleMessage(event: any): Promise<void> {
    try {
      // 解析消息数据
      let data: any;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        logger.error('Failed to parse message data', { data: event.data?.substring(0, 100) });
        return;
      }

      // 提取消息信息
      const text = data.text?.content?.trim();
      if (!text) {
        logger.debug('Empty message, ignoring');
        return;
      }

      const message: DingTalkMessage = {
        content: text,
        senderId: data.senderStaffId || data.senderId || 'unknown',
        senderNick: data.senderNick || 'User',
        conversationId: data.conversationId || data.conversationTitle || `conv_${Date.now()}`,
        sessionWebhook: data.sessionWebhook,
        timestamp: Date.now(),
      };

      logger.info('Received message', {
        senderId: message.senderId,
        conversationId: message.conversationId,
        contentPreview: message.content.substring(0, 50),
      });

      // 回复一个确认消息，让用户知道正在处理
      await this.sendReply(message.sessionWebhook, '正在思考...', {
        senderId: message.senderId,
      });

      // 获取会话历史
      const history = this.getConversationHistory(message.conversationId);

      // AI 处理
      const result = await this.aiProcessor.processMessage({
        message: message.content,
        history: history.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        context: {
          senderId: message.senderId,
          conversationId: message.conversationId,
        },
      });

      // 更新会话历史
      this.addToConversationHistory(message.conversationId, {
        role: 'user',
        content: message.content,
        timestamp: message.timestamp,
      });
      this.addToConversationHistory(message.conversationId, {
        role: 'assistant',
        content: result.text,
        timestamp: Date.now(),
      });

      // 构建回复 - 如果结果太长，使用 markdown 或卡片
      const enableCard = this.config.dingtalk.enableCardMessage && !!this.config.dingtalk.templateId;

      if (enableCard && result.text.length > 200) {
        // 长内容 + 卡片启用 → 使用卡片消息
        await this.sendCardReply(message.sessionWebhook, result.text, {
          i18n_data: {
            zh_CN: {
              // 可以添加更多动态变量
            },
          },
        }, { senderId: message.senderId });
      } else if (result.text.length > 500) {
        // 长内容 → 使用 Markdown
        await this.sendMarkdownReply(message.sessionWebhook, result.text, {
          senderId: message.senderId,
        });
      } else {
        // 短内容 → 使用文本
        await this.sendReply(message.sessionWebhook, result.text, {
          senderId: message.senderId,
        });
      }

      // 如果有工具调用，附加简要摘要
      if (result.toolCalls && result.toolCalls.length > 0) {
        logger.info('Tool calls executed', {
          count: result.toolCalls.length,
          tools: result.toolCalls.map((tc) => tc.name),
          iterations: result.iterations,
        });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error handling message', { error: errMsg });

      // 尝试发送错误消息
      try {
        let sessionWebhook = '';
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data || {};
          sessionWebhook = data.sessionWebhook || '';
        } catch {
          // ignore
        }
        if (sessionWebhook) {
          await this.sendReply(sessionWebhook, `抱歉，处理消息时出错: ${errMsg.substring(0, 200)}`);
        }
      } catch {
        logger.error('Failed to send error reply');
      }
    }
  }

  /**
   * 发送文本回复
   */
  private async sendReply(
    sessionWebhook: string,
    content: string,
    at?: { senderId?: string }
  ): Promise<void> {
    if (!sessionWebhook) {
      logger.warn('No sessionWebhook, cannot send reply');
      return;
    }

    const body: DingTalkReplyBody = {
      msgtype: 'text',
      text: {
        content: content.substring(0, 20000), // 钉钉文本消息限制
      },
    };

    // 如果指定了 senderId，@ 该用户
    if (at?.senderId) {
      body.at = {
        atUserIds: [at.senderId],
        isAtAll: false,
      };
    }

    const accessToken = await this.dingtalkClient.getAccessToken();

    const response = await fetch(sessionWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-acs-dingtalk-access-token': accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const respText = await response.text();
      throw new Error(`Failed to send reply: ${response.status} ${respText}`);
    }
  }

  /**
   * 发送 Markdown 回复（用于长内容）
   */
  private async sendMarkdownReply(
    sessionWebhook: string,
    content: string,
    at?: { senderId?: string }
  ): Promise<void> {
    if (!sessionWebhook) return;

    // 截取合适长度（钉钉 markdown 约 20000 字符限制）
    const truncated = content.substring(0, 18000);
    const suffix = content.length > 18000 ? '\n\n> *(内容过长，已截断)*' : '';

    const body: any = {
      msgtype: 'markdown',
      markdown: {
        title: 'AI 回复',
        text: truncated + suffix,
      },
    };

    if (at?.senderId) {
      body.at = {
        atUserIds: [at.senderId],
        isAtAll: false,
      };
    }

    const accessToken = await this.dingtalkClient.getAccessToken();

    const response = await fetch(sessionWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-acs-dingtalk-access-token': accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // 如果 markdown 发送失败，尝试发送普通文本
      const respText = await response.text();
      logger.warn('Markdown reply failed, falling back to text', { status: response.status, error: respText });
      await this.sendReply(sessionWebhook, content, at);
    }
  }

  /**
   * 发送卡片模板回复
   * @param sessionWebhook 会话 webhook URL
   * @param content 消息内容
   * @param cardData 卡片模板数据（动态变量）
   * @param at 是否 @ 用户
   */
  private async sendCardReply(
    sessionWebhook: string,
    content: string,
    cardData?: Record<string, any>,
    at?: { senderId?: string }
  ): Promise<void> {
    if (!sessionWebhook) return;

    const templateId = cardData?.templateId || this.config.dingtalk.templateId;
    if (!templateId) {
      // 如果没有模板 ID，回退到 Markdown
      logger.warn('No template ID available, falling back to markdown');
      await this.sendMarkdownReply(sessionWebhook, content, at);
      return;
    }

    // 构建卡片消息体
    const body: DingTalkReplyBody = {
      msgtype: 'interactive',
      interactive: {
        card: {
          version: '1.0',
          config: {
            wideScreenMode: true,
          },
          header: {
            title: {
              tag: 'plain_text',
              content: 'AI 助手',
            },
            template: templateId,
          },
          // 动态内容
          i18n_data: {
            en_US: {
              card_content: content,
              ...(cardData?.i18n_data?.en_US || {}),
            },
            zh_CN: {
              card_content: content,
              ...(cardData?.i18n_data?.zh_CN || {}),
            },
          },
        },
      },
    };

    if (at?.senderId) {
      body.at = {
        atUserIds: [at.senderId],
        isAtAll: false,
      };
    }

    const accessToken = await this.dingtalkClient.getAccessToken();

    const response = await fetch(sessionWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-acs-dingtalk-access-token': accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const respText = await response.text();
      logger.warn('Card reply failed, falling back to markdown', {
        status: response.status,
        error: respText,
      });
      await this.sendMarkdownReply(sessionWebhook, content, at);
    }
  }

  /**
   * 获取会话历史（最近 N 条）
   */
  private getConversationHistory(conversationId: string): ConversationEntry[] {
    const entries = this.conversationCache.get(conversationId);
    if (!entries) return [];
    // 返回最近的条目
    return entries.slice(-this.maxHistorySize);
  }

  /**
   * 添加消息到会话历史
   */
  private addToConversationHistory(conversationId: string, entry: ConversationEntry): void {
    let entries = this.conversationCache.get(conversationId);
    if (!entries) {
      entries = [];
      this.conversationCache.set(conversationId, entries);
    }

    entries.push(entry);

    // 只保留最近的消息
    if (entries.length > this.maxHistorySize * 2) {
      entries.splice(0, entries.length - this.maxHistorySize);
    }

    // 清理旧会话（超过 1 小时未活动）
    this.cleanupOldConversations();
  }

  /**
   * 清理旧会话
   */
  private cleanupOldConversations(): void {
    const maxAge = 60 * 60 * 1000; // 1 小时
    const now = Date.now();

    for (const [id, entries] of this.conversationCache.entries()) {
      const lastEntry = entries[entries.length - 1];
      if (lastEntry && now - lastEntry.timestamp > maxAge) {
        this.conversationCache.delete(id);
        logger.debug('Cleaned up old conversation', { conversationId: id });
      }
    }

    // 如果缓存太大，清理最旧的
    if (this.conversationCache.size > 100) {
      let oldestId = '';
      let oldestTime = Infinity;
      for (const [id, entries] of this.conversationCache.entries()) {
        const lastTime = entries[entries.length - 1]?.timestamp || 0;
        if (lastTime < oldestTime) {
          oldestTime = lastTime;
          oldestId = id;
        }
      }
      if (oldestId) {
        this.conversationCache.delete(oldestId);
      }
    }
  }
}