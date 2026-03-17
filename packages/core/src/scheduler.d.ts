import { type Node } from "./graph.js";
export interface Schedulable {
    run(): void;
    disposed?: boolean;
}
export type InternalNode<T = unknown> = {
    value: T;
};
export declare function scheduleJob(job: Schedulable): void;
export declare function batch<T>(fn: () => T): T;
export declare function transaction<T>(fn: () => T): T;
export declare function transaction<T>(fn: () => Promise<T>): Promise<T>;
export declare function inAtomic(): boolean;
export declare function recordAtomicWrite<T>(node: Node & InternalNode<T>, prevValue: T): void;
export declare function writeNodeValue<T>(node: Node & InternalNode<T>, v: T): void;
export declare function atomic<T>(fn: () => T): T;
export declare function atomic<T>(fn: () => Promise<T>): Promise<T>;
export declare function flushSync(): void;
//# sourceMappingURL=scheduler.d.ts.map