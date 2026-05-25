import type {
  RestoreOptions,
  RestoreReport,
  SignalSnapshotNode,
  SnapshotDocument,
  SnapshotNode,
} from "./types";
import type { SignalRegistration, SnapshotScope } from "./scope";
import { SNAPSHOT_SCHEMA } from "./types";
import { deserializeValue } from "./serialize";

function incompatible(message: string, strict: boolean, report: RestoreReport) {
  if (strict) throw new Error(message);
  report.warnings.push(message);
}

function assertCompatibleGraph(
  scope: SnapshotScope,
  document: SnapshotDocument,
  strict: boolean,
  report: RestoreReport,
) {
  if (document.schema !== SNAPSHOT_SCHEMA) {
    incompatible("Unsupported snapshot schema", strict, report);
  }

  if (document.graph.id !== scope.graphId) {
    incompatible("Incompatible graph id", strict, report);
  }

  if (document.graph.version !== scope.graphVersion) {
    incompatible("Incompatible graph version", strict, report);
  }
}

function restoreSignal(
  registration: SignalRegistration,
  node: SignalSnapshotNode,
  report: RestoreReport,
) {
  const value = deserializeValue(node.value, registration.options.serializer);
  registration.source.set(value);
  report.restored.push(node.id);
}

function skipNode(node: SnapshotNode, report: RestoreReport) {
  report.skipped.push(node.id);
}

export function restoreSnapshot(
  scope: SnapshotScope,
  document: SnapshotDocument,
  options: RestoreOptions = {},
): RestoreReport {
  const strict = (options.mode ?? "strict") === "strict";
  const report: RestoreReport = {
    restored: [],
    skipped: [],
    warnings: [],
  };

  assertCompatibleGraph(scope, document, strict, report);

  for (const node of document.nodes) {
    const registration = scope.getRegistration(node.id);

    if (!registration) {
      incompatible(`Unknown snapshot node: ${node.id}`, strict, report);
      if (!strict) skipNode(node, report);
      continue;
    }

    if (registration.kind !== node.kind) {
      incompatible(`Incompatible node kind for ${node.id}`, strict, report);
      if (!strict) skipNode(node, report);
      continue;
    }

    if (node.kind === "signal") {
      restoreSignal(registration as SignalRegistration, node, report);
    } else {
      skipNode(node, report);
    }
  }

  return report;
}
