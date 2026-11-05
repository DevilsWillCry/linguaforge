<script setup lang="ts">
import { liveQuery } from 'dexie'
import { Flame } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { statsRepository, type StatsSnapshot } from '@/data/repositories'
import {
  accuracyBy,
  activityCalendar,
  dayKey,
  dueForecast,
  minutesByActivity,
  nextFocus,
  outputDays,
  outputStreak,
  recentMistakes,
  retention,
  statusFunnel,
  usedInOutput,
  weeklyProgress,
  type WeaknessDimension,
} from '@/domain/analytics'
import { isReviewable } from '@/domain/reviewCards'
import { useTodayStore } from '@/features/today/todayStore'
import ActivityHeatmap from './ActivityHeatmap.vue'
import BarList from './BarList.vue'
import ChartTable from './ChartTable.vue'
import ForecastChart from './ForecastChart.vue'

const { t, te } = useI18n()
const today = useTodayStore()

const data = shallowRef<StatsSnapshot | null>(null)
const failed = ref(false)
const dimension = ref<WeaknessDimension>('context')
const DIMENSIONS: WeaknessDimension[] = ['context', 'kind', 'tone', 'mode']

// Live, so a review finished in another tab or a word added with Quick Add shows up at once.
const subscription = liveQuery(() => statsRepository.snapshot()).subscribe({
  next: (value) => {
    data.value = value
  },
  error: (error) => {
    console.error(error)
    failed.value = true
  },
})
onBeforeUnmount(() => subscription.unsubscribe())

