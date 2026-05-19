import Link from "next/link";
import type { ReactNode } from "react";

type ChatRouteShellProps = {
  active: "plain" | "signal-kernel";
  children: ReactNode;
};

export function ChatRouteShell({ active, children }: ChatRouteShellProps) {
  return (
    <main className="chat-shell">
      <div className="comparison-shell">
        <header className="comparison-header">
          <p className="eyebrow">Next.js streaming routes</p>
          <h1>AI Chatbot Comparison</h1>
          <p className="comparison-note">
            Each implementation is its own route. The form and stream reader stay
            inside client components, while the route page and navigation remain
            server-rendered.
          </p>
          <nav className="route-nav" aria-label="Chatbot implementations">
            <Link
              className={`route-nav-link ${active === "plain" ? "active" : ""}`}
              href="/plain"
            >
              Plain React
            </Link>
            <Link
              className={`route-nav-link ${
                active === "signal-kernel" ? "active" : ""
              }`}
              href="/signal-kernel"
            >
              signal-kernel
            </Link>
          </nav>
        </header>

        {children}
      </div>
    </main>
  );
}
