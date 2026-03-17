import { type Node } from "./graph.js";
import { type EffectInstanceLike } from "./registry.js";
type Cleanup = () => void;
export declare function onCleanup(cb: Cleanup): void;
export declare class EffectInstance implements EffectInstanceLike {
    private fn;
    node: Node;
    cleanups: Cleanup[];
    disposed: boolean;
    constructor(fn: () => void | Cleanup);
    run(): void;
    schedule(): void;
    dispose(): void;
}
export declare function createEffect(fn: () => void | Cleanup): () => void;
export {};
//# sourceMappingURL=effect.d.ts.map