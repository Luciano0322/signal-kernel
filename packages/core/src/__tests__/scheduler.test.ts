import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../computed.js", () => ({
  markStale: vi.fn(),
}));

async function loadScheduler() {
  const mod = await import("../scheduler.js");
  return mod as typeof import("../scheduler.js");
}

const markStale = (await import("../computed.js")).markStale as unknown as ReturnType<typeof vi.fn>;

type Node = {
  kind: "signal" | "computed" | "effect";
  deps: Set<Node>;
  subs: Set<Node>;
};

function makeSignalNode<T>(value: T, subs: Node[] = []): Node & { value: T } {
  return {
    kind: "signal",
    deps: new Set(),
    subs: new Set(subs),
    value,
  };
}
function makeComputedNode(): Node {
  return { kind: "computed", deps: new Set(), subs: new Set() };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("two-phase scheduler", () => {
  let S: Awaited<ReturnType<typeof loadScheduler>>;

  beforeEach(async () => {
    S = await loadScheduler();
  });

  it("runs computed before effects in the same tick", async () => {
    const order: string[] = [];

    const computedJob = { kind: "computed", run: () => order.push("c") };
    const effectJob = { kind: "effect", run: () => order.push("e") };

    S.scheduleJob(computedJob);
    S.scheduleJob(effectJob);

    S.flushSync();

    expect(order).toEqual(["c", "e"]);
  });

  it("scheduleJob dedupes repeated computed jobs before flush", async () => {
    const ran: string[] = [];
    const computedJob = { kind: "computed" as const, run: () => ran.push("c") };

    S.scheduleJob(computedJob);
    S.scheduleJob(computedJob);
    S.scheduleJob(computedJob);

    S.flushSync();

    expect(ran).toEqual(["c"]);
  });

  it("effects are sorted by priority (small -> large)", async () => {
    const order: number[] = [];

    const e2 = { kind: "effect", priority: 2, run: () => order.push(2) };
    const e0 = { kind: "effect", priority: 0, run: () => order.push(0) };
    const e1 = { kind: "effect", priority: 1, run: () => order.push(1) };

    S.scheduleJob(e2);
    S.scheduleJob(e0);
    S.scheduleJob(e1);

    S.flushSync();
    expect(order).toEqual([0, 1, 2]);
  });

  it("runs computed before priority-sorted effects in a mixed flush", async () => {
    const order: string[] = [];

    const e2 = { kind: "effect" as const, priority: 2, run: () => order.push("e2") };
    const c = { kind: "computed" as const, run: () => order.push("c") };
    const e0 = { kind: "effect" as const, priority: 0, run: () => order.push("e0") };

    S.scheduleJob(e2);
    S.scheduleJob(c);
    S.scheduleJob(e0);

    S.flushSync();

    expect(order).toEqual(["c", "e0", "e2"]);
  });

  it("computed produced during effects runs in the next loop before next effects", async () => {
    const seq: string[] = [];

    const c = { kind: "computed", run: () => seq.push("c") };

    const e1 = {
      kind: "effect",
      run: () => {
        seq.push("e1");
        S.scheduleJob(c);
      },
    };
    const e2 = { kind: "effect", run: () => seq.push("e2") };

    S.scheduleJob(e1);
    S.scheduleJob(e2);
    S.flushSync();

    expect(seq).toEqual(["e1", "e2", "c"]);
  });

  it("dedupes computed jobs scheduled during an effect before the next loop", async () => {
    const seq: string[] = [];
    const c = { kind: "computed" as const, run: () => seq.push("c") };

    const effectJob = {
      kind: "effect" as const,
      run: () => {
        seq.push("e");
        S.scheduleJob(c);
        S.scheduleJob(c);
      },
    };

    S.scheduleJob(effectJob);
    S.flushSync();

    expect(seq).toEqual(["e", "c"]);
  });

  it("batch(): defers flush until batch exit", async () => {
    const seen: string[] = [];

    const cJob = { kind: "computed" as const, run: () => seen.push("c") };
    const eJob = { kind: "effect"   as const, run: () => seen.push("e") };

    S.batch(() => {
      S.scheduleJob(cJob);
      S.scheduleJob(eJob);
      expect(seen).toEqual([]);
    });

    expect(seen).toEqual(["c", "e"]);
  });

  it("batch dedupes repeated computed jobs until batch exits", async () => {
    const ran: string[] = [];
    const computedJob = { kind: "computed" as const, run: () => ran.push("c") };

    S.batch(() => {
      S.scheduleJob(computedJob);
      S.scheduleJob(computedJob);
      S.scheduleJob(computedJob);
      expect(ran).toEqual([]);
    });

    expect(ran).toEqual(["c"]);
  });

  it("transaction(): commit keeps changes and flushes normally", async () => {
    const subComputed = makeComputedNode();
    const sig = makeSignalNode(1, [subComputed]);
    const ran: string[] = [];

    const effectJob = { kind: "effect", run: () => ran.push("effect") };
    const computedJob = { kind: "computed", run: () => ran.push("computed") };

    const out = S.transaction(() => {
      S.recordAtomicWrite(sig as any, sig.value);
      sig.value = 2;

      S.scheduleJob(computedJob);
      S.scheduleJob(effectJob);

      return 42;
    });

    expect(out).toBe(42);

    expect(sig.value).toBe(2);
    expect(ran).toEqual(["computed", "effect"]);
    expect(markStale).not.toHaveBeenCalled();
  });

  it("transaction(): rollback restores values, marks downstream computed stale, and clears queues", async () => {
    const down = makeComputedNode();
    const sig = makeSignalNode(10, [down]);

    const ran: string[] = [];

    const cJob = { kind: "computed", run: () => ran.push("c") };
    const eJob = { kind: "effect", run: () => ran.push("e") };

    try {
      S.transaction(() => {
        S.recordAtomicWrite(sig as any, sig.value);
        sig.value = 99;

        S.scheduleJob(cJob);
        S.scheduleJob(eJob);

        throw new Error("boom");
      });
    } catch (e) {
      console.error(e)
    }

    expect(sig.value).toBe(10);
    expect(markStale).toHaveBeenCalledTimes(1);
    expect(markStale).toHaveBeenCalledWith(down);
    expect(ran).toEqual([]);
  });

  it("transaction rollback clears pending computed jobs before they run", async () => {
    const ran: string[] = [];
    const computedJob = { kind: "computed" as const, run: () => ran.push("c") };

    expect(() => {
      S.transaction(() => {
        S.scheduleJob(computedJob);
        S.scheduleJob(computedJob);
        throw new Error("rollback");
      });
    }).toThrow("rollback");

    S.flushSync();

    expect(ran).toEqual([]);
  });

  it("transaction rollback allows the same computed job to be scheduled again", async () => {
    const ran: string[] = [];
    const computedJob = { kind: "computed" as const, run: () => ran.push("c") };

    expect(() => {
      S.transaction(() => {
        S.scheduleJob(computedJob);
        throw new Error("rollback");
      });
    }).toThrow("rollback");

    S.scheduleJob(computedJob);
    S.flushSync();

    expect(ran).toEqual(["c"]);
  });

  it("nested atomic: inner commit + outer rollback restores all written nodes", async () => {
    const subA = makeComputedNode();
    const subB = makeComputedNode();
    const a = makeSignalNode(1, [subA]);
    const b = makeSignalNode(2, [subB]);

    try {
      S.atomic(() => {
        S.recordAtomicWrite(a as any, a.value);
        a.value = 111;

        S.atomic(() => {
          S.recordAtomicWrite(b as any, b.value);
          b.value = 222;
        });

        throw new Error("outer fail");
      });
    } catch {}

    expect(a.value).toBe(1);
    expect(b.value).toBe(2);
    expect(markStale).toHaveBeenCalledTimes(2);
    expect(markStale).toHaveBeenCalledWith(subA);
    expect(markStale).toHaveBeenCalledWith(subB);
  });

  it("inAtomic() reflects current atomic depth", async () => {
    expect(S.inAtomic()).toBe(false);
    S.atomic(() => {
      expect(S.inAtomic()).toBe(true);
      S.atomic(() => {
        expect(S.inAtomic()).toBe(true);
      });
      expect(S.inAtomic()).toBe(true);
    });
    expect(S.inAtomic()).toBe(false);
  });

  it("flushSync() no-ops when nothing scheduled", async () => {
    expect(() => S.flushSync()).not.toThrow();
  });

  it("scheduleJob respects disposed flag", async () => {
    const ran: string[] = [];
    const job = { disposed: true, run: () => ran.push("x") };
    S.scheduleJob(job as any);
    S.flushSync();
    expect(ran).toEqual([]);
  });
});
