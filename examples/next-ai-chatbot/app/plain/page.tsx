import { ChatRouteShell } from "../components/ChatRouteShell";
import { PlainChatPanel } from "./PlainChatPanel";

export default function PlainPage() {
  return (
    <ChatRouteShell active="plain">
      <PlainChatPanel />
    </ChatRouteShell>
  );
}
