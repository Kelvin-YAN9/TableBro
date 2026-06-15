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
  at?: {
    atUserIds: string[];
    isAtAll: boolean;
  };
}