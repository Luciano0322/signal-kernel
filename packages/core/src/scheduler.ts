import { markStale } from "./computed.js";
import { type Node } from "./graph.js";

export interface Schedulable { run(): void; disposed?: boolean };

// 可選：在 enqueue 時提供 kind 與 priority。未提供 kind 時預設為 'effect'。
type JobKind = 'computed' | 'effect';
interface Job extends Schedulable { kind?: JobKind; priority?: number };

export type InternalNode<T = unknown> = { value: T };

type WriteLog = Map<(Node & InternalNode<unknown>), unknown>;

// ===== two-phase queues =====
const computeQ = new Set<Job>(); // 全部視為 computed
const effectQ  = new Set<Job>(); // 可依 priority 排序

let scheduled = false;
let batchDepth = 0;

let atomicDepth = 0;
const atomicLogs: WriteLog[] = [];

let muted = 0;

// adjust for two queue
export function scheduleJob(job: Schedulable) {
  const j = job as Job;
  if (j.disposed) return;
  if (muted > 0) return; // 回滾/靜音期間不進隊列

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

// Promise 判斷
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
      // 回寫舊值 + 標髒下游 computed
      for (const [node, prev] of log) {
        restoreSignalAndMarkStale(node, prev);
      }
      // 清空所有隊列與排程旗標
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
  // 與原先語意一致：立即 flush（若已安排 microtask 也等同提早執行）
  if (!scheduled && computeQ.size === 0 && effectQ.size === 0) return;
  flushJobsTwoPhase();
}

// === two-phase flush ===
function flushJobsTwoPhase() {
  scheduled = false;
  let guard = 0;

  while (computeQ.size > 0 || effectQ.size > 0) {
    if (++guard > 10000) throw new Error("Infinite update loop");
    // Phase A: drain all computed until stable
    // （在此階段產生的新 computed 也會被同輪 drain）
    while (computeQ.size > 0) {
      const batch = Array.from(computeQ);
      computeQ.clear();
      for (const job of batch) {
        // 確保 job 標記為 computed（不影響外部 API）
        (job as Job).kind = 'computed';
        job.run();
      }
    }
    // Phase B: run one wave of effects
    if (effectQ.size > 0) {
      // 以 priority（小→大）排序；未設定視為 0
      const batch = Array.from(effectQ).sort((a, b) =>
        ((a as Job).priority ?? 0) - ((b as Job).priority ?? 0)
      );
      effectQ.clear();
      for (const job of batch) {
        (job as Job).kind = 'effect';
        job.run();
      }
      // 若 effect 過程中又產生新的 computed/effect，迴圈會再跑一輪
    }
  }
}
