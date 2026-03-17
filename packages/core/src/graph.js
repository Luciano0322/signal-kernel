export function link(from, to) {
    if (from.kind === 'signal')
        throw new Error('Signal nodes cannot depend on others');
    if (from.deps.has(to))
        return;
    from.deps.add(to);
    to.subs.add(from);
}
export function unlink(from, to) {
    from.deps.delete(to);
    to.subs.delete(from);
}
let currentObserver = null;
export function withObserver(obs, fn) {
    const prev = currentObserver;
    currentObserver = obs;
    try {
        return fn();
    }
    finally {
        currentObserver = prev;
    }
}
export function track(dep) {
    if (!currentObserver)
        return;
    link(currentObserver, dep);
}
