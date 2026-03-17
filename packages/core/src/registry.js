export const EffectSlot = Symbol("EffectSlot");
export const SymbolRegistry = {
    get(node) {
        return node[EffectSlot];
    },
    set(node, inst) {
        Object.defineProperty(node, EffectSlot, {
            value: inst,
            enumerable: false,
            configurable: true
        });
    },
    delete(node) {
        Reflect.deleteProperty(node, EffectSlot);
    }
};
