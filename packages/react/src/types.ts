export interface Readable<T> {
  get(): T;
  peek(): T;
}
