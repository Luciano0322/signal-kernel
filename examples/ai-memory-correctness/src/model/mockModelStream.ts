export type MockModelStreamInput = {
  delayMs?: number;
  memoryPrompt: string;
  userMessage: string;
};

const defaultDelayMs = 25;

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildChunks(input: MockModelStreamInput) {
  const memorySummary = input.memoryPrompt
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2))
    .join(" ");
  const context = memorySummary || "No committed memory was available.";

  return [
    "I checked the committed memory graph. ",
    `For "${input.userMessage}", `,
    `${context} `,
    "I will answer using only committed memory, not candidate facts.",
  ];
}

export async function* mockModelStream(input: MockModelStreamInput) {
  const delayMs = input.delayMs ?? defaultDelayMs;

  for (const chunk of buildChunks(input)) {
    await delay(delayMs);
    yield chunk;
  }
}
