<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, PanelRightOpen } from 'lucide-vue-next'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FieldDef } from '@/domain/types'
import { FIELD_ICONS } from './fieldVisuals'
import { useLibraryStore } from './libraryStore'
import TableCell from './TableCell.vue'
import { useFieldLabel } from './useFieldLabel'
import { useTableScroll } from './useTableScroll'

const { t } = useI18n()
const library = useLibraryStore()
const fieldLabel = useFieldLabel()

const OPEN_COLUMN_WIDTH = 48

const scroller = useTemplateRef<HTMLElement>('scroller')
const table = useTemplateRef<HTMLElement>('table')
const { canScrollLeft, canScrollRight, panning, scrollByPage } = useTableScroll(scroller, table)

const isPinned = (field: FieldDef) => field.target === 'text'

/** The word comes first so it can stay pinned. Exports keep the spreadsheet's order. */
const columns = computed(() => {
  const fields = library.visibleFields
  return [...fields.filter(isPinned), ...fields.filter((field) => !isPinned(field))]
})

const pinnedWidth = computed(() => {
  const pinned = columns.value.find(isPinned)
  return OPEN_COLUMN_WIDTH + (pinned ? library.columnWidth(pinned) : 0)
})

const tableWidth = computed(() =>
  columns.value.reduce((sum, field) => sum + library.columnWidth(field), OPEN_COLUMN_WIDTH),
)

const canScroll = computed(() => canScrollLeft.value || canScrollRight.value)

function sortState(field: FieldDef) {
  const index = library.sort.findIndex((s) => s.key === field.key)
  const key = library.sort[index]
  return key ? { desc: key.desc, position: index + 1 } : null
}

function ariaSort(field: FieldDef) {
  const state = sortState(field)
  if (!state) return 'none'
  return state.desc ? 'descending' : 'ascending'
}

function startResize(event: PointerEvent, field: FieldDef) {
  const handle = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startWidth = library.columnWidth(field)
  handle.setPointerCapture(event.pointerId)

  const onMove = (move: PointerEvent) => library.setColumnWidth(field, startWidth + move.clientX - startX)
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onUp)
  }
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onUp)
}

function resizeWithKeys(event: KeyboardEvent, field: FieldDef) {
  const step = { ArrowLeft: -24, ArrowRight: 24 }[event.key]
  if (!step) return
  event.preventDefault()
  library.setColumnWidth(field, library.columnWidth(field) + step)
}

/** The pinned column's right edge. The shadow shows that content is passing underneath. */
const pinnedEdge = computed(() =>
  canScrollLeft.value ? 'md:shadow-[6px_0_8px_-6px_rgb(0_0_0/0.35)]' : '',
)
</script>

