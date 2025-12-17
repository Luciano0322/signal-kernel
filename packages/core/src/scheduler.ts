import { markStale } from "./computed.js";
import { type Node } from "./graph.js";

export interface Schedulable { run(): void; disposed?: boolean };

type JobKind = 'computed' | 'effect';
interface Job extends Schedulable { kind?: JobKind; priority?: number };

export type InternalNode<T = unknown> = { value: T };

type WriteLog = Map<(Node & InternalNode<unknown>), unknown>;

const computeQ = new Set<Job>();
const effectQ  = new Set<Job>();

let scheduled = false;
let batchDepth = 0;

let atomicDepth = 0;
const atomicLogs: WriteLog[] = [];

let muted = 0;

export function scheduleJob(job: Schedulable) {
  const j = job as Job;
  if (j.disposed) return;
  if (muted > 0) return;

  const kind: JobKind = (j.kind ?? 'effect');
  if (kind === 'computed') computeQ.add(j);
  else effectQ.add(j);

  if (!scheduled && batchDepth === 0) {
    scheduled = true;
    queueMicrotask(flushJobsTwoPhase);
  }
}

export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) flushJobsTwoPhase();
  }
}

function isPromiseLike<T = unknown>(v: any): v is PromiseLike<T> {
  return v != null && typeof v.then === "function";
}

export function transaction<T>(fn: () => T): T;
export function transaction<T>(fn: () => Promise<T>): Promise<T>;
export function transaction<T>(fn: () => T | Promise<T>): T | Promise<T> {
  return atomic(fn);
}

export function inAtomic() {
  return atomicDepth > 0;
}

export function recordAtomicWrite<T>(node: Node & InternalNode<T>, prevValue: T) {
  const log = atomicLogs[atomicLogs.length - 1];
  if (!log) return;
  if (!log.has(node)) log.set(node, prevValue);
}

export function writeNodeValue<T>(node: Node & InternalNode<T>, v: T) {
  if ("value" in node) (node as { value: T }).value = v;
}

function mergeChildIntoParent(child: WriteLog, parent: WriteLog) {
  for (const [node, prev] of child) {
    if (!parent.has(node)) parent.set(node, prev);
  }
}

function restoreSignalAndMarkStale(node: Node & InternalNode<unknown>, prev: unknown) {
  writeNodeValue(node, prev);
  if (node.kind === "signal") {
    for (const sub of node.subs) {
      if (sub.kind === "computed") markStale(sub);
    }
  }
}

export function atomic<T>(fn: () => T): T;
export function atomic<T>(fn: () => Promise<T>): Promise<T>;
export function atomic<T>(fn: () => T | Promise<T>): T | Promise<T> {
  batchDepth++;
  atomicDepth++;
  atomicLogs.push(new Map<(Node & InternalNode<unknown>), unknown>());

  const exitCommit = () => {
    const log = atomicLogs.pop()!;
    atomicDepth--;
    if (atomicDepth > 0) {
      mergeChildIntoParent(log, atomicLogs[atomicLogs.length - 1]!);
    }
    batchDepth--;
    if (batchDepth === 0) flushJobsTwoPhase();
  };

  const exitRollback = () => {
    const log = atomicLogs.pop()!;
    atomicDepth--;
    muted++;
    try {
      for (const [node, prev] of log) {
        restoreSignalAndMarkStale(node, prev);
      }
      computeQ.clear();
      effectQ.clear();
      scheduled = false;
    } finally {
      muted--;
    }
    batchDepth--;
  };

  try {
    const out = fn();
    if (isPromiseLike<T>(out)) {
      return Promise.resolve(out).then(
        (v) => { exitCommit(); return v; },
        (err) => { exitRollback(); throw err; }
      );
    }
    exitCommit();
    return out as T;
  } catch (e) {
    exitRollback();
    throw e;
  }
}

export function flushSync() {
  if (!scheduled && computeQ.size === 0 && effectQ.size === 0) return;
  flushJobsTwoPhase();
}

function flushJobsTwoPhase() {
  scheduled = false;
  let guard = 0;

  while (computeQ.size > 0 || effectQ.size > 0) {
    if (++guard > 10000) throw new Error("Infinite update loop");
    while (computeQ.size > 0) {
      const batch = Array.from(computeQ);
      computeQ.clear();
      for (const job of batch) {
        (job as Job).kind = 'computed';
        job.run();
      }
    }
    if (effectQ.size > 0) {
      const batch = Array.from(effectQ).sort((a, b) =>
        ((a as Job).priority ?? 0) - ((b as Job).priority ?? 0)
      );
      effectQ.clear();
      for (const job of batch) {
        (job as Job).kind = 'effect';
        job.run();
      }
    }
  }
}
