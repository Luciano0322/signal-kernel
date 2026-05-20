"use client";

import { FormEvent, useRef, useState } from "react";
import { ChatPanel } from "../components/ChatPanel";
import { ChatMessage, createId, toApiMessages } from "../chatTypes";

export function PlainChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      content: "Ask a question and I will stream a mock response from a Next route handler.",
      status: "done",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = input.trim();

    if (!prompt || isStreaming) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: prompt,
      status: "done",
    };
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      content: "",
      status: "streaming",
    };
    const nextMessages = [...messages, userMessage];
    const controller = new AbortController();

    abortRef.current = controller;
    setInput("");
    setIsStreaming(true);
    setMessages([...nextMessages, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: toApiMessages(nextMessages) }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed with ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        content += decoder.decode(value, { stream: true });

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content, status: "streaming" }
              : message,
          ),
        );
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content, status: "done" }
            : message,
        ),
      );
    } catch {
      const aborted = controller.signal.aborted;

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                content:
                  message.content || (aborted ? "Stopped." : "Something went wrong."),
                status: aborted ? "aborted" : "error",
              }
            : message,
        ),
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      setIsStreaming(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  return (
    <ChatPanel
      eyebrow="Plain React"
      architectureRows={[
        { label: "State owner", value: "React useState" },
        { label: "Stream owner", value: "fetch reader loop inside component" },
        { label: "Policy owner", value: "handleSubmit, catch, stopStreaming" },
        { label: "Render bridge", value: "setMessages on every chunk" },
      ]}
      canSubmit={input.trim().length > 0 && !isStreaming}
      input={input}
      isStreaming={isStreaming}
      messages={messages}
      ownershipLabel="Policy lives in component state: messages, abortRef, partial draft, status."
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onStop={stopStreaming}
    />
  );
}
