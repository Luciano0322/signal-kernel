<script setup lang="ts">
import type { JobLog } from "../job-kernel";

defineProps<{
  logs: JobLog[];
}>();

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString();
}
</script>

<template>
  <section class="panel">
    <h2 class="panel-title">Selected job logs</h2>

    <div v-if="logs.length" class="logs">
      <p v-for="log in logs.slice().reverse()" :key="log.id" class="log">
        <span>{{ formatTime(log.timestamp) }}</span>
        <strong :data-level="log.level">{{ log.level }}</strong>
        <em>{{ log.message }}</em>
      </p>
    </div>

    <p v-else class="muted">No logs for the selected job yet.</p>
  </section>
</template>

<style scoped>
.logs {
  display: grid;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.log {
  border: 1px solid #d8e2da;
  border-radius: 6px;
  display: grid;
  grid-template-columns: 86px 54px minmax(0, 1fr);
  gap: 8px;
  margin: 0;
  padding: 8px;
}

.log span,
.log strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.log strong {
  color: #2d6e45;
}

.log strong[data-level="warn"] {
  color: #9f6a26;
}

.log strong[data-level="error"] {
  color: #993b32;
}

.log em {
  color: #324739;
  font-style: normal;
}
</style>
