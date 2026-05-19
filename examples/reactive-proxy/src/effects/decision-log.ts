import type { Decision } from "../config/schema";

export function formatDecisionLog(decision: Decision) {
  return decision.trace.map((step) => {
    const data = step.data ? ` ${JSON.stringify(step.data)}` : "";

    return `[${step.stage}] ${step.message}${data}`;
  });
}

export function logDecision(decision: Decision) {
  for (const line of formatDecisionLog(decision)) {
    console.log(line);
  }

  if (decision.ok) {
    console.log(`[effect] proxy request -> ${decision.targetUrl}`);
    return;
  }

  console.log(`[effect] reject ${decision.statusCode} ${decision.reason}`);
}
