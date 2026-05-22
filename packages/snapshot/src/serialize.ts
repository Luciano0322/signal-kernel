import type {
  JsonValue,
  RedactionPolicy,
  SnapshotNodeOptions,
  SnapshotSerializer,
} from "./types";
import { assertJsonValue, cloneJsonValue } from "./json";

export type SerializedValue =
  | {
      omitted: true;
    }
  | {
      omitted: false;
      value: JsonValue;
    };

export function normalizeError(error: unknown): JsonValue | undefined {
  if (error === undefined) return undefined;

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  if (error === null || typeof error !== "object") {
    return {
      message: String(error),
    };
  }

  if ("message" in error && typeof error.message === "string") {
    return {
      message: error.message,
    };
  }

  return {
    message: "Unknown error",
  };
}

function applyRedaction<T>(
  value: T,
  redaction: RedactionPolicy<T> | undefined,
  label: string,
): SerializedValue | undefined {
  if (!redaction || redaction === "include") return undefined;

  if (redaction === "omit") {
    return { omitted: true };
  }

  const redacted = redaction.redact(value);
  assertJsonValue(redacted, label);
  return {
    omitted: false,
    value: cloneJsonValue(redacted),
  };
}

export function serializeValue<T>(
  value: T,
  options: SnapshotNodeOptions<T>,
  label: string,
): SerializedValue {
  const redacted = applyRedaction(value, options.redaction, label);
  if (redacted) return redacted;

  const encoded = options.serializer
    ? options.serializer.encode(value)
    : (value as unknown);

  assertJsonValue(encoded, label);

  return {
    omitted: false,
    value: cloneJsonValue(encoded),
  };
}

export function deserializeValue<T>(
  value: JsonValue,
  serializer: SnapshotSerializer<T> | undefined,
): T {
  if (serializer) return serializer.decode(value);

  return value as T;
}
