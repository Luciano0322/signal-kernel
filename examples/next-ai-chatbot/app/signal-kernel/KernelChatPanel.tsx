"use client";

import { FormEvent, useMemo } from "react";
import type { StreamAsyncStatus } from "@signal-kernel/async-runtime";
import {
  useComputedValue,
  useSignalValue,
  useStreamResource,
} from "@signal-kernel/react";
import { ChatPanel } from "../components/ChatPanel";
import { ChatMessage, ChatMessageStatus } from "../chatTypes";
import { createChatGraph } from "./chatGraph";

function toAssistantStatus(streamStatus: StreamAsyncStatus): ChatMessageStatus {
  if (streamStatus === "success") return "done";
  if (streamStatus === "error") return "error";
  if (streamStatus === "cancelled") return "aborted";
  return "streaming";
}

export function KernelChatPanel() {
  const graph = useMemo(() => createChatGraph(), []);
  const input = useSignalValue(graph.input);
  const messages = useSignalValue(graph.messages);
  const activeAssistant = useSignalValue(graph.activeAssistant);
  const canSubmit = useComputedValue(graph.canSubmit);
  const [assistantText, assistantStream] = useStreamResource(graph.stream);
  const streamStatus = assistantStream.status();
  const isStreaming =
    activeAssistant !== null &&
    streamStatus !== "success" &&
    streamStatus !== "error" &&
    streamStatus !== "cancelled";
  const runtimeStatus = activeAssistant ? streamStatus : "idle";
  const streamSize = assistantText?.length ?? 0;
  const visibleMessages: ChatMessage[] = activeAssistant
    ? [
        ...messages,
        {
          ...activeAssistant,
          content: assistantText ?? "",
          status: toAssistantStatus(streamStatus),
        },
      ]
    : messages;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canSubmit) {
      graph.actions.submit();
    }
  }

  return (
    <ChatPanel
      eyebrow="signal-kernel"
      architectureRows={[
        { label: "State owner", value: "chatGraph signals and computed values" },
        { label: "Stream owner", value: "createStreamResource tuple" },
        { label: "Policy owner", value: "graph actions and stream meta" },
        { label: "Render bridge", value: "useStreamResource(graph.stream)" },
      ]}
      canSubmit={canSubmit}
      input={input}
      isStreaming={isStreaming}
      messages={visibleMessages}
      ownershipLabel="Policy lives in chatGraph: request signal, stream resource, active assistant draft."
      runtimeStatus={runtimeStatus}
      streamSize={streamSize}
      onInputChange={graph.actions.setInput}
      onSubmit={handleSubmit}
      onStop={graph.actions.cancel}
    />
  );
}
