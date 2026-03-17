import { markStale } from "./computed.js";
;
;
const computeQ = new Set();
const effectQ = new Set();
let scheduled = false;
let batchDepth = 0;
let atomicDepth = 0;
const atomicLogs = [];
let muted = 0;
export function scheduleJob(job) {
    const j = job;
    if (j.disposed)
        return;
    if (muted > 0)
        return;
    const kind = (j.kind ?? 'effect');
    if (kind === 'computed')
        computeQ.add(j);
    else
        effectQ.add(j);
    if (!scheduled && batchDepth === 0) {
        scheduled = true;
        queueMicrotask(flushJobsTwoPhase);
    }
}
export function batch(fn) {
    batchDepth++;
    try {
        return fn();
    }
    finally {
        batchDepth--;
        if (batchDepth === 0)
            flushJobsTwoPhase();
    }
}
function isPromiseLike(v) {
    return v != null && typeof v.then === "function";
}
export function transaction(fn) {
    return atomic(fn);
}
export function inAtomic() {
    return atomicDepth > 0;
}
export function recordAtomicWrite(node, prevValue) {
    const log = atomicLogs[atomicLogs.length - 1];
    if (!log)
        return;
    if (!log.has(node))
        log.set(node, prevValue);
}
export function writeNodeValue(node, v) {
    if ("value" in node)
        node.value = v;
}
function mergeChildIntoParent(child, parent) {
    for (const [node, prev] of child) {
        if (!parent.has(node))
            parent.set(node, prev);
    }
}
function restoreSignalAndMarkStale(node, prev) {
    writeNodeValue(node, prev);
    if (node.kind === "signal") {
        for (const sub of node.subs) {
            if (sub.kind === "computed")
                markStale(sub);
        }
    }
}
export function atomic(fn) {
    batchDepth++;
    atomicDepth++;
    atomicLogs.push(new Map());
    const exitCommit = () => {
        const log = atomicLogs.pop();
        atomicDepth--;
        if (atomicDepth > 0) {
            mergeChildIntoParent(log, atomicLogs[atomicLogs.length - 1]);
        }
        batchDepth--;
        if (batchDepth === 0)
            flushJobsTwoPhase();
    };
    const exitRollback = () => {
        const log = atomicLogs.pop();
        atomicDepth--;
        muted++;
        try {
            for (const [node, prev] of log) {
                restoreSignalAndMarkStale(node, prev);
            }
            computeQ.clear();
            effectQ.clear();
            scheduled = false;
        }
        finally {
            muted--;
        }
        batchDepth--;
    };
    try {
        const out = fn();
        if (isPromiseLike(out)) {
            return Promise.resolve(out).then((v) => { exitCommit(); return v; }, (err) => { exitRollback(); throw err; });
        }
        exitCommit();
        return out;
    }
    catch (e) {
        exitRollback();
        throw e;
    }
}
export function flushSync() {
    if (!scheduled && computeQ.size === 0 && effectQ.size === 0)
        return;
    flushJobsTwoPhase();
}
function flushJobsTwoPhase() {
    scheduled = false;
    let guard = 0;
    while (computeQ.size > 0 || effectQ.size > 0) {
        if (++guard > 10000)
            throw new Error("Infinite update loop");
        while (computeQ.size > 0) {
            const batch = Array.from(computeQ);
            computeQ.clear();
            for (const job of batch) {
                job.kind = 'computed';
                job.run();
            }
        }
        if (effectQ.size > 0) {
            const batch = Array.from(effectQ).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
            effectQ.clear();
            for (const job of batch) {
                job.kind = 'effect';
                job.run();
            }
        }
    }
}
