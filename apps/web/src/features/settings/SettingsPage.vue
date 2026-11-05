<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { locale, type Locale } from '@/app/i18n'
import { useTheme, type ThemeMode } from '@/app/theme'
import AiSettings from './AiSettings.vue'
import CaptureSettings from './CaptureSettings.vue'
import DataSettings from './DataSettings.vue'
import DropdownEditor from './DropdownEditor.vue'
import { useReviewStore } from '@/features/review/reviewStore'
import { useTodayStore } from '@/features/today/todayStore'
import { INTENSITIES, planMinutes } from '@/domain/sessionPlans'
import ReminderSettings from './ReminderSettings.vue'
import VoiceSettings from './VoiceSettings.vue'

const { t } = useI18n()
const { mode } = useTheme()
const review = useReviewStore()
const reviewLimit = ref(review.dailyLimit)
const today = useTodayStore()

const themes: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'settings.themeAuto' },
  { value: 'dark', label: 'settings.themeDark' },
  { value: 'light', label: 'settings.themeLight' },
]
const locales: { value: Locale; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold tracking-tight">{{ t('nav.settings') }}</h1>

    <section class="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
      <h2 class="font-semibold">{{ t('settings.appearance') }}</h2>
      <div role="group" :aria-label="t('settings.theme')">
        <p class="text-sm font-medium">{{ t('settings.theme') }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="option in themes"
            :key="option.value"
            type="button"
            class="lf-btn"
            :aria-pressed="mode === option.value"
            @click="mode = option.value"
          >
            {{ t(option.label) }}
          </button>
        </div>
      </div>

      <div role="group" :aria-label="t('settings.language')">
        <p class="text-sm font-medium">{{ t('settings.language') }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="option in locales"
            :key="option.value"
            type="button"
            class="lf-btn"
            :aria-pressed="locale === option.value"
            @click="locale = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3 rounded-card border border-line bg-surface p-5" data-testid="plan-settings">
      <h2 class="font-semibold">{{ t('settings.plan.title') }}</h2>
      <div role="group" :aria-label="t('today.intensity')" class="flex flex-wrap gap-2">
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
      <div class="grid max-w-md gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="lf-label">{{ t('settings.plan.weeklyMinutes') }}</span>
          <input v-model.number="today.weeklyTargets.minutes" type="number" min="1" class="lf-input" />
        </label>
        <label class="block">
          <span class="lf-label">{{ t('settings.plan.weeklyItems') }}</span>
          <input v-model.number="today.weeklyTargets.items" type="number" min="1" class="lf-input" />
        </label>
      </div>
    </section>

    <section class="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <h2 class="font-semibold">{{ t('nav.review') }}</h2>
      <label class="block max-w-xs">
        <span class="lf-label">{{ t('settings.reviewLimit') }}</span>
        <input
          type="number"
          min="1"
          class="lf-input"
          v-model.number="reviewLimit"
          @change="review.setDailyLimit(reviewLimit)"
        />
      </label>
    </section>

    <ReminderSettings />
    <VoiceSettings />
    <AiSettings />
    <DropdownEditor />
    <CaptureSettings />
    <DataSettings />
  </section>
</template>
