<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldOf } from '@/domain/rows'
import type { Entry } from '@/domain/types'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import EntrySummary from './EntrySummary.vue'
import { useLibraryStore } from './libraryStore'

const { t } = useI18n()
const library = useLibraryStore()

const statusField = computed(() => library.activeDeck && fieldOf(library.activeDeck, 'status'))

const columns = computed(() => {
  const options = statusField.value?.options ?? []
  const values = new Set([...options, ...library.visibleEntries.map((entry) => entry.status)])
  return [...values].map((status) => ({
    status,
    entries: library.visibleEntries.filter((entry) => entry.status === status),
  }))
})

const dropTarget = ref<string | null>(null)

function move(entry: Entry | undefined, status: string) {
  if (entry && statusField.value) void library.updateCell(entry, statusField.value, status)
}

function onDragStart(event: DragEvent, entry: Entry) {
  event.dataTransfer?.setData('text/plain', entry.id)
}

function onDrop(event: DragEvent, status: string) {
  dropTarget.value = null
  const id = event.dataTransfer?.getData('text/plain')
  move(library.visibleEntries.find((entry) => entry.id === id), status)
}
</script>

<template>
  <div class="grid auto-cols-[17rem] grid-flow-col gap-3 overflow-x-auto pb-2">
    <section
      v-for="column in columns"
      :key="column.status"
      class="flex max-h-[calc(100dvh-15rem)] min-h-40 flex-col rounded-card border bg-surface p-2"
      :class="dropTarget === column.status ? 'border-accent' : 'border-line'"
      data-testid="kanban-column"
      @dragover.prevent="dropTarget = column.status"
      @dragleave="dropTarget = null"
      @drop.prevent="onDrop($event, column.status)"
    >
      <h2 class="flex items-center justify-between px-2 py-1.5 text-sm font-medium">
        <StatusBadge :status="column.status" />
        <span class="text-xs text-muted tabular-nums">{{ column.entries.length }}</span>
      </h2>
      <!-- Each column scrolls by itself, so every drop target stays on screen during a drag. -->
      <ul class="flex min-h-0 flex-col gap-2 overflow-y-auto">

        <li
          v-for="entry in column.entries"
          :key="entry.id"
          draggable="true"
          class="cursor-grab rounded-lg border border-line bg-canvas p-3"
          data-testid="entry"
          @dragstart="onDragStart($event, entry)"
        >
          <EntrySummary :entry="entry" hide-status />
          <!-- Touch screens and keyboards can't drag, so this does the same job. -->
          <select
            :value="entry.status"
            :aria-label="t('library.moveTo', { name: entry.text })"
            class="lf-input mt-2 !min-h-9 !py-1 text-xs"
            @change="move(entry, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="option in columns" :key="option.status" :value="option.status">
              {{ option.status }}
            </option>
          </select>
        </li>
      </ul>
    </section>
  </div>
</template>
