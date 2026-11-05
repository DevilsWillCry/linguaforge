<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReminderStore } from '@/features/reminders/reminderStore'

const { t } = useI18n()
const reminders = useReminderStore()
onMounted(() => void reminders.load())
</script>

<template>
  <section class="flex flex-col gap-3 rounded-card border border-line bg-surface p-5" data-testid="reminder-settings">
    <h2 class="font-semibold">{{ t('settings.reminders.title') }}</h2>
    <p class="text-sm text-muted">{{ t('settings.reminders.description') }}</p>
    <p v-if="!reminders.supported" class="text-sm" data-testid="reminders-unsupported">{{ t('settings.reminders.unsupported') }}</p>
    <template v-else>
      <label class="block max-w-40">
        <span class="lf-label">{{ t('settings.reminders.time') }}</span>
        <input
          type="time"
          class="lf-input"
          :value="reminders.time"
          @change="reminders.setTime(($event.target as HTMLInputElement).value)"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <button v-if="!reminders.enabled" type="button" class="lf-btn" :disabled="reminders.busy" @click="reminders.enable()">{{ t('settings.reminders.enable') }}</button>
        <template v-else>
          <button type="button" class="lf-btn" @click="reminders.sendTest()">{{ t('settings.reminders.test') }}</button>
          <button type="button" class="lf-btn" :disabled="reminders.busy" @click="reminders.disable()">{{ t('settings.reminders.disable') }}</button>
        </template>
      </div>
      <p v-if="reminders.blocked" class="text-sm" role="alert" data-testid="reminders-blocked">{{ t('settings.reminders.blocked') }}</p>
      <p class="text-xs text-muted">{{ t('settings.reminders.note') }}</p>
    </template>
  </section>
</template>
