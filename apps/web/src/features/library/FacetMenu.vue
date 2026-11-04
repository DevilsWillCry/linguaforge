<script setup lang="ts" generic="T extends string | number">
import { ChevronDown } from 'lucide-vue-next'
import AppPopover from '@/shared/ui/AppPopover.vue'

defineProps<{ label: string; options: readonly T[] }>()
const selected = defineModel<T[]>({ required: true })

function toggle(option: T) {
  selected.value = selected.value.includes(option)
    ? selected.value.filter((value) => value !== option)
    : [...selected.value, option]
}
</script>

<template>
  <AppPopover>
    <template #trigger>
      <button type="button" class="lf-btn" :aria-pressed="selected.length > 0">
        {{ label }}
        <span v-if="selected.length" class="tabular-nums">{{ selected.length }}</span>
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
    </template>
    <fieldset>
      <legend class="sr-only">{{ label }}</legend>
      <label
        v-for="option in options"
        :key="option"
        class="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-raised"
      >
        <input
          type="checkbox"
          class="accent-(--accent)"
          :checked="selected.includes(option)"
          @change="toggle(option)"
        />
        {{ option }}
      </label>
    </fieldset>
  </AppPopover>
</template>
