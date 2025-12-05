import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 1) 先 mock 掉 markStale（供 rollback 測試使用）
vi.mock("../computed.js", () => ({
  markStale: vi.fn(),
}));

// 幫助在每個測試用「全新模組狀態」
async function loadScheduler() {
  const mod = await import("../scheduler.js");
  return mod as typeof import("../scheduler.js");
}

const markStale = (await import("../computed.js")).markStale as unknown as ReturnType<typeof vi.fn>;

// 測試中會用到的極簡 Node 型別（讓 scheduler 的 rollback 能標髒）
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
  vi.resetModules(); // 清掉單例隊列/旗標
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

    // 立即 flush（略過 microtask 排程的不確定性）
    S.flushSync();

    expect(order).toEqual(["c", "e"]);
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

  it("computed produced during effects runs in the next loop before next effects", async () => {
    const seq: string[] = [];

    const c = { kind: "computed", run: () => seq.push("c") };

    const e1 = {
      kind: "effect",
      run: () => {
        seq.push("e1");
        // 在 effect 期間新增 computed，下輪先跑 computed
        S.scheduleJob(c);
      },
    };
    const e2 = { kind: "effect", run: () => seq.push("e2") };

    S.scheduleJob(e1);
    S.scheduleJob(e2);
    S.flushSync();

    // 本輪先無 computed -> 跑 effects (e1, e2) -> 下輪先跑 computed (c)
    expect(seq).toEqual(["e1", "e2", "c"]);
  });

  it("batch(): defers flush until batch exit", async () => {
    const seen: string[] = [];

    const cJob = { kind: "computed" as const, run: () => seen.push("c") };
    const eJob = { kind: "effect"   as const, run: () => seen.push("e") };

    S.batch(() => {
      S.scheduleJob(cJob);
      S.scheduleJob(eJob);
      // 在 batch 內不應該馬上執行
      expect(seen).toEqual([]);
    });

    // 離開 batch 才 flush
    expect(seen).toEqual(["c", "e"]);
  });

  it("transaction(): commit keeps changes and flushes normally", async () => {
    const subComputed = makeComputedNode();
    const sig = makeSignalNode(1, [subComputed]); // subs 只有在 rollback 測試會用到
    const ran: string[] = [];

    // 用 effect job 檢查 flush 確實發生
    const effectJob = { kind: "effect", run: () => ran.push("effect") };
    const computedJob = { kind: "computed", run: () => ran.push("computed") };

    const out = S.transaction(() => {
      // 你在 signal.set() 前應呼叫 recordAtomicWrite
      S.recordAtomicWrite(sig as any, sig.value);
      // 模擬真正的 set 寫入
      sig.value = 2;

      // 交易中排程一些工作
      S.scheduleJob(computedJob);
      S.scheduleJob(effectJob);

      return 42;
    });

    // 非 Promise 分支直接回傳
    expect(out).toBe(42);

    // commit 分支：值被保留、且已 flush（先 computed 再 effect）
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

        // 交易中排程一些工作，但因為會 rollback，這些都不該執行
        S.scheduleJob(cJob);
        S.scheduleJob(eJob);

        throw new Error("boom");
      });
    } catch (e) {
      // swallow
    }

    // 回滾：值恢復
    expect(sig.value).toBe(10);
    // 標髒下游 computed
    expect(markStale).toHaveBeenCalledTimes(1);
    expect(markStale).toHaveBeenCalledWith(down);
    // muted 期間 scheduleJob 被忽略、且清空隊列 => 沒有任何 job 執行
    expect(ran).toEqual([]);
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

        // 內層成功 commit
        S.atomic(() => {
          S.recordAtomicWrite(b as any, b.value);
          b.value = 222;
        });

        // 外層最後回滾
        throw new Error("outer fail");
      });
    } catch {}

    expect(a.value).toBe(1);
    expect(b.value).toBe(2);
    // 兩個下游 computed 都被標髒
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
    // 不應拋錯、不應有任何副作用
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
