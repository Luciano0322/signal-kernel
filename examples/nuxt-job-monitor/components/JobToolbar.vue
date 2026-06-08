<script setup lang="ts">
import type { AsyncStatus } from "@signal-kernel/async-runtime";

defineProps<{
  title: string;
  status: AsyncStatus | "local";
}>();

defineEmits<{
  reload: [];
}>();
</script>

<template>
  <div class="toolbar">
    <div>
      <p class="eyebrow">{{ title }}</p>
      <p class="status">Load state: {{ status }}</p>
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
