"use client";

import { FormEvent } from "react";
import { ChatMessage } from "../chatTypes";

type ChatPanelProps = {
  eyebrow: string;
  input: string;
  isStreaming: boolean;
  messages: ChatMessage[];
  runtimeStatus?: string;
  streamSize?: number;
  onInputChange(value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  onStop(): void;
};

export function ChatPanel({
  eyebrow,
  input,
  isStreaming,
  messages,
  runtimeStatus,
  streamSize,
  onInputChange,
  onSubmit,
  onStop,
}: ChatPanelProps) {
  return (
    <section className="chat-panel" aria-label={eyebrow}>
      <div className="chat-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>Streaming Chatbot</h2>
          {runtimeStatus ? (
            <p className="runtime-meta">
              stream: <span>{runtimeStatus}</span>
              {typeof streamSize === "number" ? ` / ${streamSize} chars` : ""}
            </p>
          ) : null}
        </div>
        <span className="status-pill">{isStreaming ? "streaming" : "idle"}</span>
      </div>

      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <p className="message-role">{message.role}</p>
            <p className="message-content">
              {message.content || (message.status === "streaming" ? "..." : "")}
            </p>
            {message.status && message.status !== "done" ? (
              <p className="message-status">{message.status}</p>
            ) : null}
          </article>
        ))}
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={`${eyebrow}-chat-input`}>
          Message
        </label>
        <input
          autoComplete="off"
          id={`${eyebrow}-chat-input`}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask about how this stream is wired..."
          type="text"
          value={input}
        />
        {isStreaming ? (
          <button type="button" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit">Send</button>
        )}
      </form>
    </section>
  );
}
