<script setup lang="ts">
import { Volume2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { hasBrowserVoice } from '@/features/voice/browserVoice'
import { speak, stopSpeaking } from '@/features/voice/speech'
import { useVoiceStore } from '@/features/voice/voiceStore'
import { VOICES } from '@/features/voice/voices'

const { t } = useI18n()
const voice = useVoiceStore()
const browserVoiceFound = ref(true)

const SAMPLE = "Hey! This is how I'll sound when we practice together. What did you get up to this weekend?"

const percent = computed(() => Math.round(voice.progress * 100))
const naturalActive = computed(() => voice.usingNatural && voice.status !== 'downloading')
const accents = computed(() => [
  { label: t('settings.voice.accentUs'), voices: VOICES.filter((item) => item.accent === 'us') },
  { label: t('settings.voice.accentUk'), voices: VOICES.filter((item) => item.accent === 'uk') },
])

onBeforeUnmount(stopSpeaking)
onMounted(async () => {
  browserVoiceFound.value = await hasBrowserVoice()
})
</script>

<template>
  <section class="flex flex-col gap-3 rounded-card border border-line bg-surface p-5" data-testid="voice-settings">
    <h2 class="font-semibold">{{ t('settings.voice.title') }}</h2>
    <p class="text-sm text-muted">{{ t('settings.voice.description') }}</p>

    <div role="group" :aria-label="t('settings.voice.title')" class="flex flex-wrap gap-2">
      <button type="button" class="lf-btn" :aria-pressed="!naturalActive" @click="voice.choose('browser')">
        {{ t('settings.voice.browser') }}
      </button>
      <button
        type="button"
        class="lf-btn"
        :aria-pressed="naturalActive"
        :disabled="voice.status === 'downloading'"
        @click="voice.choose('natural')"
      >
        {{ voice.downloaded ? t('settings.voice.natural') : t('settings.voice.naturalDownload') }}
      </button>
    </div>

    <p v-if="!voice.downloaded && voice.status !== 'downloading'" class="text-xs text-muted">{{ t('settings.voice.downloadNote') }}</p>
    <p v-if="!browserVoiceFound && !naturalActive" class="text-xs text-muted" data-testid="no-browser-voice">{{ t('settings.voice.noBrowserVoice') }}</p>

    <div v-if="voice.status === 'downloading'" class="flex flex-col gap-2" data-testid="voice-download">
      <progress class="w-full max-w-sm" :value="percent" max="100" :aria-label="t('settings.voice.downloading')" />
      <p class="text-sm" role="status">{{ t('settings.voice.downloadingPercent', { percent }) }}</p>
      <button type="button" class="lf-btn self-start" @click="voice.cancelDownload()">{{ t('settings.voice.cancel') }}</button>
    </div>

    <label v-if="naturalActive" class="block max-w-xs">
      <span class="lf-label">{{ t('settings.voice.voice') }}</span>
      <select v-model="voice.voiceId" class="lf-input" data-testid="voice-select">
        <optgroup v-for="accent in accents" :key="accent.label" :label="accent.label">
          <option v-for="item in accent.voices" :key="item.id" :value="item.id">{{ item.name }}</option>
        </optgroup>
      </select>
    </label>

    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="lf-btn" data-testid="voice-test" :disabled="voice.status === 'downloading' || (!naturalActive && !browserVoiceFound)" @click="speak(SAMPLE)">
        <Volume2 :size="15" aria-hidden="true" />
        {{ t('settings.voice.test') }}
      </button>
      <button v-if="voice.downloaded" type="button" class="lf-btn" @click="voice.removeDownload()">
        {{ t('settings.voice.remove') }}
      </button>
      <span v-if="voice.preparing" class="text-sm text-muted" role="status">{{ t('settings.voice.preparing') }}</span>
    </div>
    <p v-if="voice.downloaded" class="text-xs text-muted">{{ t('settings.voice.privacy') }}</p>
  </section>
</template>
