<script setup lang="ts">
import { liveQuery } from 'dexie'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { deckRepository, entryRepository, type EntryCounts } from '@/data/repositories'
import type { Deck } from '@/domain/types'
import { useEnrichmentStore } from '@/features/enrichment/enrichmentStore'
import { outputDays, outputStreak, dayKey } from '@/domain/analytics'
import { INTENSITIES, planMinutes } from '@/domain/sessionPlans'
import { statsRepository } from '@/data/repositories'
import { useTodayStore } from './todayStore'
import WrapUpRecap from './WrapUpRecap.vue'

const { t } = useI18n()
const enrichment = useEnrichmentStore()
const today = useTodayStore()

const clock = computed(() => {
  const { seconds } = today.state
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

const stepClass = (index: number) => {
  if (!today.state.started) return 'text-muted'
  if (index < today.state.stepIndex) return 'text-muted line-through'
  return index === today.state.stepIndex ? 'font-semibold text-ink' : 'text-muted'
}

const reviewedToday = ref(0)
const streak = ref(0)
const outputToday = ref(false)
const dueTomorrow = ref(0)

const decks = shallowRef<{ deck: Deck; counts: EntryCounts }[]>([])
const loading = ref(true)
const failed = ref(false)

// A live query, so entries added with Quick Add update these counts straight away.
const subscription = liveQuery(async () => {
  const list = await deckRepository.list()
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const tomorrow = new Date(midnight)
  tomorrow.setDate(tomorrow.getDate() + 2)
  reviewedToday.value = (await entryRepository.reviewedSince(midnight)).length
  const { logs, conversations, sessions } = await statsRepository.outputFacts()
  const days = outputDays(logs, conversations, sessions)
  streak.value = outputStreak(days, new Date())
  outputToday.value = days.has(dayKey(new Date()))
  const dueCounts = await Promise.all(list.map((deck) => entryRepository.counts(deck.id, tomorrow)))
  dueTomorrow.value = dueCounts.reduce((sum, counts) => sum + counts.due, 0)
  return Promise.all(list.map(async (deck) => ({ deck, counts: await entryRepository.counts(deck.id) })))
}).subscribe({
  next: (value) => {
    decks.value = value
    loading.value = false
  },
  error: (error) => {
    console.error(error)
    failed.value = true
    loading.value = false
  },
})

onBeforeUnmount(() => subscription.unsubscribe())
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold tracking-tight">{{ t('nav.today') }}</h1>
    <p class="mt-1 text-sm text-muted">{{ t('today.subtitle') }}</p>
    <p v-if="streak" class="mt-2 text-sm" data-testid="today-streak">{{ t('today.streak', { n: streak }, streak) }}</p>

    <p v-if="failed" role="alert" class="mt-6 text-sm">{{ t('errors.load') }}</p>
    <p v-else-if="loading" class="mt-6 text-sm text-muted">{{ t('loading') }}</p>

    <section v-if="!failed && !loading" class="mt-6 flex flex-col gap-4 rounded-card border border-line bg-surface p-5" data-testid="today-session">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm" aria-live="off">
          <span class="text-muted">{{ t('today.elapsed') }}:</span>
          <span class="ml-1 font-semibold tabular-nums" data-testid="today-clock">{{ clock }}</span>
          <span v-if="today.state.started && !today.state.running && !today.finished" class="ml-2 text-muted">{{ t('today.paused') }}</span>
        </p>
        <div class="flex flex-wrap gap-2">
          <button v-if="!today.state.started" type="button" class="lf-btn lf-btn-primary min-h-11" @click="today.start()">{{ t('today.start') }}</button>
          <template v-else-if="!today.finished">
            <button v-if="today.state.running" type="button" class="lf-btn" @click="today.pause()">{{ t('today.pause') }}</button>
            <button v-else type="button" class="lf-btn" @click="today.resume()">{{ t('today.resume') }}</button>
          </template>
          <button v-else type="button" class="lf-btn" @click="today.restart()">{{ t('today.restart') }}</button>
        </div>
      </div>

      <div v-if="!today.state.started" role="group" :aria-label="t('today.intensity')" data-testid="today-intensity">
        <p class="text-sm font-medium">{{ t('today.intensity') }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="option in INTENSITIES"
            :key="option"
            type="button"
            class="lf-btn"
            :aria-pressed="today.intensity === option"
            @click="today.setIntensity(option)"
          >
            {{ t(`today.intensities.${option}`) }} · {{ planMinutes(option) }} min
          </button>
        </div>
      </div>

      <div
        v-if="!today.state.started && !outputToday"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-raised p-3 text-sm"
        data-testid="today-rescue"
      >
        <p>{{ streak ? t('today.rescue.streak', { n: streak }, streak) : t('today.rescue.body') }}</p>
        <button type="button" class="lf-btn" @click="today.start('rescue')">{{ t('today.rescue.start') }}</button>
      </div>

      <ol class="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]" data-testid="today-rail">
        <li
          v-for="(item, index) in today.steps"
          :key="index"
          class="border-t-2 pt-2 text-sm"
          :class="[stepClass(index), today.state.started && index <= today.state.stepIndex ? 'border-accent' : 'border-line']"
          :aria-current="today.state.started && index === today.state.stepIndex ? 'step' : undefined"
        >
          {{ t(`today.steps.${item.id}.title`) }}
          <span class="block text-xs font-normal text-muted no-underline">{{ item.minutes }} min</span>
        </li>
      </ol>

      <div v-if="today.state.started && today.step" class="flex flex-col items-start gap-3" data-testid="today-step">
        <div>
          <h2 class="font-semibold">{{ t(`today.steps.${today.step.id}.title`) }}</h2>
          <p class="text-sm text-muted">{{ t(`today.steps.${today.step.id}.body`) }}</p>
        </div>
        <dl v-if="today.step.id === 'wrapup'" class="grid grid-cols-2 gap-6" data-testid="today-wrapup">
          <div>
            <dd class="text-2xl font-semibold tabular-nums">{{ reviewedToday }}</dd>
            <dt class="text-xs text-muted">{{ t('today.reviewsToday') }}</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold tabular-nums">{{ dueTomorrow }}</dd>
            <dt class="text-xs text-muted">{{ t('today.dueTomorrow') }}</dt>
          </div>
        </dl>
        <WrapUpRecap v-if="today.step.id === 'wrapup'" />
        <div class="flex flex-wrap gap-2">
          <RouterLink v-if="today.step.path" :to="today.step.path" class="lf-btn lf-btn-primary min-h-11">{{ t('today.open') }}</RouterLink>
          <button type="button" class="lf-btn min-h-11" @click="today.advance()">
            {{ t('today.markDone') }}
          </button>
        </div>
      </div>
      <p v-else-if="today.finished" class="text-sm font-medium" data-testid="today-finished">{{ t('today.finished') }}</p>
    </section>

    <div v-if="!failed && !loading" class="mt-6 grid gap-4 md:grid-cols-2">
      <article
        v-for="{ deck, counts } in decks"
        :key="deck.id"
        class="rounded-card border border-line bg-surface p-5"
        data-testid="deck-card"
      >
        <p class="text-xs text-muted">{{ t('today.deck') }}</p>
        <h2 class="font-semibold">{{ deck.name }}</h2>
        <dl class="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dd class="text-2xl font-semibold tabular-nums">{{ counts.total }}</dd>
            <dt class="mt-0.5 text-xs text-muted">{{ t('today.entries') }}</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold tabular-nums">{{ counts.empty }}</dd>
            <dt class="mt-0.5 text-xs text-muted">{{ t('today.toEnrich') }}</dt>
          </div>
          <div>
            <dd class="text-2xl font-semibold tabular-nums">{{ counts.due }}</dd>
            <dt class="mt-0.5 text-xs text-muted">{{ t('today.due') }}</dt>
          </div>
        </dl>
      </article>

      <RouterLink v-if="enrichment.drafts.length" to="/enrich" class="lf-btn min-h-11 md:col-span-2 md:justify-self-start">
        {{ t('enrich.reviewDrafts', { n: enrichment.drafts.length }) }}
      </RouterLink>

      <RouterLink
        to="/library"
        class="lf-btn lf-btn-primary min-h-11 md:col-span-2 md:justify-self-start"
      >
        {{ t('today.openLibrary') }}
      </RouterLink>
    </div>
  </section>
</template>
