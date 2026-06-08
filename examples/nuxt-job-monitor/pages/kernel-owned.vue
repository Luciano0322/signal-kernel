<script setup lang="ts">
import { useResource, useSignalValue } from "@signal-kernel/vue";
import type { JobStatus } from "../job-kernel";

const kernel = useJobKernel();

const jobs = useSignalValue(kernel.computed.filteredJobs);
const selectedJob = useSignalValue(kernel.computed.selectedJob);
const selectedJobId = useSignalValue(kernel.state.selectedJobId);
const selectedJobLogs = useSignalValue(kernel.computed.selectedJobLogs);
const summary = useSignalValue(kernel.computed.jobSummary);
const filter = useSignalValue(kernel.state.statusFilter);
const jobsResource = useResource(kernel.resources.jobsResource);
const jobsStatus = jobsResource.status;

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
            @reload="reloadJobs"
          />
          <JobSummary :summary="summary" />
          <StatusFilter :value="filter" @change="setFilter" />
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
