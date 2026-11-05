<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForecastDay } from '@/domain/analytics'
import ChartTable from './ChartTable.vue'

const props = defineProps<{ days: ForecastDay[] }>()
const { t } = useI18n()

const hovered = ref<number | null>(null)
const max = computed(() => Math.max(1, ...props.days.map((day) => day.count)))
const asDate = (day: string) => new Date(`${day}T12:00:00`)
const shortDay = (day: string) => asDate(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const active = computed(() => (hovered.value === null ? null : (props.days[hovered.value] ?? null)))
const tableRows = computed(() => props.days.map((day) => [shortDay(day.day), day.count]))
</script>

<template>
  <figure class="m-0" data-testid="forecast">
    <figcaption class="sr-only">{{ t('stats.forecast.caption') }}</figcaption>
    <div class="relative" aria-hidden="true" @mouseleave="hovered = null">
      <div class="absolute inset-x-0 top-0 border-t border-line" />
      <span class="absolute top-0 right-0 bg-surface pl-1 text-xs text-muted tabular-nums">{{ max }}</span>
      <div class="flex h-32 items-end gap-0.5 border-b border-line">
        <button
          v-for="(day, index) in days"
          :key="day.day"
          type="button"
          tabindex="-1"
          class="flex h-full min-w-0 flex-1 cursor-default items-end"
          @mouseenter="hovered = index"
          @focus="hovered = index"
          @click="hovered = index"
        >
          <span
            class="block w-full rounded-t bg-accent"
            :class="{ 'opacity-70': hovered !== null && hovered !== index }"
            :style="{ height: day.count ? `max(3px, ${(day.count / max) * 100}%)` : '0' }"
          />
        </button>
      </div>
      <div class="mt-1 flex justify-between text-xs text-muted">
        <span>{{ t('stats.forecast.today') }}</span>
        <span>{{ shortDay(days.at(-1)!.day) }}</span>
      </div>
      <p v-if="active" class="absolute top-1 left-0 rounded border border-line bg-raised px-2 py-1 text-xs tabular-nums shadow-sm" data-testid="forecast-tooltip">
        {{ shortDay(active.day) }} · {{ t('stats.forecast.cards', { n: active.count }, active.count) }}
      </p>
    </div>
    <ChartTable :caption="t('stats.forecast.caption')" :columns="[t('stats.day'), t('stats.forecast.column')]" :rows="tableRows" />
  </figure>
</template>