<template>
  <div>
    <div class="relative">
      <!-- Scrolling here rather than on the page keeps the header row in view. -->
      <!-- "relative" also keeps the cells' screen-reader text inside this scroller. -->
      <div
        ref="scroller"
        class="relative max-h-[calc(100dvh-16.5rem)] overflow-auto rounded-card border border-line bg-surface"
        :class="[
          panning && 'select-none [&_*]:cursor-grabbing',
          canScroll && 'cursor-grab',
        ]"
        :style="{ scrollPaddingLeft: `${pinnedWidth}px` }"
        data-testid="table-scroller"
      >
        <table
          ref="table"
          class="table-fixed border-separate border-spacing-0 text-sm"
          :style="{ width: `${tableWidth}px` }"
        >
          <colgroup>
            <col :style="{ width: `${OPEN_COLUMN_WIDTH}px` }" />
            <col
              v-for="field in columns"
              :key="field.key"
              :style="{ width: `${library.columnWidth(field)}px` }"
            />
          </colgroup>
          <thead class="sticky top-0 z-20 bg-surface">
            <tr>
              <td class="left-0 z-10 border-b border-line bg-surface md:sticky" />
              <th
                v-for="field in columns"
                :key="field.key"
                scope="col"
                :aria-sort="ariaSort(field)"
                class="relative border-b border-line bg-surface p-0 text-left text-xs font-medium text-muted"
                :class="isPinned(field) && ['z-10 md:sticky', pinnedEdge]"
                :style="isPinned(field) ? { left: `${OPEN_COLUMN_WIDTH}px` } : undefined"
              >
                <button
                  type="button"
                  :title="t('library.sortHint')"
                  class="flex min-h-11 w-full items-center gap-1.5 px-3 pr-4 text-left transition-colors hover:text-ink"
                  @click="library.setSort(field.key, $event.shiftKey)"
                >
                  <component :is="FIELD_ICONS[field.key]" v-if="FIELD_ICONS[field.key]" :size="13" aria-hidden="true" class="shrink-0" />
                  <span class="truncate">{{ fieldLabel(field) }}</span>
                  <template v-if="sortState(field)">
                    <ArrowDown v-if="sortState(field)?.desc" :size="12" aria-hidden="true" class="shrink-0" />
                    <ArrowUp v-else :size="12" aria-hidden="true" class="shrink-0" />
                    <span v-if="library.sort.length > 1" class="tabular-nums">{{ sortState(field)?.position }}</span>
                  </template>
                </button>
                <div
                  role="separator"
                  tabindex="0"
                  aria-orientation="vertical"
                  :aria-label="t('library.resizeColumn', { name: fieldLabel(field) })"
                  :aria-valuenow="library.columnWidth(field)"
                  aria-valuemin="72"
                  aria-valuemax="800"
                  class="absolute inset-y-2 right-0 w-2 cursor-col-resize touch-none border-r border-line hover:border-accent focus-visible:border-accent"
                  data-testid="column-resize"
                  @pointerdown="startResize($event, field)"
                  @keydown="resizeWithKeys($event, field)"
                />
              </th>
            </tr>
          </thead>
          <tbody class="[&>tr:last-child>td]:border-b-0">
            <tr
              v-for="entry in library.visibleEntries"
              :key="entry.id"
              class="group align-top transition-colors hover:bg-row-hover"
              data-testid="entry"
            >
              <td class="left-0 z-1 border-b border-line bg-surface p-1 transition-colors group-hover:bg-row-hover md:sticky">
                <button
                  type="button"
                  :aria-label="t('library.open', { name: entry.text })"
                  class="grid size-10 place-items-center rounded-md text-muted opacity-60 transition-opacity group-hover:opacity-100 hover:bg-raised hover:text-ink focus-visible:opacity-100"
                  @click="library.editing = entry"
                >
                  <PanelRightOpen :size="15" aria-hidden="true" />
                </button>
              </td>
              <td
                v-for="field in columns"
                :key="field.key"
                class="min-w-0 border-b border-line p-1"
                :class="isPinned(field) && ['z-1 bg-surface transition-colors group-hover:bg-row-hover md:sticky', pinnedEdge]"
                :style="isPinned(field) ? { left: `${OPEN_COLUMN_WIDTH}px` } : undefined"
                :data-pinned="isPinned(field) || undefined"
              >
                <TableCell :entry="entry" :field="field" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Signals that more columns are hidden to the right. -->
      <div
        v-show="canScrollRight"
        class="pointer-events-none absolute inset-y-px right-px z-20 w-12 rounded-r-card bg-gradient-to-l from-surface to-transparent"
        data-testid="table-fade"
      />

      <!-- In the header row, so they're always close by, unlike a scrollbar at the bottom. -->
      <div v-show="canScroll" class="absolute top-1.5 right-2 z-30 hidden gap-1 md:flex">
        <button
          type="button"
          class="grid size-8 place-items-center rounded-md border border-line bg-raised text-ink transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          :aria-label="t('library.scrollLeft')"
          :title="t('library.scrollLeft')"
          :disabled="!canScrollLeft"
          @click="scrollByPage(-1, pinnedWidth)"
        >
          <ChevronLeft :size="16" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="grid size-8 place-items-center rounded-md border border-line bg-raised text-ink transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          :aria-label="t('library.scrollRight')"
          :title="t('library.scrollRight')"
          :disabled="!canScrollRight"
          @click="scrollByPage(1, pinnedWidth)"
        >
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>

    <p v-if="canScroll" class="mt-2 hidden text-xs text-muted md:block">{{ t('library.scrollHint') }}</p>
  </div>
</template>
