/**
 * 钉钉消息类型
 */
export interface DingTalkMessage {
  content: string;
  senderId: string;
  senderNick: string;
  conversationId: string;
  sessionWebhook: string;
  timestamp: number;
}

export interface DingTalkReplyBody {
  msgtype: 'text' | 'markdown' | 'interactive';
  text?: {
    content: string;
  };
  markdown?: {
    title: string;
    text: string;
  };
  // 交互式卡片消息
  interactive?: {
    card: {
      // 钉钉卡片数据结构
      version: string;
      config: {
        wideScreenMode: boolean;
      };
      header?: {
        title?: { tag: string; content: string };
        template?: string;
      };
      // 动态内容
      i18n_data?: {
        [lang: string]: {
          [key: string]: any;
        };
      };
      [key: string]: any;
    };
  };
  at?: {
    atUserIds: string[];
    isAtAll: boolean;
  };
}