import { ChatRouteShell } from "../components/ChatRouteShell";
import { KernelChatPanel } from "./KernelChatPanel";

export default function SignalKernelPage() {
  return (
    <ChatRouteShell active="signal-kernel">
      <KernelChatPanel />
    </ChatRouteShell>
  );
}
