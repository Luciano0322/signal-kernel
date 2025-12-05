import { unlink, withObserver, track, type Node } from "./graph.js";
import { SymbolRegistry as Effects } from "./registry.js";

type Comparator<T> = (a: T, b: T) => boolean;
const defaultEquals = Object.is;

export function markStale(node: Node) {
  if (node.kind !== "computed") return;
  const c = node as Node & { stale: boolean };
  if (c.stale) return;
  c.stale = true;

  for (const sub of node.subs) {
    if (sub.kind === "computed") {
      markStale(sub);
    } else if (sub.kind === "effect") {
      Effects.get(sub)?.schedule();
    }
  }
}

export function computed<T>(
  fn: () => T,
  equals: Comparator<T> = defaultEquals
) {
  const node: Node & {
    kind: "computed";
    value: T;
    stale: boolean;
    equals: Comparator<T>;
    computing: boolean;
    hasValue: boolean;
  } = {
    kind: "computed",
    deps: new Set(),
    subs: new Set(),
    value: undefined as unknown as T,
    stale: true,
    equals,
    computing: false,
    hasValue: false,
  };

  function recompute() {
    if (node.computing) throw new Error("Cycle detected in computed");
    node.computing = true;

    for (const d of [...node.deps]) unlink(node, d);

    const next = withObserver(node, fn);

    if (!node.hasValue || !node.equals(node.value, next)) {
      node.value = next;
      node.hasValue = true;
    }
    node.stale = false;
    node.computing = false;
  }

  const get = () => {
    track(node);
    if (node.stale || !node.hasValue) recompute();
    return node.value;
  };

  const peek = () => node.value;

  const dispose = () => {
    for (const d of [...node.deps]) unlink(node, d);
    for (const s of [...node.subs]) unlink(s, node);
    node.deps.clear();
    node.subs.clear();
    node.stale = true;
    node.hasValue = false;
  };

  return { get, peek, dispose };
}
