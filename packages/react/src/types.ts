export interface Readable<T> {
  get(): T;
  peek(): T;
}

export type ReadStrategy = "get" | "peek";

export type UseReactiveOptions<T> = {
  snapshot?: () => T;
  track?: () => T;
  getServerSnapshot?: () => T;
  equals?: (prev: T, next: T) => boolean;
};