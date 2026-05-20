import type { MemoryRuntimeEvent } from "../../memory/types";

type TimelinePanelProps = {
  events: MemoryRuntimeEvent[];
};

function eventDetail(event: MemoryRuntimeEvent) {
  switch (event.type) {
    case "turn.created":
      return event.message;
    case "recall.started":
      return event.query;
    case "recall.cancelled":
      return event.reason;
    case "recall.resolved":
      return event.factIds.join(", ");
    case "prompt.rendered":
      return "prompt derived from recalled facts";
    case "stream.started":
      return "model stream opened";
    case "stream.chunk":
      return event.chunk;
    case "stream.completed":
      return event.value;
    case "extract.started":
      return "candidate extraction started";
    case "extract.resolved":
      return `${event.candidates.length} candidate facts`;
    case "consolidation.planned":
      return `${event.plan.actions.length} planned actions`;
    case "retain.started":
      return `${event.plan.actions.length} actions`;
    case "retain.committed":
      return `memory v${event.snapshot.version}`;
    case "retain.rolled_back":
      return event.error;
    case "snapshot.created":
      return event.label;
  }
}

export function TimelinePanel({ events }: TimelinePanelProps) {
  return (
    <section className="panel timeline-panel" aria-label="Runtime timeline">
      <div className="panel-heading">
        <p className="eyebrow">Timeline</p>
        <h2>Lifecycle events</h2>
      </div>
      <ol className="timeline-list">
        {events.map((event) => (
          <li key={`${event.type}-${event.timestamp}`}>
            <span className="event-type">{event.type}</span>
            {"turnId" in event ? <small>{event.turnId}</small> : null}
            <p>{eventDetail(event)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
