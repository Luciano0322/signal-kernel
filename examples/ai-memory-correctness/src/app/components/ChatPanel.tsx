import type { FormEvent } from "react";
import type { ChatMessage } from "../../model/types";

type ChatPanelProps = {
  canRetain: boolean;
  canSubmit: boolean;
  inputValue: string;
  isStreaming: boolean;
  messages: ChatMessage[];
  onInputChange(value: string): void;
  onRetain(): void;
  onSnapshot(): void;
  onStop(): void;
  onSubmit(): void;
};

export function ChatPanel({
  canRetain,
  canSubmit,
  inputValue,
  isStreaming,
  messages,
  onInputChange,
  onRetain,
  onSnapshot,
  onStop,
  onSubmit,
}: ChatPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="panel chat-panel" aria-label="Chat transcript">
      <div className="panel-heading">
        <p className="eyebrow">Chat</p>
        <h2>Turn lifecycle</h2>
      </div>
      <div className="message-list">
        {messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <p className="message-role">{message.role}</p>
            <p className="message-content">{message.content}</p>
            {message.status !== "done" ? (
              <p className="message-status">{message.status}</p>
            ) : null}
          </article>
        ))}
      </div>
      <form className="composer-preview" onSubmit={handleSubmit}>
        <input
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask about DEV.to, snapshot replay, or memory correctness."
          type="text"
          value={inputValue}
        />
        <button disabled={!canSubmit} type="submit">
          Submit
        </button>
        <button disabled={!isStreaming} onClick={onStop} type="button">
          Stop
        </button>
        <button disabled={!canRetain} onClick={onRetain} type="button">
          Retain
        </button>
        <button onClick={onSnapshot} type="button">
          Snapshot
        </button>
      </form>
    </section>
  );
}
