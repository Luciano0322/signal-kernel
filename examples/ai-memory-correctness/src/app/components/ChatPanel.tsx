import type { ChatMessage } from "../../model/types";

type ChatPanelProps = {
  messages: ChatMessage[];
};

export function ChatPanel({ messages }: ChatPanelProps) {
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
      <div className="composer-preview">
        <input
          disabled
          placeholder="Task 1 keeps the shell static; graph actions arrive later."
          type="text"
        />
        <button disabled type="button">
          Submit
        </button>
      </div>
    </section>
  );
}
