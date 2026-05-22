import { computed, signal } from "@signal-kernel/core";

export const PROFILE_GRAPH_ID = "profile-graph";
export const PROFILE_GRAPH_VERSION = "0.1.0";

export type Plan = "free" | "pro" | "enterprise";

export type ProfileInput = {
  plan: Plan;
  usage: number;
  userId: string;
};

export function isPlan(value: string): value is Plan {
  return value === "free" || value === "pro" || value === "enterprise";
}

function usageLimitFor(plan: Plan) {
  switch (plan) {
    case "enterprise":
      return Number.POSITIVE_INFINITY;
    case "pro":
      return 1_000;
    case "free":
      return 100;
  }
}

function entitlementFor(plan: Plan) {
  switch (plan) {
    case "enterprise":
      return "dedicated";
    case "pro":
      return "priority";
    case "free":
      return "standard";
  }
}

export function createProfileGraph() {
  const userId = signal("guest");
  const plan = signal<Plan>("free");
  const usage = signal(0);

  const usageLimit = computed(() => usageLimitFor(plan.get()));
  const entitlement = computed(() => entitlementFor(plan.get()));
  const overLimit = computed(() => usage.get() > usageLimit.get());
  const summary = computed(() => {
    const limit = usageLimit.get();
    const limitText = Number.isFinite(limit) ? `${limit}` : "unlimited";

    return `${userId.get()} is on ${plan.get()} with ${usage.get()} / ${limitText} usage.`;
  });

  function setProfile(input: ProfileInput) {
    userId.set(input.userId);
    plan.set(input.plan);
    usage.set(input.usage);
  }

  function setUsage(nextUsage: number) {
    usage.set(Math.max(0, nextUsage));
  }

  function incrementUsage(delta: number) {
    usage.set((current) => Math.max(0, current + delta));
  }

  return {
    actions: {
      incrementUsage,
      setProfile,
      setUsage,
    },
    computed: {
      entitlement,
      overLimit,
      summary,
      usageLimit,
    },
    metadata: {
      graphId: PROFILE_GRAPH_ID,
      graphVersion: PROFILE_GRAPH_VERSION,
    },
    signals: {
      plan,
      usage,
      userId,
    },
  };
}

export type ProfileGraph = ReturnType<typeof createProfileGraph>;
