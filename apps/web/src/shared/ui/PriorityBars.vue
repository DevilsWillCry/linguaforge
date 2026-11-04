<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ priority: number }>()
const { t } = useI18n()

const BARS = [1, 2, 3, 4, 5]
/** Cool to hot. The number of filled bars carries the same meaning for anyone who can't see color. */
const COLORS = ['', 'sky', 'teal', 'amber', 'orange', 'rose']

const label = computed(() =>
  props.priority ? t('library.priorityLabel', { n: props.priority }) : t('library.noPriority'),
)
const color = computed(() => `var(--hue-${COLORS[props.priority] ?? 'slate'})`)
</script>

<template>
  <svg
    role="img"
    :aria-label="label"
    width="26"
    height="16"
    viewBox="0 0 26 16"
    class="block shrink-0"
    data-testid="priority-bars"
  >
    <title>{{ label }}</title>
    <rect
      v-for="bar in BARS"
      :key="bar"
      :x="(bar - 1) * 5.5"
      :y="12 - bar * 2.4"
      :height="4 + bar * 2.4"
      width="4"
      rx="1"
      :fill="bar <= priority ? color : 'var(--line)'"
    />
  </svg>
</template>
