<script setup lang="ts">
import type { JobStatus } from "../job-kernel";

const props = defineProps<{
  value: JobStatus | "all";
}>();

const emit = defineEmits<{
  change: [value: JobStatus | "all"];
}>();

const options: Array<JobStatus | "all"> = [
  "all",
  "queued",
  "running",
  "retrying",
  "failed",
  "succeeded",
  "cancelled",
];

function update(event: Event) {
  emit("change", (event.target as HTMLSelectElement).value as JobStatus | "all");
}
</script>

<template>
  <label class="filter">
    <span>Status</span>
    <select :value="props.value" @change="update">
      <option v-for="option in options" :key="option" :value="option">
        {{ option }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.filter span {
  color: #526255;
  font-size: 13px;
  font-weight: 700;
}

select {
  border: 1px solid #b8c9bd;
  border-radius: 6px;
  background: white;
  color: #183421;
  min-height: 36px;
  padding: 6px 10px;
}
</style>
