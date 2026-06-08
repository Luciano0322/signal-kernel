<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  createMockJobTransport,
  type Job,
  type JobEvent,
  type JobLog,
  type JobStatus,
  type JobSummary,
} from "../job-kernel";

const transport = createMockJobTransport();

const jobs = ref<Job[]>([]);
const logs = ref<JobLog[]>([]);
const selectedJobId = ref<string | null>(null);
const statusFilter = ref<JobStatus | "all">("all");
const loadStatus = ref<"idle" | "pending" | "success" | "error">("idle");

let unsubscribe: (() => void) | undefined;

function updateJob(jobId: string, updater: (job: Job) => Job) {
  jobs.value = jobs.value.map((job) =>
    job.id === jobId ? updater(job) : job,
  );
}

function applyJobEvent(event: JobEvent) {
  switch (event.type) {
    case "job_created":
      jobs.value = [...jobs.value, event.job];
      break;

    case "job_started":
      updateJob(event.jobId, (job) => ({
        ...job,
        status: "running",
        startedAt: event.timestamp,
      }));
      break;

    case "job_progressed":
      updateJob(event.jobId, (job) => ({
        ...job,
        status: "running",
        progress: event.progress,
      }));
      break;

    case "job_succeeded":
      updateJob(event.jobId, (job) => ({
        ...job,
        status: "succeeded",
        progress: 100,
        finishedAt: event.timestamp,
        durationMs: job.startedAt ? event.timestamp - job.startedAt : job.durationMs,
        error: undefined,
      }));
      break;

    case "job_failed":
      updateJob(event.jobId, (job) => ({
        ...job,
        status: "failed",
        error: event.error,
        finishedAt: event.timestamp,
        durationMs: job.startedAt ? event.timestamp - job.startedAt : job.durationMs,
      }));
      break;

    case "job_retrying":
      updateJob(event.jobId, (job) => ({
        ...job,
        status: "retrying",
        progress: 0,
        error: undefined,
        finishedAt: undefined,
        durationMs: undefined,
      }));
      break;

    case "job_cancelled":
      updateJob(event.jobId, (job) => ({
        ...job,
        status: "cancelled",
        finishedAt: event.timestamp,
        durationMs: job.startedAt ? event.timestamp - job.startedAt : job.durationMs,
      }));
      break;

    case "log_appended":
      logs.value = [...logs.value, event.log];
      break;
  }
}

async function reloadJobs() {
  loadStatus.value = "pending";

  try {
    jobs.value = await transport.fetchJobs();
    selectedJobId.value ??= jobs.value[0]?.id ?? null;
    loadStatus.value = "success";
  } catch {
    loadStatus.value = "error";
  }
}

async function retryJob(jobId: string) {
  applyJobEvent({
    type: "job_retrying",
    jobId,
    timestamp: Date.now(),
  });
  await transport.retryJob(jobId);
  await reloadJobs();
}

async function cancelJob(jobId: string) {
  await transport.cancelJob(jobId);
  applyJobEvent({
    type: "job_cancelled",
    jobId,
    timestamp: Date.now(),
  });
}

const filteredJobs = computed(() => {
  if (statusFilter.value === "all") return jobs.value;
  return jobs.value.filter((job) => job.status === statusFilter.value);
});

const selectedJob = computed(() => {
  if (!selectedJobId.value) return null;
  return jobs.value.find((job) => job.id === selectedJobId.value) ?? null;
});

const selectedJobLogs = computed(() => {
  if (!selectedJobId.value) return [];
  return logs.value.filter((log) => log.jobId === selectedJobId.value);
});

const summary = computed<JobSummary>(() => {
  const completedJobs = jobs.value.filter((job) => job.durationMs != null);

  return {
    total: jobs.value.length,
    queued: jobs.value.filter((job) => job.status === "queued").length,
    running: jobs.value.filter((job) => job.status === "running").length,
    succeeded: jobs.value.filter((job) => job.status === "succeeded").length,
    failed: jobs.value.filter((job) => job.status === "failed").length,
    retrying: jobs.value.filter((job) => job.status === "retrying").length,
    cancelled: jobs.value.filter((job) => job.status === "cancelled").length,
    averageDurationMs:
      completedJobs.length === 0
        ? null
        : completedJobs.reduce((sum, job) => sum + (job.durationMs ?? 0), 0) /
          completedJobs.length,
  };
});

onMounted(() => {
  void reloadJobs();
  unsubscribe = transport.subscribeJobEvents(applyJobEvent);
});

onBeforeUnmount(() => {
  unsubscribe?.();
});
</script>

<template>
  <main class="page">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Vue-owned</p>
          <h1 class="title">Nuxt owns the job monitor state</h1>
          <p class="subtitle">
            This page intentionally avoids signal-kernel. The same transport is
            managed with Vue refs, computed values, and component lifecycle.
          </p>
        </div>

        <nav class="nav">
          <NuxtLink to="/">Home</NuxtLink>
          <NuxtLink to="/kernel-owned">Kernel-owned</NuxtLink>
        </nav>
      </header>

      <div class="grid">
        <section class="panel grid">
          <JobToolbar
            title="Vue local refs"
            :status="loadStatus"
            @reload="reloadJobs"
          />
          <JobSummary :summary="summary" />
          <StatusFilter :value="statusFilter" @change="statusFilter = $event" />
        </section>

        <section class="layout">
          <article class="panel">
            <h2 class="panel-title">Jobs</h2>
            <JobList
              :jobs="filteredJobs"
              :selected-id="selectedJobId"
              @select="selectedJobId = $event"
              @retry="retryJob"
              @cancel="cancelJob"
            />
          </article>

          <aside class="grid">
            <JobDetail :job="selectedJob" />
            <JobLogPanel :logs="selectedJobLogs" />
          </aside>
        </section>
      </div>
    </div>
  </main>
</template>
