<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ActivityCell } from '@/domain/analytics'
import ChartTable from './ChartTable.vue'

const props = defineProps<{ cells: ActivityCell[] }>()
const { t } = useI18n()

const LEVELS = ['bg-raised', 'heat-1', 'heat-2', 'heat-3', 'heat-4']
const hovered = ref<ActivityCell | null>(null)
const scroller = ref<HTMLElement | null>(null)
// On a phone only part of the calendar fits, and the latest weeks are what matters.
onMounted(() => {
  if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth
})
const asDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const describe = (cell: ActivityCell) =>
  [
    t('stats.heatmap.reviews', { n: cell.reviews }, cell.reviews),
    t('stats.heatmap.minutes', { n: cell.minutes }, cell.minutes),
    ...(cell.output ? [t('stats.heatmap.output')] : []),
  ].join(' · ')
const activeDays = computed(() => props.cells.filter((cell) => cell.level > 0))
const tableRows = computed(() =>
  activeDays.value.map((cell) => [asDate(cell.day), cell.reviews, cell.minutes, cell.output ? t('stats.yes') : '']),
)
</script>

<template>
  <figure class="m-0" data-testid="heatmap">
    <figcaption class="sr-only">{{ t('stats.heatmap.caption') }}</figcaption>
    <div ref="scroller" aria-hidden="true" class="overflow-x-auto" @mouseleave="hovered = null">
      <div class="grid w-max grid-flow-col grid-rows-7 gap-0.5">
        <span
          v-for="cell in cells"
          :key="cell.day"
          class="size-3.5 rounded-sm sm:size-5"
          :class="LEVELS[cell.level]"
          :data-day="cell.day"
          :data-level="cell.level"
          @mouseenter="hovered = cell"
          @click="hovered = cell"
        />
      </div>
    </div>
    <div class="mt-2 flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs text-muted" aria-hidden="true">
      <span class="tabular-nums" data-testid="heatmap-tooltip">{{ hovered ? `${asDate(hovered.day)} · ${describe(hovered)}` : t('stats.heatmap.hint') }}</span>
      <span class="inline-flex items-center gap-1">
        {{ t('stats.heatmap.less') }}
        <span v-for="level in LEVELS" :key="level" class="size-3 rounded-sm" :class="level" />
        {{ t('stats.heatmap.more') }}
      </span>
    </div>
    <ChartTable
      :caption="t('stats.heatmap.caption')"
      :columns="[t('stats.day'), t('stats.heatmap.reviewsColumn'), t('stats.heatmap.minutesColumn'), t('stats.heatmap.outputColumn')]"
      :rows="tableRows"
    />
  </figure>
</template>

<style scoped>
/* One hue, more is darker. Mixed from the accent so each theme gets its own steps. */
.heat-1 { background: color-mix(in oklch, var(--accent) 30%, var(--raised)); }
.heat-2 { background: color-mix(in oklch, var(--accent) 55%, var(--raised)); }
.heat-3 { background: color-mix(in oklch, var(--accent) 78%, var(--raised)); }
.heat-4 { background: var(--accent); }
</style>
