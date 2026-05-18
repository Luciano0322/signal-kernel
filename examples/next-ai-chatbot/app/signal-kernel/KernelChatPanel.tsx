"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { StreamAsyncStatus } from "@signal-kernel/async-runtime";
import { ChatPanel } from "../components/ChatPanel";
import { ChatMessage, ChatMessageStatus, createId } from "../chatTypes";
import { chatGraph } from "./chatGraph";
import { useStreamResourceSnapshot } from "./useStreamResourceSnapshot";

type AssistantDraft = {
  id: string;
};

function createWelcomeMessage(): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    content:
      "Ask a question and I will stream through signal-kernel before React renders it.",
    status: "done",
  };
}

function toAssistantStatus(streamStatus: StreamAsyncStatus): ChatMessageStatus {
  if (streamStatus === "success") return "done";
  if (streamStatus === "error") return "error";
  if (streamStatus === "cancelled") return "aborted";
  return "streaming";
}

export function KernelChatPanel() {
  const assistantStream = useStreamResourceSnapshot(
    chatGraph.resources.assistantStream,
  );
  const assistantText = assistantStream.value;
  const streamStatus = assistantStream.status;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(),
  ]);
  const [activeAssistant, setActiveAssistant] =
    useState<AssistantDraft | null>(null);
  const [input, setInput] = useState("");
  const committedAssistantIdRef = useRef<string | null>(null);

  const hasActiveAssistant = activeAssistant !== null;
  const isStreaming =
    hasActiveAssistant &&
    streamStatus !== "success" &&
    streamStatus !== "error" &&
    streamStatus !== "cancelled";
  const runtimeStatus = hasActiveAssistant ? streamStatus : "idle";
  const streamSize = assistantText?.length ?? 0;

  const visibleMessages: ChatMessage[] = activeAssistant
    ? [
        ...messages,
        {
          id: activeAssistant.id,
          role: "assistant",
          content: assistantText ?? "",
          status: toAssistantStatus(streamStatus),
        },
      ]
    : messages;

  useEffect(() => {
    if (!activeAssistant) return;
    if (
      streamStatus !== "success" &&
      streamStatus !== "error" &&
      streamStatus !== "cancelled"
    ) {
      return;
    }
    if (committedAssistantIdRef.current === activeAssistant.id) return;

    committedAssistantIdRef.current = activeAssistant.id;
    setMessages((current) => [
      ...current,
      {
        id: activeAssistant.id,
        role: "assistant",
        content:
          assistantText ||
          (streamStatus === "cancelled" ? "Stopped." : "Something went wrong."),
        status: toAssistantStatus(streamStatus),
      },
    ]);
    setActiveAssistant(null);
  }, [activeAssistant, assistantText, streamStatus]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = input.trim();

    if (!prompt || activeAssistant) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: prompt,
      status: "done",
    };
    const assistantDraft: AssistantDraft = {
      id: createId(),
    };
    const requestMessages = [...messages, userMessage];

    committedAssistantIdRef.current = null;
    setInput("");
    setMessages(requestMessages);
    setActiveAssistant(assistantDraft);
    chatGraph.actions.requestAssistant(requestMessages);
  }

  function stopStreaming() {
    assistantStream.cancel();
  }

  return (
    <ChatPanel
      eyebrow="signal-kernel"
      input={input}
      isStreaming={isStreaming}
      messages={visibleMessages}
      runtimeStatus={runtimeStatus}
      streamSize={streamSize}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onStop={stopStreaming}
    />
  );
}
