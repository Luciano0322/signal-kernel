<script setup lang="ts">
import type { JobSummary } from "../job-kernel";

defineProps<{
  summary: JobSummary;
}>();

function formatDuration(value: number | null) {
  if (value == null) return "n/a";
  return `${Math.round(value / 1000)}s`;
}
</script>

<template>
  <section class="summary">
    <div class="metric">
      <span>Total</span>
      <strong>{{ summary.total }}</strong>
    </div>
    <div class="metric">
      <span>Queued</span>
      <strong>{{ summary.queued }}</strong>
    </div>
    <div class="metric">
      <span>Running</span>
      <strong>{{ summary.running + summary.retrying }}</strong>
    </div>
    <div class="metric danger">
      <span>Failed</span>
      <strong>{{ summary.failed }}</strong>
    </div>
    <div class="metric success">
      <span>Succeeded</span>
      <strong>{{ summary.succeeded }}</strong>
    </div>
    <div class="metric">
      <span>Avg duration</span>
      <strong>{{ formatDuration(summary.averageDurationMs) }}</strong>
    </div>
  </section>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  border: 1px solid #d1ddd4;
  border-radius: 8px;
  background: #f9fbf9;
  padding: 12px;
}

.metric span {
  display: block;
  color: #697869;
  font-size: 12px;
}

.metric strong {
  display: block;
  margin-top: 6px;
  color: #173420;
  font-size: 22px;
}

.metric.danger strong {
  color: #a13d3d;
}

.metric.success strong {
  color: #2f6d48;
}

@media (max-width: 900px) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
