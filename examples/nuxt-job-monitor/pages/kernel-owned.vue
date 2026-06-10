<script setup lang="ts">
import {
  captureSnapshot,
  decodeJsonSnapshot,
  encodeJsonSnapshot,
  restoreSnapshot,
} from "@signal-kernel/snapshot";
import { useResource, useSignalValue } from "@signal-kernel/vue";
import { ref } from "vue";
import { createJobKernelSnapshotScope, type JobStatus } from "../job-kernel";

const kernel = useJobKernel();

const jobs = useSignalValue(kernel.computed.filteredJobListItems);
const selectedJob = useSignalValue(kernel.computed.selectedJob);
const selectedJobId = useSignalValue(kernel.state.selectedJobId);
const selectedJobLogs = useSignalValue(kernel.computed.selectedJobLogs);
const summary = useSignalValue(kernel.computed.jobSummary);
const runtimeHealth = useSignalValue(kernel.computed.runtimeHealth);
const filter = useSignalValue(kernel.state.statusFilter);
const jobsResource = useResource(kernel.resources.jobsResource);
const jobsStatus = jobsResource.status;
const snapshotText = ref("");
const snapshotReport = ref("No snapshot captured");

function setFilter(nextFilter: JobStatus | "all") {
  kernel.actions.setStatusFilter(nextFilter);
}

function selectJob(jobId: string) {
  kernel.actions.selectJob(jobId);
}

function retryJob(jobId: string) {
  void kernel.actions.retryJob(jobId);
}

function cancelJob(jobId: string) {
  void kernel.actions.cancelJob(jobId);
}

function reloadJobs() {
  void jobsResource.reload();
}

function captureGraphSnapshot() {
  const snapshot = captureSnapshot(createJobKernelSnapshotScope(kernel), {
    metadata: {
      capturedFrom: "kernel-owned",
      demo: "nuxt-job-monitor",
    },
  });

  snapshotText.value = encodeJsonSnapshot(snapshot);
  snapshotReport.value = `Captured ${snapshot.nodes.length} nodes`;
}

function resetGraphState() {
  kernel.actions.stop();
  kernel.actions.resetGraphState();
  snapshotReport.value = "Graph reset; event stream stopped";
}

function restoreGraphSnapshot() {
  if (!snapshotText.value) return;

  const snapshot = decodeJsonSnapshot(snapshotText.value);
  const report = restoreSnapshot(createJobKernelSnapshotScope(kernel), snapshot);

  kernel.actions.start();
  snapshotReport.value =
    `Restored ${report.restored.length} nodes; skipped ${report.skipped.length}`;
}
</script>

<template>
  <main class="page">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Kernel-owned</p>
          <h1 class="title">Nuxt renders an external async graph</h1>
          <p class="subtitle">
            The job graph is created outside Vue component state. Nuxt handles
            routing and rendering while signal-kernel owns resources, mutation
            invalidation, events, and computed graph values.
          </p>
        </div>

        <nav class="nav">
          <NuxtLink to="/">Home</NuxtLink>
          <NuxtLink to="/vue-owned">Vue-owned</NuxtLink>
        </nav>
      </header>

      <div class="grid">
        <section class="panel grid">
          <JobToolbar
            title="@signal-kernel/async-runtime resource"
            :status="jobsStatus"
            :stream-status="runtimeHealth.connectionStatus"
            :queue-health="runtimeHealth.queueHealth"
            :last-event-at="runtimeHealth.lastEventAt"
            @reload="reloadJobs"
          />
          <JobSummary :summary="summary" />
          <StatusFilter :value="filter" @change="setFilter" />
        </section>

        <section class="panel snapshot-panel">
          <div>
            <p class="eyebrow">Snapshot handoff</p>
            <p class="status">{{ snapshotReport }}</p>
          </div>

          <div class="snapshot-actions">
            <button class="button" type="button" @click="captureGraphSnapshot">
              Capture
            </button>
            <button class="button" type="button" @click="resetGraphState">
              Reset
            </button>
            <button
              class="button primary"
              type="button"
              :disabled="!snapshotText"
              @click="restoreGraphSnapshot"
            >
              Restore
            </button>
          </div>

          <textarea
            v-model="snapshotText"
            class="snapshot-text"
            spellcheck="false"
          />
        </section>

        <section class="layout">
          <article class="panel">
            <h2 class="panel-title">Jobs</h2>
            <JobList
              :jobs="jobs"
              :selected-id="selectedJobId"
              @select="selectJob"
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

<style scoped>
.snapshot-panel {
  display: grid;
  gap: 12px;
}

.snapshot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.snapshot-text {
  border: 1px solid #c6d4ca;
  border-radius: 8px;
  color: #203728;
  font:
    12px/1.5 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  min-height: 120px;
  padding: 10px;
  resize: vertical;
  width: 100%;
}
</style>
