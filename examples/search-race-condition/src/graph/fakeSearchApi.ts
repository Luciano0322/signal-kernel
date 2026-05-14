import type { ResourceContext } from "@signal-kernel/async-runtime";
import type { SearchEvent, SearchMode, SearchResult } from "./types";

const forcedDelays: Record<string, number> = {
  a: 3000,
  ab: 2000,
  abc: 1000,
};

let nextRequestId = 0;

export function resetFakeSearchRequestIds() {
  nextRequestId = 0;
}

export function getSearchDelay(query: string) {
  return forcedDelays[query] ?? 250;
}

export function createSearchResult(query: string): SearchResult {
  return {
    query,
    delay: getSearchDelay(query),
    items: query.trim()
      ? [
          `${query} result: deterministic graph`,
          `${query} result: latest-wins resource`,
          `${query} result: renderer-independent logic`,
        ]
      : [],
  };
}

export function runFakeSearch(
  query: string,
  mode: SearchMode,
  recordEvent: (event: SearchEvent) => void,
  ctx?: ResourceContext,
): Promise<SearchResult> {
  if (!query.trim()) {
    return Promise.resolve(createSearchResult(query));
  }

  const id = ++nextRequestId;
  const delay = getSearchDelay(query);

  recordEvent({
    id,
    mode,
    phase: "start",
    query,
    delay,
    at: Date.now(),
  });

  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      const aborted = ctx?.signal.aborted ?? false;

      recordEvent({
        id,
        mode,
        phase: aborted ? "resolve-ignored" : "resolve",
        query,
        delay,
        at: Date.now(),
      });

      resolve(createSearchResult(query));
    }, delay);
  });
}
