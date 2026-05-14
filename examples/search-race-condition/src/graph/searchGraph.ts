import { signal } from "@signal-kernel/core";
import { createResource } from "@signal-kernel/async-runtime";
import { resetFakeSearchRequestIds, runFakeSearch } from "./fakeSearchApi";
import type { SearchEvent, SearchResult } from "./types";

export function createSearchRaceGraph() {
  const query = signal("");
  const eventLog = signal<SearchEvent[]>([]);

  function recordEvent(event: SearchEvent) {
    eventLog.set([...eventLog.peek(), event]);
  }

  const searchResource = createResource<string, SearchResult>(
    query.get,
    (currentQuery, ctx) =>
      runFakeSearch(currentQuery, "signal-kernel", recordEvent, ctx),
    {
      keepPreviousValueOnPending: true,
    },
  );

  function clearEvents() {
    resetFakeSearchRequestIds();
    eventLog.set([]);
  }

  return {
    query,
    eventLog,
    recordEvent,
    searchResource,
    clearEvents,
  };
}

export const searchRaceGraph = createSearchRaceGraph();
