import type { AnthropicTool, AnthropicMessage, AnthropicContent } from "../anthropic";

export type { AnthropicTool, AnthropicMessage, AnthropicContent };

export interface AgentContext {
  userId: number;
}

export type ToolInput = Record<string, unknown>;
export type ToolResult = string;
