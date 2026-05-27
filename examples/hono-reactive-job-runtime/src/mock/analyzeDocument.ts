import type {
  JobAnalyzeStream,
  JobExecutionChunk,
  JobRunSource,
  JobStreamContext,
} from "../runtime/jobTypes";
import { sleep } from "../utils/sleep";

type AnalysisStep = {
  delayMs: number;
  chunk: JobExecutionChunk;
};

export type AnalyzeDocumentOptions = {
  wait?: (ms: number) => Promise<void>;
};

export const analysisSteps: AnalysisStep[] = [
  {
    delayMs: 300,
    chunk: {
      progress: 20,
      currentStep: "parse_document",
      partialResult: "Parsed the document structure and detected sections.",
    },
  },
  {
    delayMs: 500,
    chunk: {
      progress: 45,
      currentStep: "extract_keywords",
      partialResult: "Extracted core keywords and topic candidates.",
    },
  },
  {
    delayMs: 500,
    chunk: {
      progress: 70,
      currentStep: "summarize_sections",
      partialResult: "Built section summaries from the parsed content.",
    },
  },
  {
    delayMs: 500,
    chunk: {
      progress: 90,
      currentStep: "generate_report",
      partialResult: "Generated a draft report from the analysis graph.",
    },
  },
];

function createFinalReport(source: JobRunSource) {
  const title = source.content.trim().slice(0, 80) || "empty document";

  return [
    `Analysis report for "${title}"`,
    `Attempt: ${source.attempt + 1}`,
    `Input length: ${source.content.length} characters`,
    "Summary: the document was parsed, keyworded, summarized, and converted into a final report.",
  ].join("\n");
}

export async function analyzeDocument(
  source: JobRunSource,
  ctx: JobStreamContext,
  options: AnalyzeDocumentOptions = {},
) {
  const wait = options.wait ?? sleep;

  for (const step of analysisSteps) {
    await wait(step.delayMs);

    if (ctx.isCancelled()) return;

    ctx.emit(step.chunk);
  }

  await wait(500);

  if (ctx.isCancelled()) return;

  const stableResult = createFinalReport(source);

  ctx.done({
    progress: 100,
    currentStep: "generate_report",
    partialResult: stableResult,
    stableResult,
  });
}

export const defaultAnalyzeDocument: JobAnalyzeStream = (source, ctx) =>
  analyzeDocument(source, ctx);
