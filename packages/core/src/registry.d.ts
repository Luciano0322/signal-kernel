import type { Node } from "./graph.js";
export interface EffectInstanceLike {
    schedule(): void;
}
export interface EffectRegistry {
    get(node: Node): EffectInstanceLike | undefined;
    set(node: Node, inst: EffectInstanceLike): void;
    delete(node: Node): void;
}
export declare const EffectSlot: unique symbol;
export interface EffectCarrier {
    [EffectSlot]?: EffectInstanceLike;
}
export declare const SymbolRegistry: EffectRegistry;
//# sourceMappingURL=registry.d.ts.map