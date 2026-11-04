<script setup lang="ts">
import { computed } from 'vue'
import type { FieldDef } from '@/domain/types'
import { isCodeField } from './fieldVisuals'

const props = defineProps<{ field: FieldDef; placeholder?: string; rows?: number }>()
const value = defineModel<string>({ required: true })

const PRIORITIES = ['0', '1', '2', '3', '4', '5']

// A value that was removed from the list still shows, so opening an entry can't change it.
const options = computed(() => {
  const list = props.field.options ?? []
  return value.value && !list.includes(value.value) ? [value.value, ...list] : list
})
</script>

<template>
  <select v-if="field.type === 'number'" v-model="value" class="lf-input">
    <option v-for="priority in PRIORITIES" :key="priority" :value="priority">{{ priority }}</option>
  </select>
  <select v-else-if="field.type === 'select'" v-model="value" class="lf-input">
    <option value="" />
    <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
  </select>
  <textarea
    v-else-if="field.type === 'list' || field.type === 'multiline'"
    v-model="value"
    class="lf-input"
    :class="isCodeField(field.key) && 'font-mono text-[0.8125rem]'"
    :rows="rows ?? 3"
    :placeholder="placeholder"
  />
  <input v-else v-model="value" type="text" class="lf-input" :placeholder="placeholder" />
</template>
