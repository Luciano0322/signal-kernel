import type { HealthMap, ServerHealth } from "../config/schema";

export function isAvailableHealth(health: ServerHealth | undefined) {
  return !health || health.status === "unknown" || health.status === "healthy";
}

export function setHealthEntry(
  current: HealthMap,
  serverId: string,
  nextHealth: ServerHealth,
): HealthMap {
  return {
    ...current,
    [serverId]: nextHealth,
  };
}
