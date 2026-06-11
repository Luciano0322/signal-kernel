<script setup lang="ts">
import type { Job } from "../job-kernel";

defineProps<{
  job: Job | null;
}>();

function formatTime(value?: number) {
  if (!value) return "n/a";
  return new Date(value).toLocaleTimeString();
}

function formatDuration(value?: number) {
  if (value == null) return "n/a";
  return `${Math.round(value / 1000)}s`;
}
</script>

<template>
  <section class="panel">
    <h2 class="panel-title">Selected job</h2>

    <div v-if="job" class="detail">
      <p>
        <span>ID</span>
        <strong>{{ job.id }}</strong>
      </p>
      <p>
        <span>Name</span>
        <strong>{{ job.name }}</strong>
      </p>
      <p>
        <span>Status</span>
        <strong>{{ job.status }}</strong>
      </p>
      <p>
        <span>Progress</span>
        <strong>{{ job.progress }}%</strong>
      </p>
      <p>
        <span>Created</span>
        <strong>{{ formatTime(job.createdAt) }}</strong>
      </p>
      <p>
        <span>Started</span>
        <strong>{{ formatTime(job.startedAt) }}</strong>
      </p>
      <p>
        <span>Finished</span>
        <strong>{{ formatTime(job.finishedAt) }}</strong>
      </p>
      <p>
        <span>Duration</span>
        <strong>{{ formatDuration(job.durationMs) }}</strong>
      </p>
      <p v-if="job.error" class="error">
        <span>Error</span>
        <strong>{{ job.error }}</strong>
      </p>
    </div>

    <p v-else class="muted">Select a job to inspect its current graph state.</p>
  </section>
</template>

<style scoped>
.detail {
  display: grid;
  gap: 10px;
}

.detail p {
  border-bottom: 1px solid #e0e8e1;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  padding-bottom: 8px;
}

.detail p:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.detail span {
  color: #667568;
}

.detail strong {
  color: #193521;
  text-align: right;
}

.detail .error strong {
  color: #9c3a35;
}
</style>
