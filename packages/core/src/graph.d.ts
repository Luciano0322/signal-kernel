export type Kind = 'signal' | 'computed' | 'effect';
export interface Node {
    kind: Kind;
    deps: Set<Node>;
    subs: Set<Node>;
}
export declare function link(from: Node, to: Node): void;
export declare function unlink(from: Node, to: Node): void;
export declare function withObserver<T>(obs: Node, fn: () => T): T;
export declare function track(dep: Node): void;
//# sourceMappingURL=graph.d.ts.map