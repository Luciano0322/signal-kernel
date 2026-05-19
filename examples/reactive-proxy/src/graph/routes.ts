import type { RouteRule } from "../config/schema";

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function normalizePrefix(prefix: string) {
  if (prefix === "/") return "/";
  return prefix.startsWith("/") ? prefix.replace(/\/+$/, "") : `/${prefix}`;
}

function matchesPrefix(path: string, prefix: string) {
  const normalizedPath = normalizePath(path).split("?")[0] ?? "/";
  const normalizedPrefix = normalizePrefix(prefix);

  if (normalizedPrefix === "/") return true;
  if (normalizedPath === normalizedPrefix) return true;

  return normalizedPath.startsWith(`${normalizedPrefix}/`);
}

export function matchRoute(
  routes: readonly RouteRule[],
  path: string,
): RouteRule | undefined {
  let bestMatch: RouteRule | undefined;

  for (const route of routes) {
    if (!matchesPrefix(path, route.pathPrefix)) continue;

    if (!bestMatch) {
      bestMatch = route;
      continue;
    }

    if (normalizePrefix(route.pathPrefix).length > normalizePrefix(bestMatch.pathPrefix).length) {
      bestMatch = route;
    }
  }

  return bestMatch;
}

export function replaceRoutes(routes: RouteRule[], nextRoutes: RouteRule[]) {
  routes.splice(0, routes.length, ...nextRoutes);
}
