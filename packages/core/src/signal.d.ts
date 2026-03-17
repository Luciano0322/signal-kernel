import { type Node } from "./graph.js";
type Comparator<T> = (a: T, b: T) => boolean;
export declare function signal<T>(initial: T, equals?: Comparator<T>): {
    get: () => T;
    set: (next: T | ((prev: T) => T)) => void;
    subscribe: (observer: Node) => () => void;
    peek: () => T;
};
export {};
//# sourceMappingURL=signal.d.ts.map