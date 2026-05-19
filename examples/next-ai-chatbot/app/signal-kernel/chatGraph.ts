import { createStreamResource } from "@signal-kernel/async-runtime";
import { batch, computed, signal } from "@signal-kernel/core";
import { ChatMessage, createId, toApiMessages } from "../chatTypes";

function createWelcomeMessage(): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    content:
      "Ask a question and I will stream through signal-kernel before React renders it.",
    status: "done",
  };
}

function createUserMessage(content: string): ChatMessage {
  return {
    id: createId(),
    role: "user",
    content,
    status: "done",
  };
}

function createAssistantDraft(): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    content: "",
    status: "streaming",
  };
}

export function createChatGraph() {
  const input = signal("");
  const messages = signal<ChatMessage[]>([createWelcomeMessage()]);
  const activeAssistant = signal<ChatMessage | null>(null);
  const request = signal<ChatMessage[] | null>(null);

  function commitAssistant(content: string, status: ChatMessage["status"]) {
    const assistant = activeAssistant.peek();

    if (!assistant) return;

    batch(() => {
      messages.set([
        ...messages.peek(),
        {
          ...assistant,
          content,
          status,
        },
      ]);
      activeAssistant.set(null);
      request.set(null);
    });
  }

  const stream = createStreamResource<ChatMessage[] | null, string, string, Error>(
    () => request.get(),
    async (requestMessages, ctx) => {
      if (!requestMessages) {
        ctx.done("");
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApiMessages(requestMessages) }),
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
      onSuccess: (content) => {
        commitAssistant(content, "done");
      },
      onErrorEffect: () => {
        commitAssistant("Something went wrong.", "error");
      },
    },
  );

  const [streamText, streamMeta] = stream;
  const canSubmit = computed(() => {
    return input.get().trim().length > 0 && activeAssistant.get() === null;
  });

  function setInput(value: string) {
    input.set(value);
  }

  function submit() {
    const prompt = input.peek().trim();

    if (!prompt || activeAssistant.peek()) return;

    const userMessage = createUserMessage(prompt);
    const assistantDraft = createAssistantDraft();
    const requestMessages = [...messages.peek(), userMessage];

    batch(() => {
      input.set("");
      messages.set(requestMessages);
      activeAssistant.set(assistantDraft);
      request.set(requestMessages);
    });
  }

  function cancel() {
    if (!activeAssistant.peek()) return;

    streamMeta.cancel();
    commitAssistant(streamText() || "Stopped.", "aborted");
  }

  return {
    input,
    messages,
    activeAssistant,
    canSubmit,
    stream,
    actions: {
      setInput,
      submit,
      cancel,
    },
  };
}

export type ChatGraph = ReturnType<typeof createChatGraph>;
