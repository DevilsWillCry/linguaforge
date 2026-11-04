<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createHtmlPlayer, createYouTubePlayer } from './mediaPlayer'
import { useVideoStore, type MediaSource } from './videoStore'

const props = defineProps<{ source: MediaSource }>()
const { t } = useI18n()
const video = useVideoStore()

const youtubeTarget = ref<HTMLElement | null>(null)
const failed = ref(false)
let unmounted = false

onMounted(async () => {
  if (props.source.kind !== 'youtube' || !youtubeTarget.value) return
  try {
    const player = await createYouTubePlayer(youtubeTarget.value, props.source.videoId, video.startPosition)
    if (unmounted) player.destroy()
    else video.attach(player)
  } catch (error) {
    console.error(error)
    failed.value = true
  }
})

onBeforeUnmount(() => {
  unmounted = true
})

function onFileReady(event: Event) {
  const element = event.target as HTMLMediaElement
  video.attach(createHtmlPlayer(element))
  if (video.startPosition > 0) element.currentTime = video.startPosition
}
</script>

<template>
  <div class="overflow-hidden rounded-card border border-line bg-black" data-testid="player">
    <p v-if="failed" class="bg-surface p-5 text-sm" role="alert" data-testid="player-error">{{ t('video.playerFailed') }}</p>
    <div v-else-if="source.kind === 'youtube'" class="aspect-video [&>iframe]:size-full">
      <div ref="youtubeTarget" />
    </div>
    <audio v-else-if="source.isAudio" :src="source.url" controls class="w-full" data-testid="media" @loadedmetadata="onFileReady" />
    <!-- The transcript panel serves as the captions for the user's own files. -->
    <video v-else :src="source.url" controls playsinline class="aspect-video w-full" data-testid="media" @loadedmetadata="onFileReady" />
  </div>
</template>
