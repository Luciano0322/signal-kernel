import type { Node } from "./graph.js";

export interface EffectInstanceLike {
  schedule(): void;
}

export interface EffectRegistry {
  get(node: Node): EffectInstanceLike | undefined;
  set(node: Node, inst: EffectInstanceLike): void;
  delete(node: Node): void;
}

// Symbol 私有槽定義
export const EffectSlot: unique symbol = Symbol("EffectSlot");
export interface EffectCarrier {
  [EffectSlot]?: EffectInstanceLike;
}

export const SymbolRegistry: EffectRegistry = {
  get(node) {
    return (node as EffectCarrier)[EffectSlot];
  },
  set(node, inst) {
    Object.defineProperty(node as EffectCarrier, EffectSlot, {
      value: inst,
      enumerable: false,
      configurable: true
    });
  },
  delete(node) {
    Reflect.deleteProperty(node as EffectCarrier, EffectSlot);
  }
};
