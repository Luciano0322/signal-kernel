export type SearchMode = "naive" | "signal-kernel";

export type SearchEventPhase =
  | "start"
  | "resolve"
  | "resolve-ignored"
  | "commit";

export interface SearchResult {
  query: string;
  items: string[];
  delay: number;
}

export interface SearchEvent {
  id: number;
  mode: SearchMode;
  phase: SearchEventPhase;
  query: string;
  delay: number;
  at: number;
}
