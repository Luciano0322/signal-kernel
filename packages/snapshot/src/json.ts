import type { JsonValue, SnapshotDocument } from "./types";
import { SNAPSHOT_SCHEMA } from "./types";

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;

  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object": {
      if (Array.isArray(value)) {
        return value.every(isJsonValue);
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        return false;
      }

      return Object.values(value as Record<string, unknown>).every(isJsonValue);
    }
    default:
      return false;
  }
}

export function assertJsonValue(value: unknown, label: string): asserts value is JsonValue {
  if (!isJsonValue(value)) {
    throw new Error(`${label} is not JSON-serializable`);
  }
}

export function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

export function encodeJsonSnapshot(document: SnapshotDocument): string {
  return JSON.stringify(document);
}

export function decodeJsonSnapshot(text: string): SnapshotDocument {
  const parsed: unknown = JSON.parse(text);
  assertSnapshotDocument(parsed);
  return parsed;
}

export function assertSnapshotDocument(
  value: unknown,
): asserts value is SnapshotDocument {
  assertObject(value, "Snapshot document");

  if (value.schema !== SNAPSHOT_SCHEMA) {
    throw new Error("Unsupported snapshot schema");
  }

  assertObject(value.graph, "Snapshot graph");

  if (typeof value.graph.id !== "string") {
    throw new Error("Snapshot graph id must be a string");
  }

  if (typeof value.graph.version !== "string") {
    throw new Error("Snapshot graph version must be a string");
  }

  if (
    "instanceId" in value.graph &&
    value.graph.instanceId !== undefined &&
    typeof value.graph.instanceId !== "string"
  ) {
    throw new Error("Snapshot graph instanceId must be a string");
  }

  if (typeof value.createdAt !== "number") {
    throw new Error("Snapshot createdAt must be a number");
  }

  if (!Array.isArray(value.nodes)) {
    throw new Error("Snapshot nodes must be an array");
  }

  assertJsonValue(value as unknown, "Snapshot document");
}
