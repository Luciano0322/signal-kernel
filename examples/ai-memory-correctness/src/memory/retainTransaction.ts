import type {
  ConsolidationPlan,
  MemoryDriver,
  MemoryScope,
  MemorySnapshot,
  RetainTransactionResult,
} from "./types";

export type RestorableMemoryDriver = MemoryDriver & {
  restore(scope: MemoryScope, snapshot: MemorySnapshot): Promise<MemorySnapshot>;
};

export type RetainTransactionInput = {
  before?: MemorySnapshot;
  driver: RestorableMemoryDriver;
  plan: ConsolidationPlan;
  scope: MemoryScope;
};

export async function retainTransaction({
  before,
  driver,
  plan,
  scope,
}: RetainTransactionInput): Promise<RetainTransactionResult> {
  const snapshotBefore = before ?? (await driver.inspect(scope));

  try {
    const after = await driver.applyPlan(scope, plan);

    return {
      status: "committed",
      before: snapshotBefore,
      after,
    };
  } catch (error) {
    const after = await driver.restore(scope, snapshotBefore);

    return {
      status: "rolled_back",
      before: snapshotBefore,
      after,
      error,
    };
  }
}
