import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { TOOL_DEFINITIONS } from "./lib/agent/tool-definitions";
import { runAgentLoop } from "./lib/agent/loop";
import { keywordFallback } from "./lib/agent/fallback";
import { type AnthropicMessage } from "./lib/agent/types";
import { env } from "./lib/env";

export const agentRouter = createRouter({
  chat: authedQuery
    .input(z.object({
      mensaje: z.string().min(1),
      sessionId: z.string().optional(),
      historial: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { mensaje, historial } = input;
      const userId = ctx.user.id;

      if (!env.anthropicApiKey) {
        return keywordFallback(mensaje);
      }

      const messages: AnthropicMessage[] = [];

      if (historial && historial.length > 0) {
        const recent = historial.slice(-10);
        for (const h of recent) {
          messages.push({ role: h.role, content: h.content });
        }
      }

      messages.push({ role: "user", content: mensaje });

      return runAgentLoop(messages, TOOL_DEFINITIONS, { userId });
    }),
});
