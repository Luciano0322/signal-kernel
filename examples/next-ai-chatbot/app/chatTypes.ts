export type ChatRole = "user" | "assistant";

export type ChatMessageStatus = "streaming" | "done" | "aborted" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status?: ChatMessageStatus;
};

export function createId() {
  return crypto.randomUUID();
}

export function toApiMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}
