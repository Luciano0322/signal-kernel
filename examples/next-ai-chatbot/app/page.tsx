import Link from "next/link";

export default function Page() {
  return (
    <main className="chat-shell">
      <section className="comparison-shell">
        <header className="comparison-header">
          <p className="eyebrow">Next.js streaming routes</p>
          <h1>AI Chatbot Comparison</h1>
          <p className="comparison-note">
            Pick a route to compare the same mock AI stream with and without
            signal-kernel owning the stream state.
          </p>
        </header>

        <div className="route-card-grid">
          <Link className="route-card" href="/plain">
            <span>Plain React</span>
            <small>Component state owns the stream reader and assistant message.</small>
          </Link>
          <Link className="route-card" href="/signal-kernel">
            <span>signal-kernel</span>
            <small>The graph owns messages, active request, and stream state.</small>
          </Link>
        </div>
      </section>
    </main>
  );
}
