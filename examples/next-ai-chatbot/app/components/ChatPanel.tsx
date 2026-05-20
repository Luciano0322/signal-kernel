"use client";

import { FormEvent } from "react";
import { ChatMessage } from "../chatTypes";

type ArchitectureRow = {
  label: string;
  value: string;
};

type ChatPanelProps = {
  eyebrow: string;
  input: string;
  isStreaming: boolean;
  messages: ChatMessage[];
  architectureRows?: ArchitectureRow[];
  canSubmit?: boolean;
  policyLabel?: string;
  ownershipLabel?: string;
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
  architectureRows = [],
  canSubmit = input.trim().length > 0 && !isStreaming,
  policyLabel = "single active stream / keep partial on interrupt",
  ownershipLabel,
  runtimeStatus,
  streamSize,
  onInputChange,
  onSubmit,
  onStop,
}: ChatPanelProps) {
  const fieldId = `${eyebrow.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-chat-input`;
  const policyId = `${fieldId}-policy`;
  const hasArchitectureRows = architectureRows.length > 0;

  return (
    <section
      className={`chat-panel${hasArchitectureRows ? " with-architecture" : ""}`}
      aria-label={eyebrow}
    >
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
          <p className="policy-meta">{policyLabel}</p>
          {ownershipLabel ? (
            <p className="ownership-meta">{ownershipLabel}</p>
          ) : null}
        </div>
        <span className="status-pill">{isStreaming ? "streaming" : "idle"}</span>
      </div>

      {hasArchitectureRows ? (
        <dl className="architecture-panel" aria-label="Runtime ownership">
          {architectureRows.map((row) => (
            <div className="architecture-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

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
        <label className="sr-only" htmlFor={fieldId}>
          Message
        </label>
        <input
          autoComplete="off"
          aria-describedby={policyId}
          id={fieldId}
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
          <button disabled={!canSubmit} type="submit">
            Send
          </button>
        )}
      </form>
      <p className="submit-policy" id={policyId}>
        {isStreaming
          ? "Submit is locked until this assistant stream finishes or is stopped."
          : "Submit starts one assistant stream."}
      </p>
    </section>
  );
}
