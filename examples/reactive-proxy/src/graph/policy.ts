import type {
  RoundRobinCursor,
  TrafficPolicy,
  UpstreamServer,
  WritableSignal,
} from "../config/schema";

export function selectFirstHealthy(
  candidates: readonly UpstreamServer[],
): UpstreamServer | undefined {
  return candidates[0];
}

export function selectRoundRobin(
  poolId: string,
  candidates: readonly UpstreamServer[],
  cursor: WritableSignal<RoundRobinCursor>,
): UpstreamServer | undefined {
  if (candidates.length === 0) return undefined;

  const currentCursor = cursor.peek();
  const currentIndex = currentCursor[poolId] ?? 0;
  const selected = candidates[currentIndex % candidates.length];

  cursor.set({
    ...currentCursor,
    [poolId]: (currentIndex + 1) % candidates.length,
  });

  return selected;
}

export function setPolicy(
  current: TrafficPolicy,
  nextPolicy: TrafficPolicy,
): TrafficPolicy {
  return {
    ...current,
    ...nextPolicy,
  };
}
