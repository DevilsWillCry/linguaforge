<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()

/** How full the ring is. Shape shows progress as well as color does. */
const STAGES: Record<string, { fill: number; color: string }> = {
  New: { fill: 0, color: 'var(--status-new)' },
  Learning: { fill: 1 / 3, color: 'var(--status-learning)' },
  Familiar: { fill: 2 / 3, color: 'var(--status-familiar)' },
  Natural: { fill: 1, color: 'var(--status-natural)' },
}

// The wedge is a thick dashed stroke on a circle of this radius.
const WEDGE_RADIUS = 2.5
const CIRCUMFERENCE = 2 * Math.PI * WEDGE_RADIUS

const stage = computed(() => STAGES[props.status])
const color = computed(() => stage.value?.color ?? 'var(--muted)')
const dash = computed(() => `${(stage.value?.fill ?? 0) * CIRCUMFERENCE} ${CIRCUMFERENCE}`)
</script>

<template>
  <span class="lf-badge inline-flex items-center gap-1.5 text-xs" :style="{ '--badge-color': color }">
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true" class="shrink-0">
      <circle
        cx="6.5"
        cy="6.5"
        r="5.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        :stroke-dasharray="stage ? undefined : '2 2'"
      />
      <circle
        v-if="stage?.fill"
        cx="6.5"
        cy="6.5"
        :r="WEDGE_RADIUS"
        fill="none"
        stroke="currentColor"
        :stroke-width="WEDGE_RADIUS * 2"
        :stroke-dasharray="dash"
        transform="rotate(-90 6.5 6.5)"
      />
    </svg>
    {{ status }}
  </span>
</template>
