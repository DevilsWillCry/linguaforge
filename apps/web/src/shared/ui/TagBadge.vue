<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  /** A --hue-* token name. Without one, the badge uses the normal text color. */
  color?: string
  icon?: Component
  /** Icon and text only, with no background. For values that don't need to stand out. */
  plain?: boolean
}>()
</script>

<template>
  <span
    class="inline-flex max-w-full items-center gap-1.5 text-xs"
    :class="plain ? 'text-ink' : 'lf-badge'"
    :style="color ? { '--badge-color': `var(--hue-${color})` } : undefined"
  >
    <component :is="icon" v-if="icon" :size="13" aria-hidden="true" class="shrink-0" :class="plain && 'text-muted'" />
    <span class="truncate">{{ label }}</span>
  </span>
</template>
