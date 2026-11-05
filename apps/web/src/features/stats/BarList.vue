<script setup lang="ts">
import { computed } from 'vue'

/** Horizontal bars on one baseline, with the value printed so nothing depends on color or length. */
const props = defineProps<{ rows: { key: string; label: string; value: number; display: string }[]; max?: number }>()
const scale = computed(() => props.max ?? Math.max(1, ...props.rows.map((row) => row.value)))
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li v-for="row in rows" :key="row.key" class="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-2 text-sm" data-testid="bar-row">
      <span class="truncate" :title="row.label">{{ row.label }}</span>
      <span class="h-2 rounded-r bg-raised" aria-hidden="true">
        <span
          class="block h-full rounded-r bg-accent"
          :class="{ 'min-w-0.5': row.value > 0 }"
          :style="{ width: `${Math.min(100, (row.value / scale) * 100)}%` }"
        />
      </span>
      <span class="text-right text-xs text-muted tabular-nums">{{ row.display }}</span>
    </li>
  </ul>
</template>
