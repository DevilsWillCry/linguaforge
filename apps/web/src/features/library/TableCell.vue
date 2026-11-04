<script setup lang="ts">
import SourceLink from '@/features/video/SourceLink.vue'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { cellOf } from '@/domain/rows'
import type { Entry, FieldDef } from '@/domain/types'
import CellDisplay from './CellDisplay.vue'
import FieldInput from './FieldInput.vue'
import { useLibraryStore } from './libraryStore'
import { useFieldLabel } from './useFieldLabel'

const props = defineProps<{ entry: Entry; field: FieldDef }>()

const { t } = useI18n()
const library = useLibraryStore()
const fieldLabel = useFieldLabel()

const root = useTemplateRef<HTMLElement>('root')
const editing = ref(false)
const draft = ref('')

const display = computed(() => cellOf(props.entry, props.field))
const isMultiline = computed(() => props.field.type === 'list' || props.field.type === 'multiline')

const control = () => root.value?.querySelector<HTMLElement>('input, select, textarea')

async function start() {
  draft.value = display.value
  editing.value = true
  await nextTick()
  control()?.focus()
}

async function finish(save: boolean, restoreFocus: boolean) {
  if (!editing.value) return
  editing.value = false
  if (save) await library.updateCell(props.entry, props.field, draft.value)
  if (restoreFocus) {
    await nextTick()
    root.value?.querySelector('button')?.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    void finish(false, true)
  } else if (event.key === 'Enter' && (!isMultiline.value || event.ctrlKey || event.metaKey)) {
    // In a multi-line cell, plain Enter adds a line and Ctrl+Enter saves.
    event.preventDefault()
    void finish(true, true)
  }
}
</script>

<template>
  <div ref="root">
    <FieldInput
      v-if="editing"
      v-model="draft"
      :field="field"
      :rows="5"
      @keydown="onKeydown"
      @blur="finish(true, false)"
      @change="field.type === 'select' || field.type === 'number' ? finish(true, true) : undefined"
    />
    <button
      v-else
      type="button"
      class="block min-h-10 w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-raised"
      @click="start"
    >
      <!-- Hidden text, not aria-label, so screen readers also hear the cell's value. -->
      <span class="sr-only">{{ t('library.editCell', { field: fieldLabel(field), name: entry.text }) }}</span>
      <CellDisplay :entry="entry" :field="field" />
    </button>
    <!-- Beside the button, not in it, because a link can't sit inside a button. -->
    <SourceLink v-if="!editing && field.target === 'source'" compact :name="entry.text" :source="entry.source" class="mt-1 ml-2" />
  </div>
</template>
