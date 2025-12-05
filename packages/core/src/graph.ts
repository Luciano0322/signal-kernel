export type Kind = 'signal' | 'computed' | 'effect';

export interface Node {
  kind: Kind;
  deps: Set<Node>;
  subs: Set<Node>;
}

export function link(from: Node, to: Node) {
  if (from.kind === 'signal') throw new Error('Signal nodes cannot depend on others');
  if (from.deps.has(to)) return;
  from.deps.add(to);
  to.subs.add(from);
}

export function unlink(from: Node, to: Node) {
  from.deps.delete(to);
  to.subs.delete(from);
}

let currentObserver: Node | null = null;

export function withObserver<T>(obs: Node, fn: () => T): T {
  const prev = currentObserver;
  currentObserver = obs;
  try {
    return fn();
  } finally { 
    currentObserver = prev;
  }
}

export function track(dep: Node) {
  if (!currentObserver) return;
  link(currentObserver, dep);
}
