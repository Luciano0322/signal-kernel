import { markStale } from "./computed.js";
import { link, track, unlink } from "./graph.js";
import { SymbolRegistry as Effects } from "./registry.js";
import { inAtomic, recordAtomicWrite } from "./scheduler.js";
const defaultEquals = Object.is;
export function signal(initial, equals = defaultEquals) {
    const node = {
        kind: 'signal',
        deps: new Set(),
        subs: new Set(),
        value: initial,
        equals,
    };
    const get = () => {
        track(node);
        return node.value;
    };
    const set = (next) => {
        const prev = node.value;
        const nxtVal = typeof next === 'function' ? next(node.value) : next;
        if (node.equals(node.value, nxtVal))
            return;
        if (inAtomic())
            recordAtomicWrite(node, prev);
        node.value = nxtVal;
        if (node.subs.size === 0)
            return;
        for (const sub of node.subs) {
            if (sub.kind === 'effect') {
                Effects.get(sub)?.schedule();
            }
            else if (sub.kind === 'computed') {
                markStale(sub);
            }
        }
    };
    const subscribe = (observer) => {
        if (observer.kind === 'signal') {
            throw new Error('A signal cannot subscribe to another node');
        }
        link(observer, node);
        return () => unlink(observer, node);
    };
    return { get, set, subscribe, peek: () => node.value };
}
