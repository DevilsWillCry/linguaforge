<script setup lang="ts">
import { ChevronLeft, ChevronRight, Pause, Play, Repeat, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { formatTime } from '@/domain/subtitles'
import { useVideoStore, type VideoMode } from './videoStore'

const { t } = useI18n()
const video = useVideoStore()

const RATES = [0.5, 0.75, 1, 1.25, 1.5]
const MODES: VideoMode[] = ['watch', 'cloze', 'dictation']
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="player-controls">
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="lf-btn" :disabled="!video.player" :aria-label="video.playing ? t('video.pause') : t('video.play')" @click="video.togglePlay()">
        <component :is="video.playing ? Pause : Play" :size="15" aria-hidden="true" />
      </button>
      <span class="text-sm tabular-nums" data-testid="video-time">{{ formatTime(video.time) }}</span>

      <template v-if="video.cues.length">
        <button type="button" class="lf-btn" :aria-label="t('video.previous')" @click="video.previousCue()">
          <ChevronLeft :size="15" aria-hidden="true" />
        </button>
        <button type="button" class="lf-btn" @click="video.repeatCue()">
          <Repeat :size="15" aria-hidden="true" />
          {{ t('video.repeat') }}
          <kbd class="hidden text-xs text-muted md:inline">R</kbd>
        </button>
        <button type="button" class="lf-btn" :aria-label="t('video.next')" @click="video.nextCue()">
          <ChevronRight :size="15" aria-hidden="true" />
        </button>
      </template>

      <label class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-muted">{{ t('video.speed') }}</span>
        <select class="lf-input w-auto" :value="video.rate" @change="video.setRate(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="rate in RATES" :key="rate" :value="rate">{{ rate }}×</option>
        </select>
      </label>
    </div>

    <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="t('video.loop')">
      <span class="text-sm text-muted">{{ t('video.loop') }}</span>
      <button type="button" class="lf-btn tabular-nums" :aria-pressed="video.loop.a !== null" :disabled="!video.player" @click="video.setLoopPoint('a')">
        A<span v-if="video.loop.a !== null" class="ml-1 text-xs">{{ formatTime(video.loop.a) }}</span>
      </button>
      <button type="button" class="lf-btn tabular-nums" :aria-pressed="video.loop.b !== null" :disabled="!video.player" @click="video.setLoopPoint('b')">
        B<span v-if="video.loop.b !== null" class="ml-1 text-xs">{{ formatTime(video.loop.b) }}</span>
      </button>
      <button v-if="video.loop.a !== null || video.loop.b !== null" type="button" class="lf-btn" :aria-label="t('video.clearLoop')" @click="video.clearLoop()">
        <X :size="15" aria-hidden="true" />
      </button>

      <div class="ml-auto flex gap-1" role="group" :aria-label="t('video.modeLabel')">
        <button
          v-for="mode in MODES"
          :key="mode"
          type="button"
          class="lf-btn"
          :aria-pressed="video.mode === mode"
          :disabled="mode !== 'watch' && !video.cues.length"
          @click="video.mode = mode"
        >
          {{ t(`video.modes.${mode}`) }}
        </button>
      </div>
    </div>
  </div>
</template>
