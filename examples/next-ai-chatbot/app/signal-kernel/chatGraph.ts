import { createStreamResource } from "@signal-kernel/async-runtime";
import { signal } from "@signal-kernel/core";
import { ChatMessage, toApiMessages } from "../chatTypes";

function createChatGraph(source: ChatMessage[] | null) {
  const assistantStream = createStreamResource<
    ChatMessage[] | null,
    string,
    string,
    Error
  >(
    () => source,
    async (messages, ctx) => {
      if (!messages) {
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApiMessages(messages) }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed with ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = "";

      while (!ctx.isCancelled()) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        content += chunk;
        ctx.emit(chunk);
      }

      if (ctx.isCancelled()) return;

      ctx.done(content);
    },
    {
      initialValue: "",
      reduce: (current, chunk) => `${current ?? ""}${chunk}`,
      onCancel: "keep-partial",
      onError: "keep-partial",
    },
  );

  return assistantStream;
}

