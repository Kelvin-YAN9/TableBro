/**
 * OpenAI Function Calling 工具定义类型
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * 工具执行上下文
 */
export interface ToolContext {
  senderId?: string;
  conversationId?: string;
  [key: string]: any;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}