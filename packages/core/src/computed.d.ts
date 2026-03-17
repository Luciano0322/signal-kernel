import { type Node } from "./graph.js";
type Comparator<T> = (a: T, b: T) => boolean;
export declare function markStale(node: Node): void;
export declare function computed<T>(fn: () => T, equals?: Comparator<T>): {
    get: () => T;
    peek: () => T;
    dispose: () => void;
};
export {};
//# sourceMappingURL=computed.d.ts.map