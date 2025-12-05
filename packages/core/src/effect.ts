import { unlink, withObserver, type Node } from "./graph.js";
import { SymbolRegistry as Effects, type EffectInstanceLike } from "./registry.js";
import { scheduleJob } from "./scheduler.js";

type Cleanup = () => void;

function drainCleanups(list: Cleanup[], onError?: (err: unknown) => void) {
  for (let i = list.length - 1; i >= 0; i--) {
    const cb = list[i];
    try {
      cb?.();
    } catch (e) {
      onError?.(e);
    }
  }
  list.length = 0;
}

let activeEffect: EffectInstance | null = null;
export function onCleanup(cb: Cleanup) {
  if (activeEffect) activeEffect.cleanups.push(cb);
}

export class EffectInstance implements EffectInstanceLike {
  node: Node = {
    kind: 'effect',
    deps: new Set(),
    subs: new Set()
  };
  cleanups: Cleanup[] = [];
  disposed = false;

  constructor(private fn: () => void | Cleanup) {
    Effects.set(this.node, this);
  }

  run() {
    if (this.disposed) return;
    drainCleanups(this.cleanups);
    for (const dep of [...this.node.deps]) unlink(this.node, dep);

    activeEffect = this;
    try {
      const ret = withObserver(this.node, this.fn);
      if (typeof ret === 'function') this.cleanups.push(ret);
    } finally {
      activeEffect = null;
    }
  }

  schedule() { scheduleJob(this); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    drainCleanups(this.cleanups);
    for (const dep of [...this.node.deps]) unlink(this.node, dep);
    this.node.deps.clear();

    Effects.delete(this.node);
  }
}

export function createEffect(fn: () => void | Cleanup) {
  const inst = new EffectInstance(fn);
  inst.run();
  return () => inst.dispose();
}