const now = new Date()
const outputs = computed(() => (data.value ? outputDays(data.value.logs, data.value.conversations, data.value.sessions) : new Set<string>()))
const streak = computed(() => outputStreak(outputs.value, now))
const forecast = computed(() => {
  const value = data.value
  const deck = value?.deck
  if (!value || !deck) return []
  return dueForecast(value.entries.filter((entry) => isReviewable(entry, deck, true)), now)
})
const dueToday = computed(() => forecast.value[0]?.count ?? 0)
const kept = computed(() => retention(data.value?.logs ?? [], now))
const calendar = computed(() => (data.value ? activityCalendar(data.value.logs, data.value.sessions, outputs.value, now, 26) : []))
const funnel = computed(() =>
  statusFunnel(data.value?.entries ?? []).map(({ status, count }) => ({ key: status, label: status, value: count, display: String(count) })),
)
const minutes = computed(() =>
  minutesByActivity(data.value?.sessions ?? [], now).map(({ activity, minutes }) => ({
    key: activity,
    label: te(`today.steps.${activity}.title`) ? t(`today.steps.${activity}.title`) : activity,
    value: minutes,
    display: `${minutes} min`,
  })),
)
const week = computed(() => weeklyProgress(data.value?.sessions ?? [], data.value?.entries ?? [], now))
const accuracy = computed(() =>
  accuracyBy(dimension.value, data.value?.logs ?? [], data.value?.entries ?? []).map((row) => ({
    key: row.label,
    label: dimension.value === 'mode' ? t(`review.modes.${row.label}.title`) : row.label,
    value: row.percent,
    display: `${row.percent}% · ${row.total}`,
  })),
)
const focus = computed(() => (data.value ? nextFocus(data.value.logs, data.value.entries) : null))
const mistakes = computed(() => recentMistakes(data.value?.mistakes ?? []))
const used = computed(() => usedInOutput(data.value?.entries ?? []))
const didOutputToday = computed(() => outputs.value.has(dayKey(now)))
const planned = computed(() => t(`today.intensities.${today.intensity}`))
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold tracking-tight">{{ t('nav.stats') }}</h1>
    <p v-if="failed" role="alert" class="text-sm">{{ t('errors.load') }}</p>
    <p v-else-if="!data" class="text-sm text-muted">{{ t('loading') }}</p>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-6" data-testid="dashboard">
      <!-- Today's plan -->
      <article class="tile flex flex-col items-start gap-2 lg:col-span-2" data-testid="tile-plan">
        <h2 class="tile-title">{{ t('stats.plan.title') }}</h2>
        <p class="text-4xl font-semibold tabular-nums">{{ dueToday }}</p>
        <p class="text-sm text-muted">{{ t('stats.plan.due', { n: dueToday }, dueToday) }} · {{ planned }}</p>
        <RouterLink to="/" class="lf-btn lf-btn-primary mt-auto min-h-11">{{ t('stats.plan.open') }}</RouterLink>
      </article>

      <!-- Streak -->
      <article class="tile flex flex-col gap-1" data-testid="tile-streak">
        <h2 class="tile-title">{{ t('stats.streak.title') }}</h2>
        <p class="flex items-center gap-1.5 text-4xl font-semibold tabular-nums">
          <Flame v-if="streak" :size="26" class="text-accent" aria-hidden="true" />{{ streak }}
        </p>
        <p class="text-sm text-muted">{{ t('stats.streak.days', { n: streak }, streak) }}</p>
        <p class="mt-auto text-xs text-muted">{{ didOutputToday ? t('stats.streak.done') : t('stats.streak.pending') }}</p>
      </article>

      <!-- Retention -->
      <article class="tile flex flex-col gap-1" data-testid="tile-retention">
        <h2 class="tile-title">{{ t('stats.retention.title') }}</h2>
        <p class="text-4xl font-semibold tabular-nums">{{ kept.percent === null ? '—' : `${kept.percent}%` }}</p>
        <p class="mt-auto text-xs text-muted">
          {{ kept.percent === null ? t('stats.retention.empty') : t('stats.retention.detail', { n: kept.reviews }, kept.reviews) }}
        </p>
      </article>

      <!-- Weekly targets -->
      <article class="tile flex flex-col gap-3 sm:col-span-2" data-testid="tile-week">
        <h2 class="tile-title">{{ t('stats.week.title') }}</h2>
        <BarList
          :rows="[
            { key: 'minutes', label: t('stats.week.minutes'), value: week.minutes, display: `${week.minutes} / ${today.weeklyTargets.minutes}` },
          ]"
          :max="today.weeklyTargets.minutes"
        />
        <BarList
          :rows="[{ key: 'items', label: t('stats.week.items'), value: week.items, display: `${week.items} / ${today.weeklyTargets.items}` }]"
          :max="today.weeklyTargets.items"
        />
        <RouterLink to="/settings" class="mt-auto text-xs text-muted underline">{{ t('stats.week.change') }}</RouterLink>
      </article>

      <!-- Forecast -->
      <article class="tile sm:col-span-2 lg:col-span-3" data-testid="tile-forecast">
        <h2 class="tile-title mb-3">{{ t('stats.forecast.title') }}</h2>
        <ForecastChart v-if="forecast.length" :days="forecast" />
      </article>

      <!-- Funnel -->
      <article class="tile lg:col-span-3" data-testid="tile-funnel">
        <h2 class="tile-title mb-3">{{ t('stats.funnel.title') }}</h2>
        <BarList :rows="funnel" />
        <ChartTable
          :caption="t('stats.funnel.title')"
          :columns="[t('fields.status'), t('stats.funnel.column')]"
          :rows="funnel.map((row) => [row.label, row.value])"
        />
      </article>

      <!-- Heatmap -->
      <article class="tile sm:col-span-2 lg:col-span-4" data-testid="tile-heatmap">
        <h2 class="tile-title mb-3">{{ t('stats.heatmap.title') }}</h2>
        <ActivityHeatmap :cells="calendar" />
      </article>

      <!-- Minutes -->
      <article class="tile lg:col-span-2" data-testid="tile-minutes">
        <h2 class="tile-title mb-1">{{ t('stats.minutes.title') }}</h2>
        <p class="mb-3 text-xs text-muted">{{ t('stats.minutes.note') }}</p>
        <BarList v-if="minutes.length" :rows="minutes" />
        <p v-else class="text-sm text-muted">{{ t('stats.minutes.empty') }}</p>
      </article>

      <!-- Weakness -->
      <article class="tile sm:col-span-2 lg:col-span-2" data-testid="tile-weakness">
        <h2 class="tile-title mb-2">{{ t('stats.weakness.title') }}</h2>
        <p v-if="focus" class="mb-3 text-sm font-medium" data-testid="next-focus">
          {{ t('stats.weakness.focus', { context: focus.context, kind: focus.kind, percent: focus.percent }) }}
        </p>
        <div role="group" :aria-label="t('stats.weakness.by')" class="mb-3 flex flex-wrap gap-1">
          <button
            v-for="option in DIMENSIONS"
            :key="option"
            type="button"
            class="lf-btn min-h-8 text-xs"
            :aria-pressed="dimension === option"
            @click="dimension = option"
          >
            {{ t(`stats.weakness.${option}`) }}
          </button>
        </div>
        <BarList v-if="accuracy.length" :rows="accuracy" :max="100" />
        <p v-else class="text-sm text-muted">{{ t('stats.weakness.empty') }}</p>
      </article>

      <!-- Mistakes -->
      <article class="tile lg:col-span-2" data-testid="tile-mistakes">
        <h2 class="tile-title mb-3">{{ t('stats.mistakes.title') }}</h2>
        <ul v-if="mistakes.length" class="flex flex-col gap-3 text-sm">
          <li v-for="mistake in mistakes" :key="mistake.id">
            <p class="text-muted line-through" lang="en">{{ mistake.error }}</p>
            <p lang="en">{{ mistake.correction }}</p>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">{{ t('stats.mistakes.empty') }}</p>
      </article>

      <!-- Used in output -->
      <article class="tile lg:col-span-2" data-testid="tile-used">
        <h2 class="tile-title mb-1">{{ t('stats.used.title') }}</h2>
        <p class="mb-3 text-3xl font-semibold tabular-nums">{{ used.length }}</p>
        <ul v-if="used.length" class="flex flex-wrap gap-1.5 text-sm">
          <li v-for="entry in used.slice(0, 12)" :key="entry.id" class="rounded border border-line px-2 py-0.5" lang="en">{{ entry.text }}</li>
        </ul>
        <p v-else class="text-sm text-muted">{{ t('stats.used.empty') }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.tile {
  border-radius: var(--radius-card);
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 1.25rem;
  min-width: 0;
}
.tile-title {
  font-size: 0.875rem;
  font-weight: 600;
}
</style>
