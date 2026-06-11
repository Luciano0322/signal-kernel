<script setup lang="ts">
import type { JobListItem } from "../job-kernel";

defineProps<{
  jobs: JobListItem[];
  selectedId: string | null;
}>();

defineEmits<{
  select: [jobId: string];
  retry: [jobId: string];
  cancel: [jobId: string];
}>();
</script>

<template>
  <div class="list">
    <article
      v-for="job in jobs"
      :key="job.id"
      class="row"
      :class="{ selected: job.id === selectedId }"
    >
      <button class="select" type="button" @click="$emit('select', job.id)">
        <strong>{{ job.name }}</strong>
        <span>{{ job.id }}</span>
      </button>

      <div class="progress">
        <div class="badges">
          <span class="badge" :data-status="job.status">{{ job.status }}</span>
          <span v-if="job.isStuck" class="badge warning">stuck</span>
          <span v-else-if="job.isSlaBreached" class="badge warning">sla</span>
        </div>
        <div class="bar">
          <span :style="{ width: `${job.progress}%` }" />
        </div>
      </div>

      <div class="actions">
        <button
          v-if="job.canRetry"
          class="button"
          type="button"
          @click="$emit('retry', job.id)"
        >
          Retry
        </button>
        <button
          v-if="job.canCancel"
          class="button"
          type="button"
          @click="$emit('cancel', job.id)"
        >
          Cancel
        </button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.list {
  display: grid;
  gap: 10px;
}

.row {
  align-items: center;
  border: 1px solid #d4ded6;
  border-radius: 8px;
  background: white;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1fr) minmax(160px, 0.8fr) auto;
  padding: 12px;
}

.row.selected {
  border-color: #4d8961;
  box-shadow: 0 0 0 2px rgba(77, 137, 97, 0.12);
}

.select {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.select strong,
.select span {
  display: block;
}

.select strong {
  color: #193521;
}

.select span {
  margin-top: 4px;
  color: #6b786c;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.progress {
  display: grid;
  gap: 8px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.badge {
  border-radius: 999px;
  background: #eef4ef;
  color: #405646;
  display: inline-flex;
  font-size: 12px;
  justify-self: start;
  padding: 4px 8px;
}

.badge.warning {
  background: #fff1d7;
  color: #8a5b11;
}

.badge[data-status="failed"] {
  background: #f9e7e4;
  color: #993b32;
}

.badge[data-status="succeeded"] {
  background: #e6f3e9;
  color: #27623c;
}

.bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2eae4;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #4d8961;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 760px) {
  .row {
    grid-template-columns: 1fr;
  }

  .actions {
    justify-content: flex-start;
  }
}
</style>
