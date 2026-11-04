<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { Clapperboard } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { videoRepository } from '@/data/repositories'
import { formatTime, parseYouTubeId } from '@/domain/subtitles'
import type { VideoSession } from '@/domain/types'
import CaptureCard from '@/features/capture/CaptureCard.vue'
import LibrarySources from '@/features/capture/LibrarySources.vue'
import PlayerControls from './PlayerControls.vue'
import PlayerFrame from './PlayerFrame.vue'
import PracticePanel from './PracticePanel.vue'
import TranscriptPanel from './TranscriptPanel.vue'
import { useVideoStore } from './videoStore'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const video = useVideoStore()

const link = ref('')
const linkError = ref(false)
const recent = shallowRef<VideoSession[]>([])

const heading = computed(() => video.session?.title || t('nav.video'))

function numberParam(name: string): number | undefined {
  const value = Number(route.query[name])
  return route.query[name] !== undefined && Number.isFinite(value) ? value : undefined
}

/** The address decides what's open, so links and the back button work. */
async function syncWithRoute() {
  const id = typeof route.query.v === 'string' ? parseYouTubeId(route.query.v) : null
  const startSec = numberParam('t')
  const endSec = numberParam('end')
  if (id) {
    await video.open({
      kind: 'youtube',
      key: `yt:${id}`,
      videoId: id,
      ...(startSec !== undefined ? { startSec } : {}),
      ...(endSec !== undefined ? { endSec } : {}),
    })
    return
  }
  // A local file has no address, so it stays open until the user goes back to the list.
  if (video.source?.kind === 'youtube') await video.close()
  if (!video.source) recent.value = await videoRepository.recentSessions(8).catch(() => [])
}

onMounted(syncWithRoute)
watch(() => [route.query.v, route.query.t, route.query.end], syncWithRoute)
onBeforeUnmount(() => void video.close())

function openLink() {
  const id = parseYouTubeId(link.value)
  linkError.value = !id
  if (id) void router.push({ path: '/video', query: { v: id } })
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  void video.open({
    kind: 'file',
    key: `file:${file.name}:${file.size}`,
    url: URL.createObjectURL(file),
    name: file.name,
    isAudio: file.type.startsWith('audio/'),
  })
}

async function backToList() {
  await video.close()
  if (route.query.v) await router.push('/video')
  else await syncWithRoute()
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!video.source || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target
  if (target instanceof HTMLElement && target.matches('input, textarea, select')) return
  // On a focused control, Space must keep pressing that control.
  const onControl = target instanceof HTMLElement && target.matches('button, a, [role="button"]')
  const key = event.key.toLowerCase()
  if (key === ' ' && !onControl) {
    event.preventDefault()
    video.togglePlay()
  } else if (key === 'r') video.repeatCue()
  else if (key === 'arrowleft') video.previousCue()
  else if (key === 'arrowright') video.nextCue()
  else if (key === 'a') video.setLoopPoint('a')
  else if (key === 'b') video.setLoopPoint('b')
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="min-w-0 text-2xl font-semibold tracking-tight wrap-break-word">{{ heading }}</h1>
      <button v-if="video.source" type="button" class="lf-btn" @click="backToList">{{ t('video.backToList') }}</button>
    </header>

    <div v-if="!video.source" class="flex max-w-2xl flex-col gap-4">
      <p class="text-sm text-muted">{{ t('video.subtitle') }}</p>
      <form class="flex flex-col gap-2 rounded-card border border-line bg-surface p-4" data-testid="video-open" novalidate @submit.prevent="openLink">
        <label class="block">
          <span class="lf-label">{{ t('video.link') }}</span>
          <input v-model="link" type="url" class="lf-input" placeholder="https://www.youtube.com/watch?v=…" spellcheck="false" />
        </label>
        <p v-if="linkError" class="text-sm" role="alert">{{ t('video.badLink') }}</p>
        <button type="submit" class="lf-btn lf-btn-primary self-start" :disabled="!link.trim()">{{ t('video.open') }}</button>
        <label class="mt-3 block border-t border-line pt-3">
          <span class="lf-label">{{ t('video.file') }}</span>
          <input type="file" accept="video/*,audio/*" class="lf-input" data-testid="video-file" @change="onFile" />
        </label>
      </form>

      <LibrarySources kind="video" />

      <section v-if="recent.length" class="flex flex-col gap-2" data-testid="video-history">
        <h2 class="font-semibold">{{ t('video.history') }}</h2>
        <ul class="flex flex-col gap-2">
          <li v-for="item in recent" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-surface p-3 text-sm">
            <span class="flex min-w-0 items-center gap-2">
              <Clapperboard :size="15" aria-hidden="true" class="shrink-0 text-muted" />
              <RouterLink v-if="item.videoId" :to="{ path: '/video', query: { v: item.videoId } }" class="wrap-anywhere underline-offset-2 hover:underline">
                {{ item.title || item.videoId }}
              </RouterLink>
              <span v-else class="wrap-anywhere">{{ item.title }}</span>
            </span>
            <span class="text-xs text-muted tabular-nums">
              {{ t('video.historyStats', { position: formatTime(item.positionSec), minutes: Math.round(item.minutesWatched), words: item.wordsCaptured }) }}
            </span>
          </li>
        </ul>
      </section>
    </div>

    <div v-else class="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
      <div class="flex min-w-0 flex-col gap-4">
        <!-- A clip of the same video is a new start position, so the player starts over. -->
        <PlayerFrame :key="`${video.source.key}:${video.source.kind === 'youtube' ? video.source.startSec : ''}`" :source="video.source" />
        <PlayerControls />
        <CaptureCard
          v-if="video.capture"
          :capture="video.capture"
          :hint="t('video.capture.hint')"
          @save="video.saveCapture"
          @cancel="video.capture = null"
        />
        <PracticePanel v-if="video.mode !== 'watch'" />
      </div>
      <!-- In practice modes the transcript would show the answers, so it's hidden. -->
      <TranscriptPanel v-if="video.mode === 'watch'" class="lg:sticky lg:top-4" />
    </div>
  </section>
</template>
