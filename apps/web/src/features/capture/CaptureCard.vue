<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import type { Capture } from './saveCapture'

const props = defineProps<{ capture: Capture; hint: string }>()
const emit = defineEmits<{ save: [text: string]; cancel: [] }>()
const { t } = useI18n()

const text = ref('')
watch(
  () => props.capture,
  (capture) => {
    text.value = capture.entry?.text ?? capture.text
  },
  { immediate: true },
)
</script>

<template>
  <form class="flex flex-col gap-3 rounded-card border border-accent bg-surface p-4" data-testid="capture-card" @submit.prevent="emit('save', text)">
    <template v-if="capture.entry">
      <div class="flex flex-wrap items-center gap-2">
        <p class="font-semibold wrap-break-word" lang="en">{{ capture.entry.text }}</p>
        <StatusBadge :status="capture.entry.status" />
      </div>
      <p v-if="capture.entry.ipa" class="font-mono text-xs text-muted">{{ capture.entry.ipa }}</p>
      <ul v-if="capture.entry.meanings.length" class="flex flex-col gap-1 text-sm">
        <li v-for="meaning in capture.entry.meanings" :key="meaning">{{ meaning }}</li>
      </ul>
      <p v-if="capture.entry.tone" class="text-xs text-muted">{{ t('fields.tone') }}: {{ capture.entry.tone }}</p>
    </template>
    <label v-else class="block">
      <span class="lf-label">{{ t('video.capture.text') }}</span>
      <input v-model="text" type="text" class="lf-input" lang="en" spellcheck="false" />
    </label>

    <p v-if="capture.sentence" class="text-sm text-muted" lang="en">“{{ capture.sentence }}”</p>
    <p class="text-xs text-muted">{{ capture.entry ? t('video.capture.existingHint') : hint }}</p>
    <div class="flex flex-wrap gap-2">
      <button type="submit" class="lf-btn lf-btn-primary" :disabled="!text.trim()">
        {{ capture.entry ? t('video.capture.addSentence') : t('video.capture.add') }}
      </button>
      <button type="button" class="lf-btn" @click="emit('cancel')">{{ t('video.capture.cancel') }}</button>
    </div>
  </form>
</template>
