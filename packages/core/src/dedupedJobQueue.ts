export interface DedupedJobQueue<T extends object> {
  readonly size: number;
  enqueue(value: T): void;
  shift(): T | undefined;
  clear(): void;
}

const QueueSlot: unique symbol = Symbol("DedupedJobQueueSlot");

type QueueEntry<T extends object> = {
  value: T;
  prev: QueueEntry<T> | null;
  next: QueueEntry<T> | null;
};

type QueuedValue<T extends object> = T & {
  [QueueSlot]?: QueueEntry<T>;
};

function getEntry<T extends object>(value: T): QueueEntry<T> | undefined {
  return (value as QueuedValue<T>)[QueueSlot];
}

function setEntry<T extends object>(value: T, entry: QueueEntry<T>) {
  Object.defineProperty(value, QueueSlot, {
    value: entry,
    enumerable: false,
    configurable: true,
  });
}

function clearEntry<T extends object>(value: T) {
  Reflect.deleteProperty(value, QueueSlot);
}

export function createDedupedJobQueue<T extends object>(): DedupedJobQueue<T> {
  let head: QueueEntry<T> | null = null;
  let tail: QueueEntry<T> | null = null;
  let size = 0;

  return {
    get size() {
      return size;
    },

    enqueue(value) {
      if (getEntry(value)) return;

      const entry: QueueEntry<T> = {
        value,
        prev: tail,
        next: null,
      };

      if (tail) {
        tail.next = entry;
      } else {
        head = entry;
      }

      tail = entry;
      size++;
      setEntry(value, entry);
    },

    shift() {
      if (!head) return undefined;

      const entry = head;
      head = entry.next;

      if (head) {
        head.prev = null;
      } else {
        tail = null;
      }

      entry.next = null;
      entry.prev = null;
      size--;
      clearEntry(entry.value);

      return entry.value;
    },

    clear() {
      while (head) {
        const next = head.next;
        clearEntry(head.value);
        head.prev = null;
        head.next = null;
        head = next;
      }

      tail = null;
      size = 0;
    },
  };
}
