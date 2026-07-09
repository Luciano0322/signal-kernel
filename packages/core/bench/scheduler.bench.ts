import { bench, describe } from "vitest";
import { batch, scheduleJob } from "../src/scheduler.js";

type BenchJob = {
  kind: "computed" | "effect";
  priority?: number;
  run(): void;
};

const sizes = [100, 1_000, 10_000] as const;
const options = {
  iterations: 10,
  time: 100,
};

let sink = 0;

function makeComputedJobs(count: number): BenchJob[] {
  return Array.from({ length: count }, () => ({
    kind: "computed" as const,
    run() {
      sink++;
    },
  }));
}

describe("scheduler computed queue", () => {
  for (const size of sizes) {
    const jobs = makeComputedJobs(size);

    bench(
      `enqueue and flush ${size} distinct computed jobs`,
      () => {
        batch(() => {
          for (const job of jobs) {
            scheduleJob(job);
          }
        });
      },
      options
    );
  }

  for (const size of sizes) {
    const job: BenchJob = {
      kind: "computed",
      run() {
        sink++;
      },
    };

    bench(
      `dedupe the same computed job scheduled ${size} times`,
      () => {
        batch(() => {
          for (let i = 0; i < size; i++) {
            scheduleJob(job);
          }
        });
      },
      options
    );
  }

  for (const size of sizes) {
    const jobs: BenchJob[] = Array.from({ length: size }, (_, index) => ({
      kind: "computed" as const,
      run() {
        sink++;
        const next = jobs[index + 1];
        if (next) scheduleJob(next);
      },
    }));

    bench(
      `cascade through ${size} computed jobs`,
      () => {
        batch(() => {
          scheduleJob(jobs[0]);
        });
      },
      options
    );
  }
});

describe("scheduler effect queue", () => {
  for (const size of sizes) {
    const jobs: BenchJob[] = Array.from({ length: size }, (_, index) => ({
      kind: "effect" as const,
      priority: size - index,
      run() {
        sink++;
      },
    }));

    bench(
      `enqueue and flush ${size} priority-sorted effect jobs`,
      () => {
        batch(() => {
          for (const job of jobs) {
            scheduleJob(job);
          }
        });
      },
      options
    );
  }

  for (const size of sizes) {
    const computedJobs = makeComputedJobs(size);
    const effectJobs: BenchJob[] = Array.from({ length: size }, (_, index) => ({
      kind: "effect" as const,
      priority: size - index,
      run() {
        sink++;
      },
    }));

    bench(
      `enqueue and flush ${size} computed plus ${size} priority-sorted effect jobs`,
      () => {
        batch(() => {
          for (let i = 0; i < size; i++) {
            scheduleJob(effectJobs[i]);
            scheduleJob(computedJobs[i]);
          }
        });
      },
      options
    );
  }
});
