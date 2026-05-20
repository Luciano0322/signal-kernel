import { computed } from "@signal-kernel/core";
import type {
  AvailableUpstreams,
  HealthMap,
  Readable,
  UpstreamPools,
} from "../config/schema";
import { isAvailableHealth } from "./health";

export function createAvailableUpstreams(
  upstreams: Readable<UpstreamPools>,
  health: Readable<HealthMap>,
) {
  return computed<AvailableUpstreams>(() => {
    const pools = upstreams.get();
    const healthMap = health.get();
    const available: AvailableUpstreams = {};

    for (const [poolId, servers] of Object.entries(pools)) {
      available[poolId] = servers.filter((server) =>
        isAvailableHealth(healthMap[server.id]),
      );
    }

    return available;
  });
}
