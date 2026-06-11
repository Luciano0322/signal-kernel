<script setup lang="ts">
import type { AsyncStatus } from "@signal-kernel/async-runtime";
import type { JobEventStreamStatus, JobQueueHealth } from "../job-kernel";

defineProps<{
  title: string;
  status: AsyncStatus | "local";
  streamStatus?: JobEventStreamStatus;
  queueHealth?: JobQueueHealth;
  lastEventAt?: number | null;
}>();

defineEmits<{
  reload: [];
}>();

function formatEventTime(value?: number | null) {
  if (value == null) return "none";
  return new Date(value).toLocaleTimeString();
}
</script>

<template>
  <div class="toolbar">
    <div>
      <p class="eyebrow">{{ title }}</p>
      <p class="status">Load state: {{ status }}</p>
      <p v-if="streamStatus" class="status">
        Stream: {{ streamStatus }} / Health: {{ queueHealth ?? "healthy" }} /
        Last event: {{ formatEventTime(lastEventAt) }}
      </p>
    </div>
    <button class="button" type="button" @click="$emit('reload')">
      Reload
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status {
  margin: 0;
  color: #647568;
  font-size: 13px;
}
</style>
